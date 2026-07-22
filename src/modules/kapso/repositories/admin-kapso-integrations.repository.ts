/**
 * Persistencia de asignaciones Asesor CRM ↔ número Kapso.
 *
 * Consulta `admins` (CRM legado) y `admin_kapso_integrations` / `kapso_phone_numbers`.
 * Deduplica `idnetsuite_admin` no único y prioriza administradores activos.
 */
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { ListAdminKapsoIntegrationsDto } from "../dto/list-admin-kapso-integrations.dto";
import { AdminKapsoIntegrationEntity, AdminKapsoIntegrationStatus } from "../entities/admin-kapso-integration.entity";

export type AdminOptionRecord = {
  idnetsuiteAdmin: number;
  idAdmin: number;
  name: string | null;
  email: string | null;
  status: number;
};

export type KapsoPhoneNumberOptionRecord = {
  id: number;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  phoneNumberName: string | null;
  verifiedName: string | null;
  businessAccountId: string | null;
  active: boolean;
  status: string | null;
  setupStatus: string | null;
  setupSyncStatus: string | null;
};

export type AdminKapsoIntegrationRow = {
  id: number;
  idnetsuiteAdmin: number;
  kapsoPhoneNumberId: number;
  status: 0 | 1;
  createdAt: string;
  updatedAt: string;
  administratorName: string | null;
  administratorEmail: string | null;
  administratorStatus: number | null;
  displayPhoneNumber: string | null;
  phoneNumberName: string | null;
  verifiedName: string | null;
  businessAccountId: string | null;
  phoneNumberId: string;
  kapsoIntegrationActive: boolean;
  kapsoIntegrationStatus: string | null;
  kapsoSetupStatus: string | null;
  kapsoSetupSyncStatus: string | null;
};

/**
 * Repositorio de relaciones administrador CRM ↔ número Kapso.
 *
 * Responsabilidad: CRUD y listados de `admin_kapso_integrations`, con JOINs a
 * `admins` (CRM) y `kapso_phone_numbers`. Como `admins.idnetsuite_admin` no es
 * único, las consultas deduplican eligiendo una fila representante y priorizan
 * administradores activos (`status_admin = 1`).
 */
@Injectable()
export class AdminKapsoIntegrationsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AdminKapsoIntegrationEntity)
    private readonly relationRepository: Repository<AdminKapsoIntegrationEntity>,
  ) {}

  /**
   * Lista opciones de administradores CRM para selects del panel admin.
   *
   * Tablas: `admins` (deduplicación por `idnetsuite_admin`).
   * Por qué: `idnetsuite_admin` puede repetirse; se elige un `id_admin`
   * representante priorizando activos antes de filtrar/buscar.
   */
  async listAdminOptions(params: { search?: string; includeInactive?: boolean }) {
    const where: string[] = ["dedup.idnetsuite_admin IS NOT NULL"];
    const queryParams: Array<string | number> = [];

    if (!params.includeInactive) {
      where.push("picked.status_admin = 1");
    }

    if (params.search) {
      where.push("(picked.name_admin LIKE ? OR picked.email_admin LIKE ? OR CAST(dedup.idnetsuite_admin AS CHAR) LIKE ?)");
      queryParams.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
    }

    const rows = await this.dataSource.query(
      `
        SELECT
          dedup.idnetsuite_admin AS idnetsuiteAdmin,
          picked.id_admin AS idAdmin,
          picked.name_admin AS name,
          picked.email_admin AS email,
          picked.status_admin AS status
        FROM (
          SELECT
            idnetsuite_admin,
            -- Prioriza un admin activo; si no hay, toma el MAX(id_admin) como representante.
            COALESCE(
              MAX(CASE WHEN status_admin = 1 THEN id_admin END),
              MAX(id_admin)
            ) AS selected_id_admin
          FROM admins
          WHERE idnetsuite_admin IS NOT NULL
          GROUP BY idnetsuite_admin
        ) dedup
        INNER JOIN admins picked
          ON picked.id_admin = dedup.selected_id_admin
        WHERE ${where.join(" AND ")}
        ORDER BY picked.name_admin ASC, dedup.idnetsuite_admin ASC
      `,
      queryParams,
    );

    return rows as AdminOptionRecord[];
  }

  /**
   * Obtiene un administrador CRM por su `idnetsuite_admin`.
   *
   * Tablas: `admins` (misma deduplicación que `listAdminOptions`).
   * Por qué: garantiza una sola fila representante aunque existan duplicados CRM.
   */
  async findAdminOptionByNetSuiteId(idnetsuiteAdmin: number) {
    const rows = await this.dataSource.query(
      `
        SELECT
          dedup.idnetsuite_admin AS idnetsuiteAdmin,
          picked.id_admin AS idAdmin,
          picked.name_admin AS name,
          picked.email_admin AS email,
          picked.status_admin AS status
        FROM (
          SELECT
            idnetsuite_admin,
            COALESCE(
              MAX(CASE WHEN status_admin = 1 THEN id_admin END),
              MAX(id_admin)
            ) AS selected_id_admin
          FROM admins
          WHERE idnetsuite_admin IS NOT NULL
          GROUP BY idnetsuite_admin
        ) dedup
        INNER JOIN admins picked
          ON picked.id_admin = dedup.selected_id_admin
        WHERE dedup.idnetsuite_admin = ?
        LIMIT 1
      `,
      [idnetsuiteAdmin],
    );

    return (rows[0] ?? null) as AdminOptionRecord | null;
  }

  /**
   * Lista números Kapso disponibles para asociar a un administrador.
   *
   * Tablas: `kapso_phone_numbers`.
   * Por qué: catálogo de opciones del panel; filtra inactivos y busca por
   * display/name/verified/`phone_number_id`.
   */
  async listKapsoPhoneNumberOptions(params: { search?: string; includeInactive?: boolean }) {
    const where: string[] = ["1 = 1"];
    const queryParams: Array<string | number> = [];

    if (!params.includeInactive) {
      where.push("phone.active = 1");
    }

    if (params.search) {
      where.push(
        "(phone.display_phone_number LIKE ? OR phone.phone_number_name LIKE ? OR phone.verified_name LIKE ? OR phone.phone_number_id LIKE ?)",
      );
      queryParams.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
    }

    const rows = await this.dataSource.query(
      `
        SELECT
          phone.id,
          phone.phone_number_id AS phoneNumberId,
          phone.display_phone_number AS displayPhoneNumber,
          phone.phone_number_name AS phoneNumberName,
          phone.verified_name AS verifiedName,
          phone.business_account_id AS businessAccountId,
          phone.active,
          phone.status,
          phone.setup_status AS setupStatus,
          phone.setup_sync_status AS setupSyncStatus
        FROM kapso_phone_numbers phone
        WHERE ${where.join(" AND ")}
        ORDER BY phone.display_phone_number ASC, phone.phone_number_name ASC
      `,
      queryParams,
    );

    return rows as KapsoPhoneNumberOptionRecord[];
  }

  /**
   * Obtiene un número Kapso por PK interna (`kapso_phone_numbers.id`).
   *
   * Tablas: `kapso_phone_numbers`.
   * Por qué: validación previa al crear/actualizar una relación admin↔número.
   */
  async findKapsoPhoneNumberOptionById(id: number) {
    const rows = await this.dataSource.query(
      `
        SELECT
          phone.id,
          phone.phone_number_id AS phoneNumberId,
          phone.display_phone_number AS displayPhoneNumber,
          phone.phone_number_name AS phoneNumberName,
          phone.verified_name AS verifiedName,
          phone.business_account_id AS businessAccountId,
          phone.active,
          phone.status,
          phone.setup_status AS setupStatus,
          phone.setup_sync_status AS setupSyncStatus
        FROM kapso_phone_numbers phone
        WHERE phone.id = ?
        LIMIT 1
      `,
      [id],
    );

    return (rows[0] ?? null) as KapsoPhoneNumberOptionRecord | null;
  }

  /**
   * Busca la entidad de relación por su PK.
   *
   * Tablas: `admin_kapso_integrations` (TypeORM).
   * Por qué: carga la fila mutable para update/delete/status.
   */
  async findRelationById(id: number) {
    return this.relationRepository.findOne({ where: { id } });
  }

  /**
   * Detecta duplicado de par admin↔número (UNIQUE de negocio).
   *
   * Tablas: `admin_kapso_integrations`.
   * Por qué: evita insertar/actualizar a una combinación ya existente;
   * `excludeId` permite ignorar la propia fila en ediciones.
   */
  async findDuplicateRelation(idnetsuiteAdmin: number, kapsoPhoneNumberId: number, excludeId?: number) {
    const relation = await this.relationRepository.findOne({
      where: { idnetsuiteAdmin, kapsoPhoneNumberId },
    });

    if (!relation || (excludeId && relation.id === excludeId)) {
      return null;
    }

    return relation;
  }

  /**
   * Persiste una nueva relación administrador ↔ número Kapso.
   *
   * Tablas: `admin_kapso_integrations`.
   * Por qué: alta del vínculo usado luego por automatización de leads.
   */
  async createRelation(input: { idnetsuiteAdmin: number; kapsoPhoneNumberId: number; status: AdminKapsoIntegrationStatus }) {
    return this.relationRepository.save(this.relationRepository.create(input));
  }

  /**
   * Actualiza admin, número y estado de una relación existente.
   *
   * Tablas: `admin_kapso_integrations`.
   * Por qué: edición completa del vínculo ya persistido.
   */
  async updateRelation(
    relation: AdminKapsoIntegrationEntity,
    input: {
      idnetsuiteAdmin: number;
      kapsoPhoneNumberId: number;
      status: AdminKapsoIntegrationStatus;
    },
  ) {
    relation.idnetsuiteAdmin = input.idnetsuiteAdmin;
    relation.kapsoPhoneNumberId = input.kapsoPhoneNumberId;
    relation.status = input.status;
    return this.relationRepository.save(relation);
  }

  /**
   * Cambia solo el estado (activo/inactivo) de la relación.
   *
   * Tablas: `admin_kapso_integrations`.
   * Por qué: habilitar/deshabilitar sin soft-delete; la fila permanece.
   */
  async updateRelationStatus(relation: AdminKapsoIntegrationEntity, status: AdminKapsoIntegrationStatus) {
    relation.status = status;
    return this.relationRepository.save(relation);
  }

  /**
   * Elimina físicamente la relación (hard delete).
   *
   * Tablas: `admin_kapso_integrations`.
   * Por qué: borrado definitivo solicitado desde el panel admin.
   */
  async deleteRelation(relation: AdminKapsoIntegrationEntity) {
    await this.relationRepository.remove(relation);
    return { id: relation.id };
  }

  /**
   * Lista paginada de relaciones enriquecidas con datos CRM y Kapso.
   *
   * Tablas: `admin_kapso_integrations`, `kapso_phone_numbers`, `admins` (JOIN
   * deduplicado por `idnetsuite_admin`).
   * Por qué: el panel necesita nombre/email del admin y metadatos del número
   * en una sola consulta; el JOIN a `admins` evita duplicar filas de relación.
   */
  async listRelations(params: ListAdminKapsoIntegrationsDto) {
    const where: string[] = ["1 = 1"];
    const queryParams: Array<string | number> = [];

    if (params.idnetsuiteAdmin) {
      where.push("relation.idnetsuite_admin = ?");
      queryParams.push(params.idnetsuiteAdmin);
    }

    if (params.kapsoPhoneNumberId) {
      where.push("relation.id_kapso_phone_number = ?");
      queryParams.push(params.kapsoPhoneNumberId);
    }

    if (typeof params.status === "number") {
      where.push("relation.status_admin_kapso_integration = ?");
      queryParams.push(params.status);
    }

    if (params.search) {
      where.push(
        "(picked.name_admin LIKE ? OR picked.email_admin LIKE ? OR phone.display_phone_number LIKE ? OR phone.phone_number_name LIKE ? OR phone.phone_number_id LIKE ?)",
      );
      queryParams.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
    }

    // Subconsulta CRM: una fila admin por idnetsuite_admin (prioriza activos).
    const administratorJoin = `
      LEFT JOIN (
        SELECT
          dedup.idnetsuite_admin,
          picked.name_admin,
          picked.email_admin,
          picked.status_admin
        FROM (
          SELECT
            idnetsuite_admin,
            COALESCE(
              MAX(CASE WHEN status_admin = 1 THEN id_admin END),
              MAX(id_admin)
            ) AS selected_id_admin
          FROM admins
          WHERE idnetsuite_admin IS NOT NULL
          GROUP BY idnetsuite_admin
        ) dedup
        INNER JOIN admins picked
          ON picked.id_admin = dedup.selected_id_admin
      ) picked
        ON picked.idnetsuite_admin = relation.idnetsuite_admin
    `;

    const countRows = await this.dataSource.query(
      `
        SELECT COUNT(*) AS total
        FROM admin_kapso_integrations relation
        INNER JOIN kapso_phone_numbers phone
          ON phone.id = relation.id_kapso_phone_number
        ${administratorJoin}
        WHERE ${where.join(" AND ")}
      `,
      queryParams,
    );

    const total = Number(countRows[0]?.total ?? 0);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const offset = (page - 1) * pageSize;
    const orderColumn = this.resolveSortColumn(params.sortBy);
    const orderDirection = (params.sortOrder ?? "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";

    const rows = await this.dataSource.query(
      `
        SELECT
          relation.id_admin_kapso_integration AS id,
          relation.idnetsuite_admin AS idnetsuiteAdmin,
          relation.id_kapso_phone_number AS kapsoPhoneNumberId,
          relation.status_admin_kapso_integration AS status,
          relation.created_at AS createdAt,
          relation.updated_at AS updatedAt,
          picked.name_admin AS administratorName,
          picked.email_admin AS administratorEmail,
          picked.status_admin AS administratorStatus,
          phone.display_phone_number AS displayPhoneNumber,
          phone.phone_number_name AS phoneNumberName,
          phone.verified_name AS verifiedName,
          phone.business_account_id AS businessAccountId,
          phone.phone_number_id AS phoneNumberId,
          phone.active AS kapsoIntegrationActive,
          phone.status AS kapsoIntegrationStatus,
          phone.setup_status AS kapsoSetupStatus,
          phone.setup_sync_status AS kapsoSetupSyncStatus
        FROM admin_kapso_integrations relation
        INNER JOIN kapso_phone_numbers phone
          ON phone.id = relation.id_kapso_phone_number
        ${administratorJoin}
        WHERE ${where.join(" AND ")}
        ORDER BY ${orderColumn} ${orderDirection}, relation.id_admin_kapso_integration DESC
        LIMIT ? OFFSET ?
      `,
      [...queryParams, pageSize, offset],
    );

    return {
      items: rows as AdminKapsoIntegrationRow[],
      meta: {
        total,
        page,
        pageSize,
        totalPages: total > 0 ? Math.ceil(total / pageSize) : 1,
      },
    };
  }

  /**
   * Detalle de una relación con JOINs a admin CRM y número Kapso.
   *
   * Tablas: `admin_kapso_integrations`, `kapso_phone_numbers`, `admins`.
   * Por qué: misma proyección enriquecida que el listado, para una sola PK.
   */
  async findRelationDetailById(id: number) {
    const rows = await this.dataSource.query(
      `
        SELECT
          relation.id_admin_kapso_integration AS id,
          relation.idnetsuite_admin AS idnetsuiteAdmin,
          relation.id_kapso_phone_number AS kapsoPhoneNumberId,
          relation.status_admin_kapso_integration AS status,
          relation.created_at AS createdAt,
          relation.updated_at AS updatedAt,
          picked.name_admin AS administratorName,
          picked.email_admin AS administratorEmail,
          picked.status_admin AS administratorStatus,
          phone.display_phone_number AS displayPhoneNumber,
          phone.phone_number_name AS phoneNumberName,
          phone.verified_name AS verifiedName,
          phone.business_account_id AS businessAccountId,
          phone.phone_number_id AS phoneNumberId,
          phone.active AS kapsoIntegrationActive,
          phone.status AS kapsoIntegrationStatus,
          phone.setup_status AS kapsoSetupStatus,
          phone.setup_sync_status AS kapsoSetupSyncStatus
        FROM admin_kapso_integrations relation
        INNER JOIN kapso_phone_numbers phone
          ON phone.id = relation.id_kapso_phone_number
        LEFT JOIN (
          SELECT
            dedup.idnetsuite_admin,
            picked.name_admin,
            picked.email_admin,
            picked.status_admin
          FROM (
            SELECT
              idnetsuite_admin,
              COALESCE(
                MAX(CASE WHEN status_admin = 1 THEN id_admin END),
                MAX(id_admin)
              ) AS selected_id_admin
            FROM admins
            WHERE idnetsuite_admin IS NOT NULL
            GROUP BY idnetsuite_admin
          ) dedup
          INNER JOIN admins picked
            ON picked.id_admin = dedup.selected_id_admin
        ) picked
          ON picked.idnetsuite_admin = relation.idnetsuite_admin
        WHERE relation.id_admin_kapso_integration = ?
        LIMIT 1
      `,
      [id],
    );

    return (rows[0] ?? null) as AdminKapsoIntegrationRow | null;
  }

  /**
   * Lista integraciones activas de un admin con números Kapso activos.
   *
   * Tablas: `admin_kapso_integrations`, `kapso_phone_numbers`.
   * Por qué: usado por automatización/UI para saber qué números puede usar
   * el asesor (`status_admin_kapso_integration = 1` y `phone.active = 1`).
   */
  async listActiveIntegrationsByAdmin(idnetsuiteAdmin: number) {
    return this.dataSource.query(
      `
        SELECT
          relation.id_admin_kapso_integration AS relationId,
          relation.idnetsuite_admin AS idnetsuiteAdmin,
          phone.id AS kapsoPhoneNumberId,
          phone.phone_number_id AS phoneNumberId,
          phone.display_phone_number AS displayPhoneNumber,
          phone.phone_number_name AS phoneNumberName,
          phone.verified_name AS verifiedName,
          phone.business_account_id AS businessAccountId,
          phone.status AS kapsoIntegrationStatus,
          phone.setup_status AS kapsoSetupStatus,
          phone.setup_sync_status AS kapsoSetupSyncStatus
        FROM admin_kapso_integrations relation
        INNER JOIN kapso_phone_numbers phone
          ON phone.id = relation.id_kapso_phone_number
        WHERE relation.idnetsuite_admin = ?
          AND relation.status_admin_kapso_integration = 1
          AND phone.active = 1
        ORDER BY phone.display_phone_number ASC, phone.phone_number_name ASC
      `,
      [idnetsuiteAdmin],
    );
  }

  private resolveSortColumn(sortBy?: string) {
    switch (sortBy) {
      case "createdAt":
        return "relation.created_at";
      case "administratorName":
        return "picked.name_admin";
      case "displayPhoneNumber":
        return "phone.display_phone_number";
      case "status":
        return "relation.status_admin_kapso_integration";
      case "updatedAt":
      default:
        return "relation.updated_at";
    }
  }
}
