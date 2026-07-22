/**
 * Entidad TypeORM del estado local consolidado de un número WhatsApp Kapso.
 *
 * Tabla: kapso_phone_numbers. Una fila por phone_number_id remoto;
 * agrupa detalle, proyecto/customer, setup y auditoría del último webhook.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Decoradores TypeORM para mapear la tabla consolidada de numeros Kapso.
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

import { JsonRecord } from "../common/kapso.types";

// ============================================================================
// TIPOS DE DOMINIO
// ============================================================================

/** Resultado del redirect OAuth de setup (`/kapso/setup/success|failure`). */
export type KapsoSetupStatus = "success" | "failure";

/**
 * Estado de sincronizacion local con Kapso Platform API.
 * `pending_remote_sync` indica que el numero existe pero Kapso aun no expone
 * su detalle remoto completo para hidratar la fila local.
 */
export type KapsoSyncStatus =
  | "not_started"
  | "pending"
  | "missing_phone_number_id"
  | "synced"
  | "sync_failed"
  | "pending_remote_sync"
  | "processed"
  | "processed_with_warnings";

/**
 * Estado de procesamiento del ultimo webhook o del worker de reintentos.
 * Tambien se usa para idempotencia y trazabilidad local.
 */
export type KapsoProcessingStatus = "received" | "processed" | "processed_with_warnings" | "pending_remote_sync" | "failed" | "deleted";

/** Origen del ultimo webhook auditado en la fila consolidada. */
export type KapsoWebhookScope = "platform" | "kapso" | "meta";

// ============================================================================
// ENTIDAD PRINCIPAL
// ============================================================================

/**
 * Estado local consolidado de un numero WhatsApp en Kapso.
 *
 * Tabla: `kapso_phone_numbers`
 * Regla principal: una fila por `phone_number_id` remoto.
 *
 * La tabla agrupa en un solo registro:
 * - detalle del numero;
 * - proyecto y customer asociados;
 * - progreso del setup;
 * - snapshot de webhooks;
 * - auditoria del ultimo webhook procesado.
 */
@Entity({ name: "kapso_phone_numbers" })
export class KapsoPhoneNumberEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // --------------------------------------------------------------------------
  // IDENTIDAD DEL NUMERO
  // --------------------------------------------------------------------------

  /** ID remoto en Kapso; funciona como clave natural unica del registro. */
  @Index("uq_kapso_phone_numbers_phone_number_id", { unique: true })
  @Column({
    name: "phone_number_id",
    type: "varchar",
    length: 120,
    unique: true,
  })
  phoneNumberId!: string;

  /** Nombre interno configurado para el numero dentro de Kapso. */
  @Column({
    name: "phone_number_name",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  phoneNumberName!: string | null;

  /** Numero visible para usuarios finales, por ejemplo `+506...`. */
  @Column({
    name: "display_phone_number",
    type: "varchar",
    length: 80,
    nullable: true,
  })
  displayPhoneNumber!: string | null;

  /** Nombre verificado devuelto por Meta / Kapso. */
  @Column({
    name: "verified_name",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  verifiedName!: string | null;

  /** WABA / business account duena del numero en Meta. */
  @Index("idx_kapso_phone_numbers_business_account_id")
  @Column({
    name: "business_account_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  businessAccountId!: string | null;

  /** Estado remoto reportado por Kapso o Meta. */
  @Column({
    name: "status",
    type: "varchar",
    length: 60,
    nullable: true,
  })
  status!: string | null;

  /** Calidad del numero reportada por Meta (`GREEN`, `YELLOW`, etc.). */
  @Column({
    name: "quality_rating",
    type: "varchar",
    length: 60,
    nullable: true,
  })
  qualityRating!: string | null;

  /** Tier de throughput permitido por Meta para ese numero. */
  @Column({
    name: "throughput_tier",
    type: "varchar",
    length: 60,
    nullable: true,
  })
  throughputTier!: string | null;

  /** Modo de conexion configurado en Kapso (`coexistence`, `dedicated`, etc.). */
  @Column({
    name: "connection_type",
    type: "varchar",
    length: 60,
    nullable: true,
  })
  connectionType!: string | null;

  /** Flag local para ocultar numeros eliminados o inactivos. */
  @Index("idx_kapso_phone_numbers_active")
  @Column({
    name: "active",
    type: "tinyint",
    width: 1,
    default: () => "1",
  })
  active!: boolean;

  /** Ultima vez que se persistio detalle remoto completo del numero. */
  @Column({
    name: "last_synced_at",
    type: "datetime",
    nullable: true,
  })
  lastSyncedAt!: Date | null;

  /** Payload crudo de `GET /whatsapp/phone_numbers/:id`. */
  @Column({
    name: "raw_payload",
    type: "json",
    nullable: true,
  })
  rawPayload!: JsonRecord | null;

  // --------------------------------------------------------------------------
  // PROYECTO Y CUSTOMER ASOCIADOS
  // --------------------------------------------------------------------------

  /** `project.id` remoto usado para resolver la API key correcta. */
  @Column({
    name: "project_external_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  projectExternalId!: string | null;

  /** Nombre amigable del proyecto Kapso / CRM asociado al numero. */
  @Column({
    name: "project_name",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  projectName!: string | null;

  /** `customer.id` remoto de Kapso. */
  @Column({
    name: "kapso_customer_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  kapsoCustomerId!: string | null;

  /** Nombre visible del customer / tenant asociado. */
  @Column({
    name: "customer_name",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  customerName!: string | null;

  /** External ID del customer para correlacion con sistemas del CRM. */
  @Column({
    name: "customer_external_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  customerExternalId!: string | null;

  /** Snapshot crudo del objeto `project` recibido desde Kapso. */
  @Column({
    name: "project_payload",
    type: "json",
    nullable: true,
  })
  projectPayload!: JsonRecord | null;

  /** Snapshot crudo del objeto `customer` recibido desde Kapso. */
  @Column({
    name: "customer_payload",
    type: "json",
    nullable: true,
  })
  customerPayload!: JsonRecord | null;

  // --------------------------------------------------------------------------
  // FLUJO DE SETUP / ONBOARDING
  // --------------------------------------------------------------------------

  /** Identificador interno de la configuracion WhatsApp creada por Kapso. */
  @Column({
    name: "whatsapp_config_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  whatsappConfigId!: string | null;

  /** Setup link que disparo la conexion actual del numero. */
  @Column({
    name: "setup_link_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  setupLinkId!: string | null;

  /** ID opcional de numero provisionado devuelto por Kapso en algunos flujos. */
  @Column({
    name: "provisioned_phone_number_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  provisionedPhoneNumberId!: string | null;

  /** Resultado del redirect final del setup: `success` o `failure`. */
  @Column({
    name: "setup_status",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  setupStatus!: KapsoSetupStatus | string | null;

  /** Codigo de error devuelto por Kapso cuando el setup falla. */
  @Column({
    name: "setup_error_code",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  setupErrorCode!: string | null;

  /**
   * Estado de sync asociado al setup y al worker de reintentos.
   * Este campo es la referencia principal para saber si la fila ya quedo cerrada
   * o si aun faltan detalles remotos o webhooks por confirmar.
   */
  @Column({
    name: "setup_sync_status",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  setupSyncStatus!: KapsoSyncStatus | string | null;

  /** Ultimo error conocido del sync post-setup. */
  @Column({
    name: "setup_sync_error",
    type: "text",
    nullable: true,
  })
  setupSyncError!: string | null;

  /** Query string completa recibida en el ultimo redirect `/kapso/setup/*`. */
  @Column({
    name: "last_setup_query_json",
    type: "json",
    nullable: true,
  })
  lastSetupQueryJson!: JsonRecord | null;

  // --------------------------------------------------------------------------
  // WEBHOOKS Y AUDITORIA
  // --------------------------------------------------------------------------

  /** Snapshot de webhooks remotos configurados en Kapso para este numero. */
  @Column({
    name: "webhooks_json",
    type: "json",
    nullable: true,
  })
  webhooksJson!: JsonRecord[] | null;

  /** Scope del ultimo webhook auditado (`platform`, `kapso` o `meta`). */
  @Column({
    name: "last_webhook_scope",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  lastWebhookScope!: KapsoWebhookScope | string | null;

  /** Nombre del ultimo evento recibido para este numero. */
  @Column({
    name: "last_webhook_event",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  lastWebhookEvent!: string | null;

  /** `x-idempotency-key` del ultimo webhook procesado. */
  @Column({
    name: "last_idempotency_key",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  lastIdempotencyKey!: string | null;

  /** Resultado de la verificacion HMAC del ultimo webhook firmado. */
  @Column({
    name: "last_signature_valid",
    type: "tinyint",
    width: 1,
    nullable: true,
  })
  lastSignatureValid!: boolean | null;

  /**
   * Estado del ultimo procesamiento de webhook o del worker.
   * `processed` permite deduplicar reentregas futuras.
   */
  @Column({
    name: "last_processing_status",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  lastProcessingStatus!: KapsoProcessingStatus | string | null;

  /** Ultimo error persistido por webhook o por el worker de sync. */
  @Column({
    name: "last_processing_error",
    type: "text",
    nullable: true,
  })
  lastProcessingError!: string | null;

  /** Fecha exacta del ultimo webhook recibido para este numero. */
  @Column({
    name: "last_webhook_received_at",
    type: "datetime",
    nullable: true,
  })
  lastWebhookReceivedAt!: Date | null;

  /** Payload completo del ultimo webhook con fines de soporte y diagnostico. */
  @Column({
    name: "last_webhook_payload",
    type: "json",
    nullable: true,
  })
  lastWebhookPayload!: JsonRecord | null;

  // --------------------------------------------------------------------------
  // FECHAS DE CONTROL
  // --------------------------------------------------------------------------

  /** Fecha de insercion local de la fila consolidada. */
  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  /** Fecha de ultima actualizacion local de la fila consolidada. */
  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
