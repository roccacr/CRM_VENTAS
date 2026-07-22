/**
 * Entidad TypeORM de la relación admin CRM con un número WhatsApp Kapso.
 *
 * Tabla: admin_kapso_integrations. Unicidad por par
 * (idnetsuite_admin, id_kapso_phone_number).
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

// ============================================================================
// TIPOS DE DOMINIO
// ============================================================================

/** Estado funcional de la relacion entre un admin y una integracion Kapso. */
export type AdminKapsoIntegrationStatus = 0 | 1;

// ============================================================================
// ENTIDAD
// ============================================================================

/**
 * Tabla pivote many-to-many entre administradores del CRM e integraciones Kapso.
 *
 * Regla funcional:
 * - la identidad operativa del admin en el CRM hoy es `idnetsuite_admin`;
 * - por eso la relacion se guarda usando ese identificador logico;
 * - la FK fisica solo apunta al numero local consolidado en `kapso_phone_numbers`.
 */
@Entity({ name: "admin_kapso_integrations" })
@Index("uq_admin_kapso_integrations_relation", ["idnetsuiteAdmin", "kapsoPhoneNumberId"], {
  unique: true,
})
export class AdminKapsoIntegrationEntity {
  @PrimaryGeneratedColumn({
    name: "id_admin_kapso_integration",
  })
  id!: number;

  /** Identificador operativo del asesor proveniente de NetSuite. */
  @Index("idx_admin_kapso_integrations_idnetsuite_admin")
  @Column({
    name: "idnetsuite_admin",
    type: "int",
  })
  idnetsuiteAdmin!: number;

  /** FK local a `kapso_phone_numbers.id`. */
  @Index("idx_admin_kapso_integrations_kapso_phone_number_id")
  @Column({
    name: "id_kapso_phone_number",
    type: "int",
  })
  kapsoPhoneNumberId!: number;

  /** `1 = activa`, `0 = inactiva`. */
  @Index("idx_admin_kapso_integrations_status")
  @Column({
    name: "status_admin_kapso_integration",
    type: "tinyint",
    width: 1,
    default: () => "1",
  })
  status!: AdminKapsoIntegrationStatus;

  /** Fecha de insercion local de la relacion. */
  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  /** Fecha de ultima modificacion local de la relacion. */
  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
