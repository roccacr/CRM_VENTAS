/**
 * Cliente HTTP hacia la API Kapso (platform + relay Meta).
 *
 * Aísla snake_case/shapes heterogéneos del proveedor, selecciona API key por proyecto
 * y traduce errores upstream a 502/503 sin filtrar bodies sensibles al cliente.
 * Timeout corto para no retener workers/request threads ante latencia del proveedor.
 */

import { HttpException, Injectable, Logger } from "@nestjs/common";

import { ConfigService } from "@nestjs/config";

import { HttpService } from "@nestjs/axios";

import axios, { AxiosResponse, Method } from "axios";

import { firstValueFrom } from "rxjs";

import { KAPSO_DEFAULT_EVENTS, KAPSO_PLATFORM_EVENTS } from "../common/kapso.constants";

import { asArray, asRecord, firstNonNullString, getNestedValue, pickBoolean, summarizePayload } from "../common/kapso.helpers";

import {
  JsonRecord,
  KapsoApiRequestOptions,
  KapsoCustomerSummary,
  KapsoPhoneNumberDetail,
  KapsoPhoneNumberSummary,
  KapsoWebhookSummary,
} from "../common/kapso.types";

// Limita cuánto puede retener recursos una llamada síncrona al proveedor externo.
const KAPSO_HTTP_TIMEOUT_MS = 10_000;

/**
 * Error upstream Kapso: respuesta HTTP pública genérica + mensaje interno rico
 * para clasificar disponibilidad/pending sync sin filtrar el body al cliente.
 */
class KapsoUpstreamException extends HttpException {
  constructor(upstreamMessage: string, upstreamStatus?: number) {
    const publicStatus = upstreamStatus === 429 ? 503 : 502;

    super(
      {
        statusCode: publicStatus,
        message: "No se pudo completar la operación contra Kapso.",
      },
      publicStatus,
    );

    // El mensaje interno conserva la señal necesaria para clasificar errores
    // transitorios sin exponer el body del proveedor en la respuesta HTTP.
    this.message = upstreamMessage;
  }
}

const WEBHOOK_PATH_BY_KIND = {
  platform: "/webhooks/kapso/platform",
  kapso: "/webhooks/kapso/events",
  meta: "/webhooks/kapso/meta",
} as const;

const KAPSO_API_PATHS = {
  customers: "/customers",
  phoneNumbers: "/whatsapp/phone_numbers",
  projectWebhooks: "/whatsapp/webhooks",
} as const;

const phoneNumberPath = (phoneNumberId: string) => `${KAPSO_API_PATHS.phoneNumbers}/${phoneNumberId}`;

const phoneNumberWebhooksPath = (phoneNumberId: string) => `${phoneNumberPath(phoneNumberId)}/webhooks`;

/**
 * Adaptador de dominio sobre Kapso Platform API y el relay Meta de mensajería.
 */
@Injectable()
export class KapsoPlatformApiService {
  private readonly logger = new Logger(KapsoPlatformApiService.name);

  private readonly apiBaseUrl: string;

  private readonly metaApiBaseUrl: string;

  private readonly defaultApiKey: string;

  private readonly projectApiKeys: Record<string, string>;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiBaseUrl = this.configService.getOrThrow<string>("kapso.apiBaseUrl");
    this.metaApiBaseUrl = this.configService.getOrThrow<string>("kapso.metaApiBaseUrl");
    this.defaultApiKey = this.configService.getOrThrow<string>("kapso.apiKey");
    this.projectApiKeys = this.configService.get<Record<string, string>>("kapso.projectApiKeys") ?? {};
  }

  /** Lista customers Kapso normalizados al shape del dominio. */
  async listCustomers(): Promise<KapsoCustomerSummary[]> {
    const response = await this.request<JsonRecord>(KAPSO_API_PATHS.customers);
    const items = asArray<JsonRecord>(this.unwrap(response, "customers"));

    return items.map((item) => this.mapCustomer(item));
  }

  /**
   * Obtiene un customer por id externo; `null` si Kapso no devuelve id usable.
   *
   * @param customerId - Id del customer en Kapso.
   */
  async getCustomer(customerId: string): Promise<KapsoCustomerSummary | null> {
    const response = await this.request<JsonRecord>(`${KAPSO_API_PATHS.customers}/${customerId}`);
    const item = asRecord(this.unwrap(response, "customer"));

    const id = firstNonNullString(item.id, item.customer_id);
    return id ? this.mapCustomer(item, id) : null;
  }

  /** Lista números WhatsApp visibles para la API key/proyecto actual. */
  async listPhoneNumbers(): Promise<KapsoPhoneNumberSummary[]> {
    const response = await this.request<JsonRecord>(KAPSO_API_PATHS.phoneNumbers);
    const items = asArray<JsonRecord>(this.unwrap(response, "phone_numbers"));

    return items.map((item) => this.mapPhoneNumberSummary(item)).filter((item) => item.phoneNumberId);
  }

  /**
   * Detalle completo de un número (calidad, WABA, project/customer nested).
   *
   * @param phoneNumberId - Id externo del número.
   * @param options - Override de project/API key.
   */
  async getPhoneNumber(phoneNumberId: string, options?: KapsoApiRequestOptions): Promise<KapsoPhoneNumberDetail> {
    const response = await this.request<JsonRecord>(phoneNumberPath(phoneNumberId), "get", undefined, options);
    const item = asRecord(this.unwrap(response, "phone_number"));

    return this.mapPhoneNumberDetail(item, phoneNumberId);
  }

  /**
   * Lista webhooks configurados a nivel proyecto.
   *
   * @param options - Override de project/API key.
   */
  async listProjectWebhooks(options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary[]> {
    const response = await this.request<JsonRecord>(KAPSO_API_PATHS.projectWebhooks, "get", undefined, options);
    return this.mapWebhookCollection(response);
  }

  /**
   * Garantiza el webhook de plataforma a nivel proyecto.
   * Si ya existe con la misma URL, lo reutiliza sin crear duplicado (idempotente).
   *
   * @param options - Override de project/API key.
   */
  async ensureProjectWebhook(options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary> {
    const platformWebhookUrl = this.buildAbsoluteUrl(WEBHOOK_PATH_BY_KIND.platform);
    const existingWebhooks = await this.listProjectWebhooks(options);

    const matchingWebhook = existingWebhooks.find((webhook) => webhook.url === platformWebhookUrl);
    if (matchingWebhook) {
      return matchingWebhook;
    }

    const response = await this.request<JsonRecord>(
      KAPSO_API_PATHS.projectWebhooks,
      "post",
      {
        whatsapp_webhook: {
          url: platformWebhookUrl,
          secret_key: this.configService.getOrThrow<string>("kapso.platformWebhookSecret"),
          events: [...KAPSO_PLATFORM_EVENTS],
        },
      },
      options,
    );

    return this.mapWebhook(asRecord(this.unwrap(response, "webhook")));
  }

  /**
   * Lista webhooks ya registrados para un número concreto.
   *
   * @param phoneNumberId - Id externo del número.
   * @param options - Override de project/API key.
   */
  async listPhoneNumberWebhooks(phoneNumberId: string, options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary[]> {
    const response = await this.request<JsonRecord>(phoneNumberWebhooksPath(phoneNumberId), "get", undefined, options);
    return this.mapWebhookCollection(response);
  }

  /**
   * Crea webhook kind=kapso (eventos de mensajería) para el número.
   *
   * @param phoneNumberId - Id externo del número.
   * @param options - Override de project/API key.
   */
  createKapsoPhoneNumberWebhook(phoneNumberId: string, options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary> {
    return this.createPhoneNumberWebhook(phoneNumberId, "kapso", options);
  }

  /**
   * Crea webhook kind=meta (reenvío estilo Cloud API) para el número.
   *
   * @param phoneNumberId - Id externo del número.
   * @param options - Override de project/API key.
   */
  createMetaPhoneNumberWebhook(phoneNumberId: string, options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary> {
    return this.createPhoneNumberWebhook(phoneNumberId, "meta", options);
  }

  /**
   * Envía un mensaje de WhatsApp usando el relay Meta de Kapso.
   * Se usa para templates (contacto frío) y mensajes normales dentro de ventana 24h.
   *
   * @param phoneNumberId - Número emisor.
   * @param payload - Body Meta Cloud API (`messaging_product`, `to`, `type`, …).
   * @param options - Override de project/API key.
   */
  sendWhatsappMessage(phoneNumberId: string, payload: JsonRecord, options?: KapsoApiRequestOptions): Promise<JsonRecord> {
    return this.request<JsonRecord>(`/${phoneNumberId}/messages`, "post", payload, options, this.metaApiBaseUrl);
  }

  private async createPhoneNumberWebhook(
    phoneNumberId: string,
    kind: "kapso" | "meta",
    options?: KapsoApiRequestOptions,
  ): Promise<KapsoWebhookSummary> {
    const response = await this.request<JsonRecord>(
      phoneNumberWebhooksPath(phoneNumberId),
      "post",
      { whatsapp_webhook: this.buildPhoneNumberWebhookPayload(kind) },
      options,
    );

    return this.mapWebhook(asRecord(this.unwrap(response, "webhook")));
  }

  private buildPhoneNumberWebhookPayload(kind: "kapso" | "meta"): JsonRecord {
    const secretKey = this.configService.getOrThrow<string>("kapso.whatsappWebhookSecret");
    const base = { kind, url: this.buildAbsoluteUrl(WEBHOOK_PATH_BY_KIND[kind]), secret_key: secretKey };

    return kind === "kapso" ? { ...base, events: [...KAPSO_DEFAULT_EVENTS] } : { ...base, active: true };
  }

  /**
   * Resuelve qué API key usar, en orden de prioridad:
   * 1) override explícito en la llamada, 2) key propia del proyecto, 3) key default.
   */
  private resolveApiKey(options?: KapsoApiRequestOptions): string {
    return options?.apiKeyOverride?.trim() || (options?.projectId && this.projectApiKeys[options.projectId]) || this.defaultApiKey;
  }

  /**
   * Extrae el objeto de negocio de una respuesta Kapso, tolerando sus distintos shapes:
   * `{ data: {...} }`, `{ <entityKey>: {...} }`, o el payload plano sin envoltorio.
   */
  private unwrap(response: JsonRecord, entityKey: string): unknown {
    return response.data ?? response[entityKey] ?? response;
  }

  private buildAbsoluteUrl(pathname: string): string {
    const publicBaseUrl = this.configService.getOrThrow<string>("kapso.publicBaseUrl");
    const apiPrefix = this.configService.getOrThrow<string>("app.apiPrefix");
    return `${publicBaseUrl}/${apiPrefix}${pathname}`;
  }

  private async request<T extends JsonRecord>(
    url: string,
    method: Method = "get",
    data?: JsonRecord,
    options?: KapsoApiRequestOptions,
    baseUrlOverride?: string,
  ): Promise<T> {
    const methodLabel = method.toString().toUpperCase();
    const targetBaseUrl = baseUrlOverride ?? this.apiBaseUrl;
    const projectLabel = options?.projectId ?? "default";
    const apiKeySource = options?.apiKeyOverride?.trim()
      ? "override"
      : options?.projectId && this.projectApiKeys[options.projectId]
        ? "project"
        : "default";

    this.logger.verbose(
      `Kapso API request ${methodLabel} ${url} baseUrl=${targetBaseUrl} project=${projectLabel} apiKeySource=${apiKeySource} payload=${
        data ? summarizePayload(data) : "[no-body]"
      }`,
    );

    try {
      const response = await firstValueFrom<AxiosResponse<T>>(
        this.httpService.request<T>({
          url,
          method,
          data,
          baseURL: targetBaseUrl,
          timeout: KAPSO_HTTP_TIMEOUT_MS,
          headers: {
            "X-API-Key": this.resolveApiKey(options),
            "Content-Type": "application/json",
          },
        }),
      );

      this.logger.verbose(`Kapso API response ${methodLabel} ${url} status=${response.status} payload=${summarizePayload(response.data)}`);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = JSON.stringify(error.response?.data ?? error.message ?? "Kapso request failed");
        this.logger.error(`Kapso API error ${methodLabel} ${url} status=${status} project=${projectLabel}: ${message}`);
        throw new KapsoUpstreamException(`Kapso API error: ${message}`, error.response?.status);
      }

      // Si el error NO vino de Axios (ej: bug de programación en este mismo método),
      // no lo enmascaramos como error de Kapso: se loguea distinto y se relanza tal cual.
      this.logger.error(`Unexpected error calling Kapso API ${methodLabel} ${url} project=${projectLabel}`, error as Error);
      throw error;
    }
  }

  private mapCustomer(item: JsonRecord, idOverride?: string): KapsoCustomerSummary {
    return {
      id: idOverride ?? firstNonNullString(item.id, item.customer_id) ?? "",
      name: firstNonNullString(item.name),
      // Kapso usa snake_case ("external_id"); nuestro dominio usa camelCase ("externalId").
      // Se prueban ambas variantes por si el payload viene ya normalizado en algún caso.
      externalId: firstNonNullString(item.external_id, item.externalId),
      // raw: se conserva el payload original por si algún consumidor necesita un campo
      // que todavía no mapeamos explícitamente (evita tener que tocar este método por cada campo nuevo).
      raw: item,
    };
  }

  private mapPhoneNumberSummary(item: JsonRecord): KapsoPhoneNumberSummary {
    return {
      phoneNumberId: firstNonNullString(item.id, item.phone_number_id) ?? "",
      name: firstNonNullString(item.name),
      displayPhoneNumber: firstNonNullString(item.phone_number, item.display_phone_number),
      customerId: firstNonNullString(item.customer_id, getNestedValue(item, "customer", "id")),
      projectId: firstNonNullString(item.project_id, getNestedValue(item, "project", "id")),
      raw: item,
    };
  }

  private mapPhoneNumberDetail(item: JsonRecord, fallbackId: string): KapsoPhoneNumberDetail {
    return {
      phoneNumberId: firstNonNullString(item.id, item.phone_number_id) ?? fallbackId,
      name: firstNonNullString(item.name),
      displayPhoneNumber: firstNonNullString(item.phone_number, item.display_phone_number),
      verifiedName: firstNonNullString(item.verified_name),
      businessAccountId: firstNonNullString(item.business_account_id),
      status: firstNonNullString(item.status),
      qualityRating: firstNonNullString(item.quality_rating),
      throughputTier: firstNonNullString(item.throughput_tier),
      // Prueba "connection_type" primero, y "type" como alias legado.
      connectionType: firstNonNullString(item.connection_type, item.type),
      customerId: firstNonNullString(item.customer_id, getNestedValue(item, "customer", "id")),
      customerName: firstNonNullString(getNestedValue(item, "customer", "name")),
      customerExternalId: firstNonNullString(getNestedValue(item, "customer", "external_id")),
      projectId: firstNonNullString(item.project_id, getNestedValue(item, "project", "id")),
      projectName: firstNonNullString(getNestedValue(item, "project", "name")),
      // A diferencia de los campos de arriba (que extraen un string puntual), acá se
      // guarda el sub-objeto completo "project"/"customer" tal como vino, por si se
      // necesita algo más adelante sin tener que re-parsear "raw".
      projectPayload: asRecord(getNestedValue(item, "project")),
      customerPayload: asRecord(getNestedValue(item, "customer")),
      raw: item,
    };
  }

  private mapWebhookCollection(response: JsonRecord): KapsoWebhookSummary[] {
    const items = asArray<JsonRecord>(this.unwrap(response, "webhooks"));
    return items.map((item) => this.mapWebhook(item));
  }

  private mapWebhook(item: JsonRecord): KapsoWebhookSummary {
    const safeRaw = { ...item };
    delete safeRaw.secret_key;

    return {
      webhookId: firstNonNullString(item.id) ?? "",
      // El contrato externo limita este campo a "kapso" o "meta".
      kind: (firstNonNullString(item.kind) ?? "kapso") as "kapso" | "meta",
      url: firstNonNullString(item.url) ?? "",
      // pickBoolean con default true: si Kapso no manda el campo, asumimos activo.
      active: pickBoolean(item.active, true),
      events: asArray<string>(item.events),
      payloadVersion: firstNonNullString(item.payload_version),
      raw: safeRaw,
    };
  }
}
