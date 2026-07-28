/**
 * Controlador operativo Kapso: catálogo local, bootstrap/sync manual y redirects de setup.
 *
 * Las rutas de administración requieren rol CRM 1. Los redirects `setup/success|failure`
 * son `@Public` porque Kapso redirige el navegador del usuario sin JWT del CRM;
 * se registran en BD y disparan sync best-effort del número provisionado.
 *
 * Bootstrap y sync por número llevan throttle agresivo para no martillar la API Kapso.
 */

import { Body, Controller, Get, Header, Logger, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { Public, RequireCrmRoles } from "../../../common/auth/auth.decorators";

import { BootstrapSyncDto } from "../dto/bootstrap-sync.dto";
import { KapsoSetupStatus, KapsoSyncStatus } from "../entities/kapso-phone-number.entity";

import { firstNonNullString, isKapsoPhoneNumberAvailabilityError, summarizePayload } from "../common/kapso.helpers";

import { KapsoRepository } from "../repositories/kapso.repository";
import { KapsoSyncService } from "../services/kapso-sync.service";

type SetupQuery = Record<string, string | undefined>;

type SetupPageTone = "success" | "warning" | "failure";

type SetupPageDetail = { label: string; value: string };

type SetupPageInput = {
  title: string;
  subtitle: string;
  tone: SetupPageTone;
  details: SetupPageDetail[];
};

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Escape XSS: los query params de Kapso se renderizan en HTML al usuario final.
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);

/**
 * Endpoints bajo `/kapso` para operadores CRM y callbacks HTML de onboarding WhatsApp.
 */
@Controller("kapso")
@RequireCrmRoles(1)
export class KapsoController {
  private readonly logger = new Logger(KapsoController.name);

  constructor(
    private readonly kapsoSyncService: KapsoSyncService,
    private readonly kapsoRepository: KapsoRepository,
  ) {}

  /**
   * Lista customers Kapso ya persistidos/localizados vía repositorio.
   */
  @Get("customers")
  listCustomers() {
    return this.kapsoRepository.listCustomers();
  }

  /**
   * Lista números WhatsApp sincronizados en la BD local.
   */
  @Get("phone-numbers")
  listPhoneNumbers() {
    return this.kapsoRepository.listPhoneNumbers();
  }

  /**
   * Dispara un bootstrap completo: webhook de proyecto + sync de todos los números.
   * Throttle 2/min porque es una operación cara contra Kapso y puede crear webhooks.
   *
   * @param body - Flag opcional `ensureProjectWebhook`.
   */
  @Post("bootstrap/sync")
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  bootstrapSync(@Body() body: BootstrapSyncDto) {
    return this.kapsoSyncService.bootstrapSync(body.ensureProjectWebhook ?? true);
  }

  /**
   * Sincroniza un número puntual por id externo Kapso.
   * Throttle 10/min para acotar reintentos manuales desde el panel.
   *
   * @param phoneNumberId - Id externo del número.
   */
  @Post("phone-numbers/:phoneNumberId/sync")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  syncPhoneNumber(@Param("phoneNumberId") phoneNumberId: string) {
    return this.kapsoSyncService.syncPhoneNumberById(phoneNumberId);
  }

  /**
   * Callback público de setup exitoso (redirect Kapso → HTML).
   *
   * Registra el redirect, intenta sync inmediato del `phone_number_id` y muestra
   * una página HTML con el resultado. Si Kapso aún no expone el detalle remoto,
   * deja el numero en pendiente para el reintento de sincronizacion.
   *
   * @param query - Query params que Kapso envía en snake_case.
   * @returns HTML escapado (Content-Type text/html).
   */
  @Get("setup/success")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Public()
  async handleSetupSuccess(@Query() query: SetupQuery): Promise<string> {
    this.logger.log(`Kapso setup success redirect received query=${summarizePayload(query)}`);

    const parsed = this.parseSetupQuery(query);
    this.logger.verbose(`Kapso setup success parsed=${summarizePayload(parsed)}`);

    await this.kapsoRepository.recordSetupRedirect(
      this.buildSetupRedirectInput(query, "success", parsed.phoneNumberId ? "pending" : "missing_phone_number_id", null),
    );

    const syncOutcome = parsed.phoneNumberId
      ? await this.syncAfterSetupSuccess(query, parsed.phoneNumberId)
      : {
          pageTitle: "Sincronizacion pendiente",
          pageSubtitle: "El setup termino, pero no se recibio phone_number_id para validar el numero.",
          pageTone: "warning" as const,
          syncMessage: "No se recibio phone_number_id en el redirect.",
        };

    return this.renderSetupPage({
      title: syncOutcome.pageTitle,
      subtitle: syncOutcome.pageSubtitle,
      tone: syncOutcome.pageTone,
      details: [
        { label: "Setup link", value: parsed.setupLinkId ?? "No enviado" },
        { label: "Phone number ID", value: parsed.phoneNumberId ?? "No enviado" },
        { label: "Business account ID", value: parsed.businessAccountId ?? "No enviado" },
        { label: "Numero visible", value: parsed.displayPhoneNumber ?? "No enviado" },
        { label: "Sincronizacion", value: syncOutcome.syncMessage },
      ],
    });
  }

  /**
   * Callback público de setup fallido (redirect Kapso → HTML).
   * Solo audita el fallo; no intenta sync porque no hay número usable.
   *
   * @param query - Query params con `error_code` y metadatos parciales.
   * @returns HTML escapado (Content-Type text/html).
   */
  @Get("setup/failure")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Public()
  async handleSetupFailure(@Query() query: SetupQuery): Promise<string> {
    this.logger.warn(`Kapso setup failure redirect received query=${summarizePayload(query)}`);

    const parsed = this.parseSetupQuery(query);
    this.logger.verbose(`Kapso setup failure parsed=${summarizePayload(parsed)}`);

    await this.kapsoRepository.recordSetupRedirect(this.buildSetupRedirectInput(query, "failure", "not_started", null));

    return this.renderSetupPage({
      title: "No se pudo completar la conexion",
      subtitle: "Kapso devolvio un error durante el proceso de configuracion.",
      tone: "failure",
      details: [
        { label: "Setup link", value: parsed.setupLinkId ?? "No enviado" },
        { label: "Codigo de error", value: parsed.errorCode ?? "No enviado" },
        { label: "Phone number ID", value: parsed.phoneNumberId ?? "No enviado" },
      ],
    });
  }

  /**
   * Intenta completar la sincronización local inmediatamente después del redirect exitoso.
   * Si Kapso todavía no expone el detalle remoto, el resultado queda como pendiente
   * y el worker de reintentos podrá completarlo más adelante.
   */
  private async syncAfterSetupSuccess(
    query: SetupQuery,
    phoneNumberId: string,
  ): Promise<{
    pageTitle: string;
    pageSubtitle: string;
    pageTone: SetupPageTone;
    syncMessage: string;
  }> {
    try {
      const syncResult = await this.kapsoSyncService.syncPhoneNumberById(phoneNumberId);
      const syncStatus = this.resolveSetupSyncStatus(syncResult);
      const syncError = syncResult?.setupSyncError ?? syncResult?.lastProcessingError ?? null;

      await this.kapsoRepository.recordSetupRedirect(this.buildSetupRedirectInput(query, "success", syncStatus, syncError));

      return this.buildSetupSuccessResponse(phoneNumberId, syncStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";

      if (isKapsoPhoneNumberAvailabilityError(message)) {
        await this.kapsoRepository.recordSetupRedirect(this.buildSetupRedirectInput(query, "success", "pending_remote_sync", message));

        return {
          pageTitle: "Sincronizacion pendiente",
          pageSubtitle: "La configuracion termino en Kapso, pero el detalle del numero todavia no esta disponible.",
          pageTone: "warning",
          syncMessage:
            "El setup termino correctamente. Kapso aun no expone el detalle remoto del numero, asi que la sincronizacion quedo pendiente para reintento.",
        };
      }

      await this.kapsoRepository.recordSetupRedirect(this.buildSetupRedirectInput(query, "success", "sync_failed", message));

      return {
        pageTitle: "Sincronizacion fallida",
        pageSubtitle: "La configuracion termino en Kapso, pero la sincronizacion local no pudo completarse.",
        pageTone: "failure",
        syncMessage: `El setup termino, pero la sincronizacion fallo: ${message}`,
      };
    }
  }

  /** Traduce el estado de sync a copy/tono de la página HTML de éxito. */
  private buildSetupSuccessResponse(
    phoneNumberId: string,
    syncStatus: KapsoSyncStatus | string,
  ): {
    pageTitle: string;
    pageSubtitle: string;
    pageTone: SetupPageTone;
    syncMessage: string;
  } {
    if (syncStatus === "pending_remote_sync") {
      return {
        pageTitle: "Sincronizacion pendiente",
        pageSubtitle: "La configuracion termino en Kapso, pero el numero aun no esta completamente sincronizado.",
        pageTone: "warning",
        syncMessage:
          "El numero quedo registrado y el API seguira reintentando automaticamente hasta completar el detalle remoto y los webhooks.",
      };
    }

    if (syncStatus === "processed_with_warnings") {
      return {
        pageTitle: "Sincronizacion pendiente",
        pageSubtitle: "El numero ya existe, pero aun faltan validaciones o webhooks por confirmar.",
        pageTone: "warning",
        syncMessage:
          "El numero se sincronizo parcialmente y el API seguira reintentando automaticamente hasta confirmar los webhooks requeridos.",
      };
    }

    if (syncStatus === "processed" || syncStatus === "synced") {
      return {
        pageTitle: "WhatsApp conectado",
        pageSubtitle: "La configuracion del numero termino correctamente en Kapso y la sincronizacion local fue confirmada.",
        pageTone: "success",
        syncMessage: `Numero sincronizado correctamente: ${phoneNumberId}`,
      };
    }

    if (syncStatus === "sync_failed") {
      return {
        pageTitle: "Sincronizacion fallida",
        pageSubtitle: "La configuracion termino en Kapso, pero la sincronizacion local no pudo completarse.",
        pageTone: "failure",
        syncMessage: "La configuracion termino en Kapso, pero la sincronizacion local fallo con un error terminal.",
      };
    }

    return {
      pageTitle: "Sincronizacion pendiente",
      pageSubtitle: "La configuracion termino en Kapso, pero la sincronizacion aun no se confirma.",
      pageTone: "warning",
      syncMessage:
        "La configuracion termino en Kapso y el API seguira validando el estado real del numero antes de marcarlo como completo.",
    };
  }

  /** Normaliza setupSyncStatus / lastProcessingStatus a un estado de UI único. */
  private resolveSetupSyncStatus(
    syncResult: {
      setupSyncStatus?: string | null;
      lastProcessingStatus?: string | null;
    } | null,
  ): KapsoSyncStatus | string {
    const setupSyncStatus = syncResult?.setupSyncStatus ?? null;
    const lastProcessingStatus = syncResult?.lastProcessingStatus ?? null;

    if (setupSyncStatus === "pending_remote_sync" || lastProcessingStatus === "pending_remote_sync") {
      return "pending_remote_sync";
    }

    if (setupSyncStatus === "processed_with_warnings" || lastProcessingStatus === "processed_with_warnings") {
      return "processed_with_warnings";
    }

    if (setupSyncStatus === "processed") {
      return "processed";
    }

    if (setupSyncStatus === "synced") {
      return "synced";
    }

    if (setupSyncStatus === "sync_failed" || lastProcessingStatus === "failed") {
      return "sync_failed";
    }

    if (setupSyncStatus === "missing_phone_number_id") {
      return "missing_phone_number_id";
    }

    return "pending";
  }

  /** Normaliza los nombres de query params que Kapso puede devolver en snake_case. */
  private parseSetupQuery(query: SetupQuery) {
    return {
      setupLinkId: firstNonNullString(query.setup_link_id),
      phoneNumberId: firstNonNullString(query.phone_number_id),
      businessAccountId: firstNonNullString(query.business_account_id),
      whatsappConfigId: firstNonNullString(query.whatsapp_config_id),
      provisionedPhoneNumberId: firstNonNullString(query.provisioned_phone_number_id),
      displayPhoneNumber: firstNonNullString(query.display_phone_number),
      errorCode: firstNonNullString(query.error_code),
    };
  }

  /** Arma el DTO de auditoría del redirect de setup para el repositorio. */
  private buildSetupRedirectInput(
    query: SetupQuery,
    status: KapsoSetupStatus,
    syncStatus: KapsoSyncStatus | string,
    syncError: string | null,
  ) {
    const parsed = this.parseSetupQuery(query);

    return {
      status,
      setupLinkId: parsed.setupLinkId,
      phoneNumberId: parsed.phoneNumberId,
      businessAccountId: parsed.businessAccountId,
      whatsappConfigId: parsed.whatsappConfigId,
      provisionedPhoneNumberId: parsed.provisionedPhoneNumberId,
      displayPhoneNumber: parsed.displayPhoneNumber,
      errorCode: status === "failure" ? parsed.errorCode : null,
      syncStatus,
      syncError,
      queryJson: query,
    };
  }

  /**
   * Renderiza la página HTML de resultado de setup.
   * Todos los textos dinámicos pasan por `escapeHtml` para evitar XSS vía query string.
   */
  private renderSetupPage(input: SetupPageInput): string {
    const accentColor = input.tone === "success" ? "#198754" : input.tone === "warning" ? "#b7791f" : "#dc3545";
    const detailsHtml = input.details
      .map(
        (detail) => `
          <div style="padding:12px 0;border-bottom:1px solid #e9ecef;">
            <div style="font-size:12px;color:#6c757d;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(detail.label)}</div>
            <div style="font-size:15px;color:#212529;margin-top:4px;word-break:break-word;">${escapeHtml(detail.value)}</div>
          </div>`,
      )
      .join("");

    const badgeText =
      input.tone === "success" ? "CONFIGURACION EXITOSA" : input.tone === "warning" ? "SINCRONIZACION PENDIENTE" : "CONFIGURACION FALLIDA";

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#f5f7fb;font-family:Segoe UI,Arial,sans-serif;color:#212529;">
    <div style="max-width:720px;margin:48px auto;padding:0 20px;">
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;box-shadow:0 16px 50px rgba(15,23,42,.08);">
        <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:${accentColor}15;color:${accentColor};font-weight:700;font-size:12px;">
          ${badgeText}
        </div>
        <h1 style="margin:18px 0 8px;font-size:32px;line-height:1.1;">${escapeHtml(input.title)}</h1>
        <p style="margin:0 0 22px;font-size:16px;color:#4b5563;">${escapeHtml(input.subtitle)}</p>
        <div>${detailsHtml}</div>
      </div>
    </div>
  </body>
</html>`;
  }
}
