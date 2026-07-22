/**
 * Persistencia de números Kapso e idempotencia durable de webhooks.
 *
 * Opera sobre `kapso_phone_numbers` y `kapso_webhook_receipts` (UNIQUE + lease)
 * para soportar múltiples instancias sin reprocesar entregas.
 */
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

export type WebhookReceiptReservation = {
  acquired: boolean;
  payloadMismatch: boolean;
  phoneNumberId: string | null;
  status: string;
};

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

/**
 * Repositorio de números Kapso y recibos de webhook.
 *
 * Responsabilidad: upsert/consulta de `kapso_phone_numbers` (estado de setup,
 * sync y último webhook) e idempotencia de entregas en `kapso_webhook_receipts`
 * mediante UNIQUE + lease (`locked_until`) para entornos multi-instancia.
 */
@Injectable()
export class KapsoRepository {
  private readonly logger = new Logger(KapsoRepository.name);

  constructor(
    @InjectRepository(KapsoPhoneNumberEntity)
    private readonly phoneNumberRepository: Repository<KapsoPhoneNumberEntity>,
  ) {}

  /**
   * Inserta o actualiza un número Kapso y su snapshot de proyecto/cliente/setup.
   *
   * Tablas: `kapso_phone_numbers`.
   * Por qué: sincronización desde API Kapso; campos opcionales preservan el
   * valor previo (`??`) para no borrar datos ya conocidos.
   */
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

  /**
   * Registra el último evento de webhook recibido sobre el número.
   *
   * Tablas: `kapso_phone_numbers` (columnas `last_*`).
   * Por qué: auditoría rápida del último delivery; la idempotencia fuerte vive
   * en `kapso_webhook_receipts` (`reserveWebhookReceipt`).
   */
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
   * Busca si el mismo webhook (scope + número + clave) ya se marcó como processed.
   *
   * Tablas: `kapso_phone_numbers`.
   * Por qué: atajo de idempotencia sobre el último estado del número; no
   * sustituye el UNIQUE/lease de `kapso_webhook_receipts`.
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
   * Reserva atomicamente una entrega. La restriccion unica evita carreras entre
   * instancias y el lease permite recuperar una ejecucion interrumpida.
   *
   * Tablas: `kapso_webhook_receipts` (UNIQUE scope+idempotency_key).
   * Por qué: INSERT IGNORE adquiere el lock; si ya existe, reintenta solo si
   * falló o el lease (`locked_until`) expiró; detecta mismatch de payload_hash.
   */
  async reserveWebhookReceipt(
    scope: KapsoWebhookScope | string,
    idempotencyKey: string,
    phoneNumberId: string | null,
    payloadHash: string,
  ): Promise<WebhookReceiptReservation> {
    // INSERT IGNORE: la UNIQUE (scope, idempotency_key) descarta inserts concurrentes.
    const insertResult = (await this.phoneNumberRepository.query(
      `
        INSERT IGNORE INTO kapso_webhook_receipts (
          scope,
          idempotency_key,
          phone_number_id,
          payload_hash,
          status,
          attempt_count,
          locked_until
        )
        VALUES (?, ?, ?, ?, 'processing', 1, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
      `,
      [scope, idempotencyKey, phoneNumberId, payloadHash],
    )) as { affectedRows?: number };

    if (Number(insertResult.affectedRows ?? 0) === 1) {
      return { acquired: true, payloadMismatch: false, phoneNumberId, status: "processing" };
    }

    // Reclama el recibo solo si falló o el lease de 5 min ya venció (worker caído).
    const retryResult = (await this.phoneNumberRepository.query(
      `
        UPDATE kapso_webhook_receipts
        SET
          status = 'processing',
          attempt_count = attempt_count + 1,
          processing_error = NULL,
          locked_until = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
        WHERE scope = ?
          AND idempotency_key = ?
          AND payload_hash = ?
          AND (
            status = 'failed'
            OR (status = 'processing' AND locked_until < NOW())
          )
      `,
      [scope, idempotencyKey, payloadHash],
    )) as { affectedRows?: number };

    if (Number(retryResult.affectedRows ?? 0) === 1) {
      return { acquired: true, payloadMismatch: false, phoneNumberId, status: "processing" };
    }

    const rows = (await this.phoneNumberRepository.query(
      `
        SELECT
          phone_number_id AS phoneNumberId,
          payload_hash AS payloadHash,
          status
        FROM kapso_webhook_receipts
        WHERE scope = ?
          AND idempotency_key = ?
        LIMIT 1
      `,
      [scope, idempotencyKey],
    )) as Array<{ payloadHash: string; phoneNumberId: string | null; status: string }>;
    const existing = rows[0];

    return {
      acquired: false,
      payloadMismatch: Boolean(existing && existing.payloadHash !== payloadHash),
      phoneNumberId: existing?.phoneNumberId ?? phoneNumberId,
      status: existing?.status ?? "processing",
    };
  }

  /**
   * Cierra un recibo de webhook como processed o failed.
   *
   * Tablas: `kapso_webhook_receipts`.
   * Por qué: libera/consolida el lease (`locked_until`) y fija `processed_at`
   * solo cuando el status final es `processed`.
   */
  async completeWebhookReceipt(
    scope: KapsoWebhookScope | string,
    idempotencyKey: string,
    status: "processed" | "failed",
    processingError?: string,
  ): Promise<void> {
    await this.phoneNumberRepository.query(
      `
        UPDATE kapso_webhook_receipts
        SET
          status = ?,
          processing_error = ?,
          locked_until = NOW(),
          processed_at = CASE WHEN ? = 'processed' THEN NOW() ELSE processed_at END
        WHERE scope = ?
          AND idempotency_key = ?
      `,
      [status, processingError?.slice(0, 500) ?? null, status, scope, idempotencyKey],
    );
  }

  /**
   * Persiste el resultado de sincronizar webhooks remotos en el número.
   *
   * Tablas: `kapso_phone_numbers`.
   * Por qué: refleja el estado de sync (`setup_sync_*` / `last_processing_*`)
   * y opcionalmente el catálogo `webhooks_json`.
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

  /**
   * Registra el resultado de un redirect de setup (provisioning WhatsApp).
   *
   * Tablas: `kapso_phone_numbers`.
   * Por qué: el callback de setup actualiza IDs, display, status de setup/sync
   * y el query JSON de la redirección; no-op si falta `phoneNumberId`.
   */
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

  /**
   * Elimina físicamente un número Kapso por su ID externo.
   *
   * Tablas: `kapso_phone_numbers` (hard delete).
   * Por qué: baja del catálogo local cuando Kapso/admin lo solicita.
   */
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

  /**
   * Lista clientes Kapso únicos derivados de los números persistidos.
   *
   * Tablas: `kapso_phone_numbers` (dedupe en memoria por `kapsoCustomerId`).
   * Por qué: no hay tabla de customers; se proyecta desde los números.
   */
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

  /**
   * Lista números Kapso con columnas de resumen (sin payloads pesados).
   *
   * Tablas: `kapso_phone_numbers`.
   * Por qué: catálogo admin/API con `select` acotado.
   */
  async listPhoneNumbers() {
    return this.phoneNumberRepository.find({
      order: { id: "DESC" },
      select: {
        id: true,
        phoneNumberId: true,
        phoneNumberName: true,
        displayPhoneNumber: true,
        verifiedName: true,
        businessAccountId: true,
        status: true,
        qualityRating: true,
        throughputTier: true,
        connectionType: true,
        active: true,
        lastSyncedAt: true,
        projectExternalId: true,
        projectName: true,
        kapsoCustomerId: true,
        customerName: true,
        customerExternalId: true,
        setupStatus: true,
        setupSyncStatus: true,
        lastProcessingStatus: true,
        lastWebhookReceivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Busca un número por su ID externo Kapso (`phone_number_id`).
   *
   * Tablas: `kapso_phone_numbers`.
   */
  async findPhoneNumberByExternalId(phoneNumberId: string) {
    return this.phoneNumberRepository.findOne({
      where: { phoneNumberId },
    });
  }

  /**
   * Lista números activos pendientes de sync remoto (cola de reintento).
   *
   * Tablas: `kapso_phone_numbers`.
   * Por qué: workers reprocesan filas con `pending_remote_sync` en
   * `setup_sync_status` o `last_processing_status`, orden FIFO por `updatedAt`.
   */
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

  private async findOrCreateByPhoneNumberId(phoneNumberId: string) {
    const existing = await this.phoneNumberRepository.findOne({
      where: { phoneNumberId },
    });

    return existing ?? this.phoneNumberRepository.create({ phoneNumberId });
  }

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
