// ============================================================================
// IMPORTS
// ============================================================================

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { ListAdminKapsoIntegrationsDto } from "../dto/list-admin-kapso-integrations.dto";
import { AdminKapsoIntegrationEntity, AdminKapsoIntegrationStatus } from "../entities/admin-kapso-integration.entity";

// ============================================================================
// TIPOS DE SALIDA
// ============================================================================

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

export type LeadTemplateCandidateRecord = Record<string, unknown> & {
  leadId: number;
  internalLeadId: number | null;
  idEmpleadoLead: number | null;
  adminId: number | null;
  adminName: string | null;
  adminEmail: string | null;
  adminStatus: number | null;
  kapsoRelationId: number | null;
  kapsoPhoneNumberId: number | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
};

export type MarkLeadFlowAnsweredNoInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  responsePayload: Record<string, unknown>;
};

// ============================================================================
// REPOSITORIO
// ============================================================================

/**
 * Acceso a datos de la relacion entre administradores del CRM y numeros Kapso.
 *
 * Nota importante:
 * `admins.idnetsuite_admin` hoy no es unico en todos los registros, asi que
 * el repositorio deduplica esa tabla y elige una sola fila representante por ID.
 */
@Injectable()
export class AdminKapsoIntegrationsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AdminKapsoIntegrationEntity)
    private readonly relationRepository: Repository<AdminKapsoIntegrationEntity>,
  ) {}

  // --------------------------------------------------------------------------
  // LISTAS DE OPCIONES
  // --------------------------------------------------------------------------

  /** Devuelve administradores deduplicados por `idnetsuite_admin`. */
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

  /** Busca un administrador deduplicado por su `idnetsuite_admin`. */
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

  /** Lista numeros Kapso aptos para seleccion en el modal. */
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

  /** Busca una integracion Kapso local por su PK interna. */
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

  // --------------------------------------------------------------------------
  // CRUD DE RELACIONES
  // --------------------------------------------------------------------------

  async findRelationById(id: number) {
    return this.relationRepository.findOne({
      where: { id },
    });
  }

  async findDuplicateRelation(idnetsuiteAdmin: number, kapsoPhoneNumberId: number, excludeId?: number) {
    const relation = await this.relationRepository.findOne({
      where: {
        idnetsuiteAdmin,
        kapsoPhoneNumberId,
      },
    });

    if (!relation) {
      return null;
    }

    if (excludeId && relation.id === excludeId) {
      return null;
    }

    return relation;
  }

  async createRelation(input: { idnetsuiteAdmin: number; kapsoPhoneNumberId: number; status: AdminKapsoIntegrationStatus }) {
    const relation = this.relationRepository.create(input);
    return this.relationRepository.save(relation);
  }

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

  async updateRelationStatus(relation: AdminKapsoIntegrationEntity, status: AdminKapsoIntegrationStatus) {
    relation.status = status;
    return this.relationRepository.save(relation);
  }

  async deleteRelation(relation: AdminKapsoIntegrationEntity) {
    await this.relationRepository.remove(relation);
    return { id: relation.id };
  }

  // --------------------------------------------------------------------------
  // LISTADOS DETALLADOS
  // --------------------------------------------------------------------------

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

    const countRows = await this.dataSource.query(
      `
        SELECT COUNT(*) AS total
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

  /** Resuelve integraciones operativas activas por administrador. */
  async listActiveIntegrationsByAdmin(idnetsuiteAdmin: number) {
    const rows = await this.dataSource.query(
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

    return rows;
  }

  /** Lista candidatos del primer contacto sin enviar ningun mensaje. */
  async listLeadTemplateCandidates(batchSize: number): Promise<LeadTemplateCandidateRecord[]> {
    const rows = await this.dataSource.query(
      `
        SELECT
          leads.*,
          leads.id_lead AS leadId,
          leads.idinterno_lead AS internalLeadId,
          leads.id_empleado_lead AS idEmpleadoLead,
          picked.idnetsuite_admin AS adminId,
          picked.name_admin AS adminName,
          picked.email_admin AS adminEmail,
          picked.status_admin AS adminStatus,
          relation.id_admin_kapso_integration AS kapsoRelationId,
          relation.id_kapso_phone_number AS kapsoPhoneNumberId,
          phone.phone_number_id AS phoneNumberId,
          phone.display_phone_number AS displayPhoneNumber
        FROM leads
        LEFT JOIN (
          SELECT
            idnetsuite_admin,
            COALESCE(
              MAX(CASE WHEN status_admin = 1 THEN id_admin END),
              MAX(id_admin)
            ) AS selected_id_admin
          FROM admins
          WHERE idnetsuite_admin IS NOT NULL
          GROUP BY idnetsuite_admin
        ) admin_pick
          ON admin_pick.idnetsuite_admin = leads.id_empleado_lead
        LEFT JOIN admins picked
          ON picked.id_admin = admin_pick.selected_id_admin
        LEFT JOIN (
          SELECT
            active_relation.idnetsuite_admin,
            MIN(active_relation.id_admin_kapso_integration) AS relation_id
          FROM admin_kapso_integrations active_relation
          INNER JOIN kapso_phone_numbers active_phone
            ON active_phone.id = active_relation.id_kapso_phone_number
          WHERE active_relation.status_admin_kapso_integration = 1
            AND active_phone.active = 1
          GROUP BY active_relation.idnetsuite_admin
        ) active_relation
          ON active_relation.idnetsuite_admin = leads.id_empleado_lead
        LEFT JOIN admin_kapso_integrations relation
          ON relation.id_admin_kapso_integration = active_relation.relation_id
        LEFT JOIN kapso_phone_numbers phone
          ON phone.id = relation.id_kapso_phone_number
        WHERE leads.segimineto_lead = ?
          AND leads.whatsapp_template_contact_sent = ?
          AND leads.estado_lead = ?
        ORDER BY leads.id_lead ASC
        LIMIT ?
      `,
      ["01-LEAD-INTERESADO", 2, 1, batchSize],
    );

    return rows as LeadTemplateCandidateRecord[];
  }

  /** Marca un lead sin asignacion y deja una bitacora atomica del motivo. */
  async markLeadTemplateCandidateSkipped(leadId: number, internalLeadId: number, adminId: number, leadStatus: number) {
    return this.dataSource.transaction(async (manager) => {
      const updateResult = await manager.query(
        `
          UPDATE leads
          SET whatsapp_template_contact_sent = 0
          WHERE id_lead = ?
            AND segimineto_lead = ?
            AND whatsapp_template_contact_sent = ?
            AND estado_lead = ?
        `,
        [leadId, "01-LEAD-INTERESADO", 2, leadStatus],
      );

      if (Number(updateResult?.affectedRows ?? 0) !== 1) {
        return false;
      }

      await manager.query(
        `
          INSERT INTO bitacoras (
            id_lead_bit,
            id_admin_bit,
            detalle_bit,
            tipo_documento_bit,
            estado_bit,
            estado_lead,
            fech_seg_bit
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          internalLeadId,
          adminId,
          "No se logro enviar el template inicial porque el asesor aun no esta configurado o asignado a algun numero en Kapso. Revisar con el administrador.",
          "Kapso",
          "No enviado",
          leadStatus,
          "",
        ],
      );

      return true;
    });
  }

  /** Cierra de forma atomica el flujo cuando el cliente responde explicitamente `No, gracias`. */
  async markLeadFlowAnsweredNo(input: MarkLeadFlowAnsweredNoInput) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin
          FROM kapso_lead_flow_executions execution
          WHERE execution.phone_number_id = ?
            AND execution.lead_phone_number = ?
            AND execution.execution_status = ?
          ORDER BY execution.initial_template_sent_at DESC, execution.created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [input.phoneNumberId, input.leadPhoneNumber, "initial_template_sent"],
      );

      const execution = rows[0] as { executionId: number; internalLeadId: number; idnetsuiteAdmin: number | null } | undefined;

      if (!execution) {
        return false;
      }

      await manager.query(
        `
          UPDATE kapso_lead_flow_executions
          SET
            execution_status = ?,
            last_response_json = ?,
            last_response_at = CURRENT_TIMESTAMP,
            completed_at = CURRENT_TIMESTAMP,
            failure_reason = NULL
          WHERE id_kapso_lead_flow_execution = ?
        `,
        ["answered_no", JSON.stringify(input.responsePayload), execution.executionId],
      );

      await manager.query(
        `
          UPDATE leads
          SET
            segimineto_lead = ?,
            estado_lead = ?,
            id_Caida = ?
          WHERE idinterno_lead = ?
        `,
        ["07-LEAD-PERDIDO", 0, 67, execution.internalLeadId],
      );

      await manager.query(
        `
          INSERT INTO bitacoras (
            id_lead_bit,
            id_admin_bit,
            id_caida_bit,
            detalle_bit,
            tipo_documento_bit,
            estado_bit,
            estado_lead,
            fech_seg_bit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          execution.internalLeadId,
          execution.idnetsuiteAdmin ?? 0,
          67,
          "Cliente indico que no desea recibir informacion por WhatsApp.",
          "Kapso",
          "No desea informacion",
          0,
          "",
        ],
      );

      return true;
    });
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

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
