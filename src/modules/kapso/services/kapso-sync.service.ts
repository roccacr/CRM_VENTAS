/**
 * Fachada de orquestación Kapso hacia controllers y webhooks.
 *
 * No implementa lógica propia: delega sync de números a `KapsoPhoneNumberSyncService`
 * y automatización de leads a `KapsoLeadAutomationService`. Existe para mantener
 * una API estable de módulo y evitar acoplar controllers a varios services internos.
 */

import { Injectable } from "@nestjs/common";

import { JsonRecord } from "../common/kapso.types";
import { KapsoLeadAutomationService } from "./kapso-lead-automation.service";
import { KapsoPhoneNumberSyncService } from "./kapso-phone-number-sync.service";

/**
 * Punto único de entrada de negocio para sync bootstrap, eventos de número y leads.
 */
@Injectable()
export class KapsoSyncService {
  constructor(
    private readonly phoneNumberSyncService: KapsoPhoneNumberSyncService,
    private readonly leadAutomationService: KapsoLeadAutomationService,
  ) {}

  /**
   * Sincroniza catálogo remoto (webhook de proyecto + todos los números).
   *
   * @param ensureProjectWebhook - Si debe garantizar el webhook de plataforma.
   */
  bootstrapSync(ensureProjectWebhook = true) {
    return this.phoneNumberSyncService.bootstrapSync(ensureProjectWebhook);
  }

  /**
   * Sincroniza un número WhatsApp concreto desde la API Kapso.
   *
   * @param phoneNumberId - Id externo del número en Kapso/Meta.
   * @param explicitProjectId - Project id opcional para elegir API key correcta.
   */
  syncPhoneNumberById(phoneNumberId: string, explicitProjectId?: string | null) {
    return this.phoneNumberSyncService.syncPhoneNumberById(phoneNumberId, explicitProjectId);
  }

  /**
   * Maneja el evento de plataforma `whatsapp.phone_number.created`.
   *
   * @param payload - Body del webhook de plataforma.
   */
  handlePhoneNumberCreatedEvent(payload: JsonRecord) {
    return this.phoneNumberSyncService.handlePhoneNumberCreatedEvent(payload);
  }

  /**
   * Maneja el evento de plataforma `whatsapp.phone_number.deleted`.
   *
   * @param payload - Body del webhook de plataforma.
   */
  handlePhoneNumberDeletedEvent(payload: JsonRecord) {
    return this.phoneNumberSyncService.handlePhoneNumberDeletedEvent(payload);
  }

  /**
   * Worker: reintenta números en `pending_remote_sync` cuando Kapso ya expone detalle.
   */
  processPendingRemoteSyncs() {
    return this.phoneNumberSyncService.processPendingRemoteSyncs();
  }

  /**
   * Procesa mensajes entrantes (Kapso events / Meta) para avanzar flujos de lead.
   *
   * @param payload - Body del webhook de mensajería.
   */
  processInboundMessageWebhook(payload: JsonRecord) {
    return this.leadAutomationService.processInboundMessageWebhook(payload);
  }

  /**
   * Worker: reserva y envía plantillas iniciales a candidatos de lead.
   */
  processLeadTemplateCandidates() {
    return this.leadAutomationService.processLeadTemplateCandidates();
  }
}
