// ============================================================================
// IMPORTS
// ============================================================================

// HttpException: para traducir errores de Kapso a errores HTTP estándar de Nest.
// Injectable: decorador que marca esta clase como un provider inyectable por Nest.
// Logger: logger nativo de Nest, con niveles (log, error, warn, verbose, debug).
import { HttpException, Injectable, Logger } from "@nestjs/common";

// ConfigService: acceso tipado a las variables de entorno / configuración de la app.
import { ConfigService } from "@nestjs/config";

// HttpService: wrapper de Nest sobre Axios. Se inyecta por DI (testeable con mocks)
// en vez de instanciar Axios a mano.
import { HttpService } from "@nestjs/axios";

// axios: se importa solo para usar su type guard `isAxiosError` y el tipo `Method`.
// No se crea ninguna instancia de Axios manualmente en este archivo.
import axios, { AxiosResponse, Method } from "axios";

// firstValueFrom: convierte el Observable que retorna HttpService en una Promise,
// para poder usar async/await en vez de manejar streams RxJS.
import { firstValueFrom } from "rxjs";

// Listas de eventos que Kapso debe enviar a cada tipo de webhook (definidas en un
// archivo de constantes propio del módulo, para no hardcodear arrays acá).
import { KAPSO_DEFAULT_EVENTS, KAPSO_PLATFORM_EVENTS } from "../common/kapso.constants";

// Helpers puros de normalización de datos (sin dependencias de Nest), reutilizados
// en todos los métodos "mapX" de este servicio.
import { asArray, asRecord, firstNonNullString, getNestedValue, pickBoolean, pickString } from "../common/kapso.helpers";

// Tipos TypeScript propios del dominio Kapso (contratos internos del CRM).
import {
  JsonRecord,
  KapsoApiRequestOptions,
  KapsoCustomerSummary,
  KapsoPhoneNumberDetail,
  KapsoPhoneNumberSummary,
  KapsoWebhookSummary,
} from "../common/kapso.types";

// ============================================================================
// CONSTANTES DE MÓDULO
// ============================================================================

// Tiempo máximo (en milisegundos) que se espera una respuesta de Kapso antes de
// abortar la request. 10 segundos es razonable para una API externa síncrona.
const KAPSO_HTTP_TIMEOUT_MS = 10_000;

// Rutas relativas de LOS WEBHOOKS QUE ESTA API EXPONE (no las de Kapso), indexadas
// por el tipo de webhook para poder hacer WEBHOOK_PATH_BY_KIND[kind] más abajo.
const WEBHOOK_PATH_BY_KIND = {
  platform: "/webhooks/kapso/platform", // Webhook a nivel de proyecto completo.
  kapso: "/webhooks/kapso/events", // Webhook de eventos de mensajería (kind: kapso).
  meta: "/webhooks/kapso/meta", // Webhook de reenvío de eventos Meta (kind: meta).
} as const; // "as const" congela los valores como literales, no como "string" genérico.

// Rutas relativas de LA API DE KAPSO que este servicio consume (endpoints remotos).
const KAPSO_API_PATHS = {
  customers: "/customers",
  phoneNumbers: "/whatsapp/phone_numbers",
  projectWebhooks: "/whatsapp/webhooks",
} as const;

// Helper de una línea: arma la ruta de detalle de un número dado su ID.
const phoneNumberPath = (phoneNumberId: string) => `${KAPSO_API_PATHS.phoneNumbers}/${phoneNumberId}`;

// Helper de una línea: arma la ruta de webhooks asociados a un número específico.
const phoneNumberWebhooksPath = (phoneNumberId: string) => `${phoneNumberPath(phoneNumberId)}/webhooks`;

/**
 * Cliente HTTP hacia Kapso Platform API.
 * Normaliza respuestas heterogéneas (snake_case / anidados) a tipos internos del CRM.
 */
@Injectable() // Registra la clase en el contenedor de DI de Nest.
export class KapsoPlatformApiService {
  // Logger con contexto = nombre de la clase, para que cada línea de log diga
  // de dónde salió (aparece como [KapsoPlatformApiService] en la consola).
  private readonly logger = new Logger(KapsoPlatformApiService.name);

  // URL base de la API de Kapso, leída una sola vez en el constructor.
  private readonly apiBaseUrl: string;

  // URL base del relay Meta/WhatsApp de Kapso para mensajes normales.
  private readonly metaApiBaseUrl: string;

  // API key global/default, usada cuando no hay override ni key específica de proyecto.
  private readonly defaultApiKey: string;

  // Mapa projectId -> apiKey, para clientes multi-tenant con key propia por proyecto.
  private readonly projectApiKeys: Record<string, string>;

  constructor(
    // Cliente HTTP inyectado por Nest (requiere HttpModule importado en el módulo).
    private readonly httpService: HttpService,
    // Servicio de configuración inyectado por Nest.
    private readonly configService: ConfigService,
  ) {
    // getOrThrow: lee la config y lanza error en boot si la variable no existe
    // (falla rápido al arrancar la app, no en medio de una request de usuario).
    this.apiBaseUrl = this.configService.getOrThrow<string>("kapso.apiBaseUrl");
    this.metaApiBaseUrl = this.configService.getOrThrow<string>("kapso.metaApiBaseUrl");
    this.defaultApiKey = this.configService.getOrThrow<string>("kapso.apiKey");
    // get (sin Throw) + "?? {}": esta config es opcional, si no existe usamos objeto vacío.
    this.projectApiKeys = this.configService.get<Record<string, string>>("kapso.projectApiKeys") ?? {};
  }

  // --------------------------------------------------------------------------
  // CUSTOMERS
  // --------------------------------------------------------------------------

  /** Lista todos los customers registrados en Kapso. */
  async listCustomers(): Promise<KapsoCustomerSummary[]> {
    // GET a /customers. Sin body, sin options (usa la API key default).
    const response = await this.request<JsonRecord>(KAPSO_API_PATHS.customers);
    // Kapso puede devolver el array en distintas keys; unwrap() tolera eso.
    // asArray() garantiza que el resultado sea un array aunque venga null/undefined.
    const items = asArray<JsonRecord>(this.unwrap(response, "customers"));

    // Mapea cada item crudo de Kapso a nuestro tipo interno KapsoCustomerSummary.
    return items.map((item) => this.mapCustomer(item));
  }

  /** Busca un customer puntual por su ID. Devuelve null si Kapso no trae un id válido. */
  async getCustomer(customerId: string): Promise<KapsoCustomerSummary | null> {
    // GET a /customers/{id}.
    const response = await this.request<JsonRecord>(`${KAPSO_API_PATHS.customers}/${customerId}`);
    // asRecord() garantiza un objeto plano aunque la respuesta venga rara.
    const item = asRecord(this.unwrap(response, "customer"));

    // Kapso a veces usa "id", a veces "customer_id": probamos ambos en orden.
    const id = firstNonNullString(item.id, item.customer_id);
    // Si no hay id válido, no tiene sentido devolver un objeto "fantasma".
    return id ? this.mapCustomer(item, id) : null;
  }

  // --------------------------------------------------------------------------
  // PHONE NUMBERS
  // --------------------------------------------------------------------------

  /** Lista los números de WhatsApp conectados en Kapso. */
  async listPhoneNumbers(): Promise<KapsoPhoneNumberSummary[]> {
    const response = await this.request<JsonRecord>(KAPSO_API_PATHS.phoneNumbers);
    const items = asArray<JsonRecord>(this.unwrap(response, "phone_numbers"));

    // Mapea cada número y descarta los que no tengan phoneNumberId (datos corruptos
    // o incompletos del lado de Kapso no deberían romper el listado completo).
    return items.map((item) => this.mapPhoneNumberSummary(item)).filter((item) => item.phoneNumberId);
  }

  /** Trae el detalle completo de un número específico. */
  async getPhoneNumber(phoneNumberId: string, options?: KapsoApiRequestOptions): Promise<KapsoPhoneNumberDetail> {
    // Acá sí se pasan "options": puede requerir la API key de un proyecto puntual.
    const response = await this.request<JsonRecord>(phoneNumberPath(phoneNumberId), "get", undefined, options);
    const item = asRecord(this.unwrap(response, "phone_number"));

    // fallbackId: si Kapso no trae "id" en el payload, usamos el que ya conocíamos.
    return this.mapPhoneNumberDetail(item, phoneNumberId);
  }

  // --------------------------------------------------------------------------
  // WEBHOOKS
  // --------------------------------------------------------------------------

  /** Lista los webhooks configurados a nivel de todo el proyecto Kapso. */
  async listProjectWebhooks(options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary[]> {
    const response = await this.request<JsonRecord>(KAPSO_API_PATHS.projectWebhooks, "get", undefined, options);
    // mapWebhookCollection ya hace el unwrap + map, por eso no se repite acá.
    return this.mapWebhookCollection(response);
  }

  /**
   * Garantiza el webhook de plataforma a nivel proyecto.
   * Si ya existe con la misma URL, lo reutiliza sin crear duplicado (idempotente).
   */
  async ensureProjectWebhook(options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary> {
    // URL pública absoluta a la que Kapso debe pegarle (nuestro propio endpoint).
    const platformWebhookUrl = this.buildAbsoluteUrl(WEBHOOK_PATH_BY_KIND.platform);
    // Traemos los webhooks actuales para chequear si ya existe antes de crear uno nuevo.
    const existingWebhooks = await this.listProjectWebhooks(options);

    // Buscamos por URL exacta: si coincide, es el mismo webhook (no hace falta recrearlo).
    const matchingWebhook = existingWebhooks.find((webhook) => webhook.url === platformWebhookUrl);
    if (matchingWebhook) {
      // Early return: operación idempotente, no se crea nada si ya existe.
      return matchingWebhook;
    }

    // No existía: lo creamos vía POST.
    const response = await this.request<JsonRecord>(
      KAPSO_API_PATHS.projectWebhooks, // endpoint remoto de Kapso
      "post", // método HTTP
      {
        // Body esperado por Kapso, envuelto en la key "whatsapp_webhook".
        whatsapp_webhook: {
          url: platformWebhookUrl,
          // Secreto usado por Kapso para firmar el payload (lo validamos al recibir).
          secret_key: this.configService.getOrThrow<string>("kapso.platformWebhookSecret"),
          // Spread de un array readonly a uno mutable, tal como lo pide el tipo del body.
          events: [...KAPSO_PLATFORM_EVENTS],
        },
      },
      options, // permite override de API key si aplica.
    );

    // Convertimos la respuesta cruda de Kapso a nuestro tipo interno de webhook.
    return this.mapWebhook(asRecord(this.unwrap(response, "webhook")));
  }

  /** Lista los webhooks configurados para un número de WhatsApp específico. */
  async listPhoneNumberWebhooks(phoneNumberId: string, options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary[]> {
    const response = await this.request<JsonRecord>(phoneNumberWebhooksPath(phoneNumberId), "get", undefined, options);
    return this.mapWebhookCollection(response);
  }

  /**
   * Crea webhook `kind: kapso` (eventos de mensajería) para un número.
   * Método público delgado: delega toda la lógica real a createPhoneNumberWebhook.
   */
  createKapsoPhoneNumberWebhook(phoneNumberId: string, options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary> {
    // No lleva "await" porque simplemente retorna la Promise interna tal cual.
    return this.createPhoneNumberWebhook(phoneNumberId, "kapso", options);
  }

  /**
   * Crea webhook `kind: meta` (reenvío de eventos Meta hacia esta API) para un número.
   * Mismo patrón que el método anterior, solo cambia el "kind".
   */
  createMetaPhoneNumberWebhook(phoneNumberId: string, options?: KapsoApiRequestOptions): Promise<KapsoWebhookSummary> {
    return this.createPhoneNumberWebhook(phoneNumberId, "meta", options);
  }

  /**
   * Envia un mensaje normal de WhatsApp usando el relay Meta de Kapso.
   * Se usa solo cuando el cliente ya abrió ventana de conversación al responder.
   */
  sendWhatsappMessage(phoneNumberId: string, payload: JsonRecord, options?: KapsoApiRequestOptions): Promise<JsonRecord> {
    return this.request<JsonRecord>(`/${phoneNumberId}/messages`, "post", payload, options, this.metaApiBaseUrl);
  }

  /**
   * Lógica real y compartida de creación de webhooks de número.
   * "kapso" y "meta" solo difieren en el payload (ver buildPhoneNumberWebhookPayload),
   * por eso no hay dos métodos separados con el 90% del código duplicado.
   */
  private async createPhoneNumberWebhook(
    phoneNumberId: string,
    kind: "kapso" | "meta", // union type: solo estos dos valores son válidos.
    options?: KapsoApiRequestOptions,
  ): Promise<KapsoWebhookSummary> {
    const response = await this.request<JsonRecord>(
      phoneNumberWebhooksPath(phoneNumberId),
      "post",
      // El payload varía según "kind"; se arma en un método aparte para no
      // meter un if/else largo acá adentro.
      { whatsapp_webhook: this.buildPhoneNumberWebhookPayload(kind) },
      options,
    );

    return this.mapWebhook(asRecord(this.unwrap(response, "webhook")));
  }

  /**
   * Arma el payload específico de cada tipo de webhook de número.
   * "meta" no lleva "events" pero sí "active"; "kapso" es al revés.
   */
  private buildPhoneNumberWebhookPayload(kind: "kapso" | "meta"): JsonRecord {
    // El secret_key es común a ambos tipos, se lee una sola vez.
    const secretKey = this.configService.getOrThrow<string>("kapso.whatsappWebhookSecret");
    // Campos comunes a ambos payloads.
    const base = { kind, url: this.buildAbsoluteUrl(WEBHOOK_PATH_BY_KIND[kind]), secret_key: secretKey };

    // Operador ternario: agrega el campo diferencial según el tipo.
    return kind === "kapso"
      ? { ...base, events: [...KAPSO_DEFAULT_EVENTS] } // kapso: necesita lista de eventos.
      : { ...base, active: true }; // meta: solo necesita quedar activo.
  }

  // ============================================================================
  // INFRAESTRUCTURA HTTP INTERNA (privada, no se expone fuera del servicio)
  // ============================================================================

  /**
   * Resuelve qué API key usar, en orden de prioridad:
   * 1) override explícito en la llamada, 2) key propia del proyecto, 3) key default.
   */
  private resolveApiKey(options?: KapsoApiRequestOptions): string {
    return (
      // trim() + truthy check: ignora overrides vacíos o solo espacios en blanco.
      options?.apiKeyOverride?.trim() ||
      // Si hay projectId Y ese proyecto tiene key propia configurada, se usa esa.
      (options?.projectId && this.projectApiKeys[options.projectId]) ||
      // Fallback final: la key global de la cuenta.
      this.defaultApiKey
    );
  }

  /**
   * Extrae el objeto de negocio de una respuesta Kapso, tolerando sus distintos shapes:
   * `{ data: {...} }`, `{ <entityKey>: {...} }`, o el payload plano sin envoltorio.
   */
  private unwrap(response: JsonRecord, entityKey: string): unknown {
    // Operador ?? (nullish coalescing): prueba cada opción en orden, se queda
    // con la primera que no sea null/undefined.
    return response.data ?? response[entityKey] ?? response;
  }

  /** Construye una URL pública absoluta: `{publicBaseUrl}/{apiPrefix}{pathname}`. */
  private buildAbsoluteUrl(pathname: string): string {
    const publicBaseUrl = this.configService.getOrThrow<string>("kapso.publicBaseUrl");
    const apiPrefix = this.configService.getOrThrow<string>("app.apiPrefix");
    // Template string: concatena las tres partes en la URL final.
    return `${publicBaseUrl}/${apiPrefix}${pathname}`;
  }

  /**
   * Wrapper HTTP único del módulo: TODAS las llamadas a Kapso pasan por acá.
   * Centraliza timeout, headers, y la traducción de errores Axios a HttpException.
   */
  private async request<T extends JsonRecord>(
    url: string, // path relativo (ej: "/customers").
    method: Method = "get", // método HTTP, default GET.
    data?: JsonRecord, // body de la request (solo aplica a POST).
    options?: KapsoApiRequestOptions, // override de API key / projectId.
    baseUrlOverride?: string, // permite reutilizar el wrapper para Platform y Meta relay.
  ): Promise<T> {
    try {
      // firstValueFrom espera el primer (y único) valor emitido por el Observable
      // que retorna httpService.request(), y lo convierte en una Promise resuelta.
      const response = await firstValueFrom<AxiosResponse<T>>(
        this.httpService.request<T>({
          url,
          method,
          data,
          baseURL: baseUrlOverride ?? this.apiBaseUrl, // se pasa por request, no hace falta instancia propia.
          timeout: KAPSO_HTTP_TIMEOUT_MS,
          headers: {
            // Header propietario que exige la API de Kapso para autenticar.
            "X-API-Key": this.resolveApiKey(options),
            "Content-Type": "application/json",
          },
        }),
      );

      // Devolvemos directamente el body ya parseado por Axios.
      return response.data;
    } catch (error) {
      // Type guard oficial de Axios: si es true, TypeScript sabe que "error"
      // tiene la forma de AxiosError (con .response, .message, etc).
      if (axios.isAxiosError(error)) {
        // status 500 como fallback si Kapso no llegó a responder (timeout, red caída).
        const status = error.response?.status ?? 500;
        // JSON.stringify para loguear el body de error de Kapso de forma legible.
        const message = JSON.stringify(error.response?.data ?? error.message ?? "Kapso request failed");
        // Único log de error del servicio: necesario para diagnosticar en producción.
        this.logger.error(`Kapso API error ${method.toString().toUpperCase()} ${url}: ${message}`);
        // Se relanza como HttpException para que el resto de Nest (filtros globales,
        // interceptores) lo trate como un error HTTP estándar.
        throw new HttpException(`Kapso API error: ${message}`, status);
      }

      // Si el error NO vino de Axios (ej: bug de programación en este mismo método),
      // no lo enmascaramos como error de Kapso: se loguea distinto y se relanza tal cual.
      this.logger.error(`Unexpected error calling Kapso API ${method.toString().toUpperCase()} ${url}`, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // NORMALIZADORES: traducen el shape crudo de Kapso a los tipos internos del CRM
  // ============================================================================

  /** Normaliza un customer crudo de Kapso a KapsoCustomerSummary. */
  private mapCustomer(item: JsonRecord, idOverride?: string): KapsoCustomerSummary {
    return {
      // idOverride tiene prioridad (viene de getCustomer, donde ya se validó el id).
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

  /** Normaliza un número de WhatsApp en su forma "resumida" (para listados). */
  private mapPhoneNumberSummary(item: JsonRecord): KapsoPhoneNumberSummary {
    return {
      phoneNumberId: firstNonNullString(item.id, item.phone_number_id) ?? "",
      name: firstNonNullString(item.name),
      displayPhoneNumber: firstNonNullString(item.phone_number, item.display_phone_number),
      // getNestedValue: navega objetos anidados sin explotar si algún nivel es undefined
      // (ej: item.customer podría no existir).
      customerId: firstNonNullString(item.customer_id, getNestedValue(item, "customer", "id")),
      projectId: firstNonNullString(item.project_id, getNestedValue(item, "project", "id")),
      raw: item,
    };
  }

  /** Normaliza el detalle COMPLETO de un número (para persistencia local, más campos que el summary). */
  private mapPhoneNumberDetail(item: JsonRecord, fallbackId: string): KapsoPhoneNumberDetail {
    return {
      // fallbackId: se usa el id que ya conocíamos si Kapso no lo repite en el detalle.
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

  /** Tolera respuestas de Kapso con `data`, `webhooks`, o un array plano directo. */
  private mapWebhookCollection(response: JsonRecord): KapsoWebhookSummary[] {
    const items = asArray<JsonRecord>(this.unwrap(response, "webhooks"));
    // map() aplica mapWebhook a cada elemento, devolviendo un array nuevo normalizado.
    return items.map((item) => this.mapWebhook(item));
  }

  /** Normaliza un webhook individual, ya sea de tipo "kapso" o "meta". */
  private mapWebhook(item: JsonRecord): KapsoWebhookSummary {
    return {
      webhookId: firstNonNullString(item.id) ?? "",
      // Cast explícito: firstNonNullString devuelve string genérico, pero sabemos
      // que Kapso solo puede mandar "kapso" o "meta" en este campo.
      kind: (firstNonNullString(item.kind) ?? "kapso") as "kapso" | "meta",
      url: firstNonNullString(item.url) ?? "",
      // pickBoolean con default true: si Kapso no manda el campo, asumimos activo.
      active: pickBoolean(item.active, true),
      // pickString (sin default null): a diferencia de firstNonNullString, no
      // fuerza un fallback, puede devolver undefined si no vino secret_key.
      secretKey: pickString(item.secret_key),
      events: asArray<string>(item.events),
      payloadVersion: firstNonNullString(item.payload_version),
      raw: item,
    };
  }
}
