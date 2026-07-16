// ============================================================================
// IMPORTS
// ============================================================================

// Dependencias Nest y TypeORM para acceso persistente a `kapso_phone_numbers`.
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import {
  KapsoPhoneNumberEntity,
  KapsoProcessingStatus,
  KapsoSetupStatus,
  KapsoSyncStatus,
  KapsoWebhookScope,
} from "../entities/kapso-phone-number.entity";
import { JsonRecord } from "../common/kapso.types";

// ============================================================================
// TIPOS DE ENTRADA
// ============================================================================

/** Datos necesarios para crear o actualizar un numero sincronizado desde Kapso. */
export type UpsertPhoneNumberInput = {
  phoneNumberId: string;
  phoneNumberName: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  businessAccountId: string | null;
  status: string | null;
  qualityRating: string | null;
  throughputTier: string | null;
  connectionType: string | null;
  active?: boolean;
  rawPayload: JsonRecord;
  projectExternalId: string | null;
  projectName: string | null;
  projectPayload?: JsonRecord | null;
  kapsoCustomerId: string | null;
  customerName: string | null;
  customerExternalId: string | null;
  customerPayload?: JsonRecord | null;
  whatsappConfigId?: string | null;
  setupLinkId?: string | null;
  provisionedPhoneNumberId?: string | null;
  setupStatus?: KapsoSetupStatus | string | null;
  setupErrorCode?: string | null;
  setupSyncStatus?: KapsoSyncStatus | string | null;
  setupSyncError?: string | null;
  lastSetupQueryJson?: JsonRecord | null;
};

/** Datos de auditoria al recibir un webhook de plataforma, Kapso o Meta. */
export type TouchWebhookEventInput = {
  scope: KapsoWebhookScope | string;
  eventName: string | null;
  phoneNumberId: string;
  projectExternalId?: string | null;
  projectPayload?: JsonRecord | null;
  kapsoCustomerId?: string | null;
  customerPayload?: JsonRecord | null;
  idempotencyKey?: string | null;
  signatureValid?: boolean | null;
  processingStatus: KapsoProcessingStatus | string;
  processingError?: string | null;
  payloadJson: JsonRecord;
};

/** Datos persistidos al recibir un redirect de setup success o failure. */
export type RecordSetupRedirectInput = {
  status: KapsoSetupStatus;
  setupLinkId: string | null;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  whatsappConfigId: string | null;
  provisionedPhoneNumberId: string | null;
  displayPhoneNumber: string | null;
  errorCode: string | null;
  syncStatus: KapsoSyncStatus | string;
  syncError?: string | null;
  queryJson: JsonRecord;
};

// ============================================================================
// REPOSITORIO
// ============================================================================

/**
 * Acceso a datos de `kapso_phone_numbers`.
 *
 * Este repositorio concentra toda la persistencia del modulo Kapso:
 * - upsert de numeros;
 * - auditoria de webhooks;
 * - auditoria de setup redirects;
 * - consultas para workers y endpoints.
 */
@Injectable()
export class KapsoRepository {
  private readonly logger = new Logger(KapsoRepository.name);

  constructor(
    @InjectRepository(KapsoPhoneNumberEntity)
    private readonly phoneNumberRepository: Repository<KapsoPhoneNumberEntity>,
  ) {}

  // --------------------------------------------------------------------------
  // UPSERT PRINCIPAL DEL NUMERO
  // --------------------------------------------------------------------------

  /** Crea o actualiza un numero con datos traidos desde Kapso Platform API. */
  async upsertPhoneNumber(input: UpsertPhoneNumberInput) {
    const phoneNumber = await this.findOrCreateByPhoneNumberId(input.phoneNumberId);

    phoneNumber.phoneNumberName = input.phoneNumberName;
    phoneNumber.displayPhoneNumber = input.displayPhoneNumber;
    phoneNumber.verifiedName = input.verifiedName;
    phoneNumber.businessAccountId = input.businessAccountId;
    phoneNumber.status = input.status;
    phoneNumber.qualityRating = input.qualityRating;
    phoneNumber.throughputTier = input.throughputTier;
    phoneNumber.connectionType = input.connectionType;
    phoneNumber.active = input.active ?? true;
    phoneNumber.rawPayload = input.rawPayload;
    phoneNumber.projectExternalId = input.projectExternalId ?? phoneNumber.projectExternalId ?? null;
    phoneNumber.projectName = input.projectName ?? phoneNumber.projectName ?? null;
    phoneNumber.projectPayload = input.projectPayload ?? phoneNumber.projectPayload ?? null;
    phoneNumber.kapsoCustomerId = input.kapsoCustomerId ?? phoneNumber.kapsoCustomerId ?? null;
    phoneNumber.customerName = input.customerName ?? phoneNumber.customerName ?? null;
    phoneNumber.customerExternalId = input.customerExternalId ?? phoneNumber.customerExternalId ?? null;
    phoneNumber.customerPayload = input.customerPayload ?? phoneNumber.customerPayload ?? null;
    phoneNumber.whatsappConfigId = input.whatsappConfigId ?? phoneNumber.whatsappConfigId ?? null;
    phoneNumber.setupLinkId = input.setupLinkId ?? phoneNumber.setupLinkId ?? null;
    phoneNumber.provisionedPhoneNumberId = input.provisionedPhoneNumberId ?? phoneNumber.provisionedPhoneNumberId ?? null;
    phoneNumber.setupStatus = input.setupStatus ?? phoneNumber.setupStatus ?? null;
    phoneNumber.setupErrorCode = input.setupErrorCode ?? phoneNumber.setupErrorCode ?? null;
    phoneNumber.setupSyncStatus = input.setupSyncStatus ?? phoneNumber.setupSyncStatus ?? null;
    phoneNumber.setupSyncError = input.setupSyncError ?? phoneNumber.setupSyncError ?? null;
    phoneNumber.lastSetupQueryJson = input.lastSetupQueryJson ?? phoneNumber.lastSetupQueryJson ?? null;
    phoneNumber.lastSyncedAt = new Date();

    const saved = await this.phoneNumberRepository.save(phoneNumber);
    this.logger.verbose(`Kapso DB upsertPhoneNumber saved=${this.describePhoneNumber(saved)}`);
    return saved;
  }

  // --------------------------------------------------------------------------
  // AUDITORIA DE WEBHOOKS
  // --------------------------------------------------------------------------

  /** Actualiza campos de auditoria del ultimo webhook recibido para un numero. */
  async touchPhoneNumberWebhookEvent(input: TouchWebhookEventInput) {
    const phoneNumber = await this.findOrCreateByPhoneNumberId(input.phoneNumberId);

    phoneNumber.projectExternalId = input.projectExternalId ?? phoneNumber.projectExternalId ?? null;
    phoneNumber.projectPayload = input.projectPayload ?? phoneNumber.projectPayload ?? null;
    phoneNumber.kapsoCustomerId = input.kapsoCustomerId ?? phoneNumber.kapsoCustomerId ?? null;
    phoneNumber.customerPayload = input.customerPayload ?? phoneNumber.customerPayload ?? null;
    phoneNumber.lastWebhookScope = input.scope;
    phoneNumber.lastWebhookEvent = input.eventName;
    phoneNumber.lastIdempotencyKey = input.idempotencyKey ?? null;
    phoneNumber.lastSignatureValid = input.signatureValid ?? null;
    phoneNumber.lastProcessingStatus = input.processingStatus;
    phoneNumber.lastProcessingError = input.processingError ?? null;
    phoneNumber.lastWebhookPayload = input.payloadJson;
    phoneNumber.lastWebhookReceivedAt = new Date();

    const saved = await this.phoneNumberRepository.save(phoneNumber);
    this.logger.verbose(`Kapso DB touchWebhookEvent saved=${this.describePhoneNumber(saved)}`);
    return saved;
  }

  /**
   * Busca si ya se proceso un webhook con la misma clave de idempotencia.
   * Se usa para responder 200 sin reprocesar entregas duplicadas.
   */
  async findProcessedWebhookDuplicate(scope: KapsoWebhookScope | string, phoneNumberId: string, idempotencyKey: string) {
    return this.phoneNumberRepository.findOne({
      where: {
        phoneNumberId,
        lastWebhookScope: scope,
        lastIdempotencyKey: idempotencyKey,
        lastProcessingStatus: "processed",
      },
    });
  }

  /**
   * Registra el resultado final del procesamiento del webhook o del worker.
   * Si llegan webhooks remotos, tambien actualiza el snapshot persistido.
   */
  async recordWebhookSyncResult(
    phoneNumberId: string,
    processingStatus: KapsoProcessingStatus | KapsoSyncStatus | string,
    processingError?: string | null,
    webhooksJson?: JsonRecord[] | null,
  ) {
    const phoneNumber = await this.phoneNumberRepository.findOne({
      where: { phoneNumberId },
    });

    if (!phoneNumber) {
      return null;
    }

    phoneNumber.lastProcessingStatus = processingStatus;
    phoneNumber.lastProcessingError = processingError ?? null;
    phoneNumber.setupSyncStatus = processingStatus;
    phoneNumber.setupSyncError = processingError ?? null;

    if (webhooksJson) {
      phoneNumber.webhooksJson = webhooksJson;
    }

    const saved = await this.phoneNumberRepository.save(phoneNumber);
    this.logger.verbose(`Kapso DB recordWebhookSyncResult saved=${this.describePhoneNumber(saved)}`);
    return saved;
  }

  // --------------------------------------------------------------------------
  // AUDITORIA DE REDIRECTS DE SETUP
  // --------------------------------------------------------------------------

  /** Persiste parametros del redirect de setup OAuth, tanto exito como fallo. */
  async recordSetupRedirect(input: RecordSetupRedirectInput) {
    if (!input.phoneNumberId) {
      return null;
    }

    const phoneNumber = await this.findOrCreateByPhoneNumberId(input.phoneNumberId);

    phoneNumber.businessAccountId = input.businessAccountId ?? phoneNumber.businessAccountId ?? null;
    phoneNumber.whatsappConfigId = input.whatsappConfigId;
    phoneNumber.setupLinkId = input.setupLinkId;
    phoneNumber.provisionedPhoneNumberId = input.provisionedPhoneNumberId;
    phoneNumber.displayPhoneNumber = input.displayPhoneNumber ?? phoneNumber.displayPhoneNumber ?? null;
    phoneNumber.setupStatus = input.status;
    phoneNumber.setupErrorCode = input.errorCode;
    phoneNumber.setupSyncStatus = input.syncStatus;
    phoneNumber.setupSyncError = input.syncError ?? null;
    phoneNumber.lastSetupQueryJson = input.queryJson;

    const saved = await this.phoneNumberRepository.save(phoneNumber);
    this.logger.verbose(`Kapso DB recordSetupRedirect saved=${this.describePhoneNumber(saved)}`);
    return saved;
  }

  // --------------------------------------------------------------------------
  // OPERACIONES DE MANTENIMIENTO
  // --------------------------------------------------------------------------

  /** Elimina fisicamente un numero tras `whatsapp.phone_number.deleted`. */
  async deletePhoneNumber(phoneNumberId: string) {
    const phoneNumber = await this.phoneNumberRepository.findOne({
      where: { phoneNumberId },
    });

    if (!phoneNumber) {
      return null;
    }

    const snapshot = this.describePhoneNumber(phoneNumber);
    await this.phoneNumberRepository.remove(phoneNumber);
    this.logger.verbose(`Kapso DB deletePhoneNumber removed=${snapshot}`);
    return { phoneNumberId };
  }

  // --------------------------------------------------------------------------
  // CONSULTAS DE LECTURA
  // --------------------------------------------------------------------------

  /** Lista customers unicos derivados de las filas de numeros persistidos. */
  async listCustomers() {
    const rows = await this.phoneNumberRepository.find({
      where: {},
      order: { id: "DESC" },
    });

    const unique = new Map<string, JsonRecord>();

    for (const row of rows) {
      if (!row.kapsoCustomerId) {
        continue;
      }

      if (!unique.has(row.kapsoCustomerId)) {
        unique.set(row.kapsoCustomerId, {
          kapsoCustomerId: row.kapsoCustomerId,
          customerName: row.customerName,
          customerExternalId: row.customerExternalId,
          projectExternalId: row.projectExternalId,
          projectName: row.projectName,
        });
      }
    }

    return [...unique.values()];
  }

  /** Lista todos los numeros locales ordenados del mas reciente al mas antiguo. */
  async listPhoneNumbers() {
    return this.phoneNumberRepository.find({
      order: { id: "DESC" },
    });
  }

  /** Busca una fila consolidada usando `phone_number_id` como clave natural. */
  async findPhoneNumberByExternalId(phoneNumberId: string) {
    return this.phoneNumberRepository.findOne({
      where: { phoneNumberId },
    });
  }

  /** Devuelve numeros activos pendientes de completar el detalle remoto. */
  async listPendingRemoteSyncPhoneNumbers(limit: number) {
    return this.phoneNumberRepository.find({
      where: [
        { setupSyncStatus: "pending_remote_sync", active: true },
        { lastProcessingStatus: "pending_remote_sync", active: true },
      ],
      order: { updatedAt: "ASC", id: "ASC" },
      take: limit,
    });
  }

  // --------------------------------------------------------------------------
  // HELPERS PRIVADOS
  // --------------------------------------------------------------------------

  /** Reutiliza la fila existente o crea un esqueleto minimo para auditoria. */
  private async findOrCreateByPhoneNumberId(phoneNumberId: string) {
    const existing = await this.phoneNumberRepository.findOne({
      where: { phoneNumberId },
    });

    return existing ?? this.phoneNumberRepository.create({ phoneNumberId });
  }

  /** Resume la fila para logs verbose sin imprimir payloads JSON completos. */
  private describePhoneNumber(phoneNumber: KapsoPhoneNumberEntity) {
    return JSON.stringify({
      id: phoneNumber.id,
      phoneNumberId: phoneNumber.phoneNumberId,
      phoneNumberName: phoneNumber.phoneNumberName,
      displayPhoneNumber: phoneNumber.displayPhoneNumber,
      businessAccountId: phoneNumber.businessAccountId,
      projectExternalId: phoneNumber.projectExternalId,
      projectName: phoneNumber.projectName,
      kapsoCustomerId: phoneNumber.kapsoCustomerId,
      customerName: phoneNumber.customerName,
      whatsappConfigId: phoneNumber.whatsappConfigId,
      setupLinkId: phoneNumber.setupLinkId,
      setupStatus: phoneNumber.setupStatus,
      setupSyncStatus: phoneNumber.setupSyncStatus,
      lastWebhookScope: phoneNumber.lastWebhookScope,
      lastWebhookEvent: phoneNumber.lastWebhookEvent,
      lastIdempotencyKey: phoneNumber.lastIdempotencyKey,
      lastProcessingStatus: phoneNumber.lastProcessingStatus,
      lastProcessingError: phoneNumber.lastProcessingError,
      webhooksCount: Array.isArray(phoneNumber.webhooksJson) ? phoneNumber.webhooksJson.length : 0,
    });
  }
}
