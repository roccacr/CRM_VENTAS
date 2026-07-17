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

export type KapsoProjectOptionRecord = {
  idProyecto: number;
  idProNetsuite: number;
  name: string;
  nombreProyecto: string;
  status: number;
};

export type KapsoBusinessFlowProjectRecord = {
  id: number;
  idProyecto: number | null;
  idProyectoNetsuite: number;
  nombreProyecto: string | null;
  projectName: string | null;
  enabled: 0 | 1;
};

export type KapsoBusinessFlowStepRecord = {
  id: number;
  stepCode: string;
  stepName: string;
  stepType: string;
  sortOrder: number;
  enabled: 0 | 1;
  templateActionCode: string | null;
  templateName: string | null;
  templateExternalId: string | null;
  templateLanguage: string | null;
  templateCategory: string | null;
  templateStatus: string | null;
  templatePreview: string | null;
  parameterCount: number | null;
};

export type KapsoBusinessFlowRecord = {
  id: number;
  flowUuid: string;
  flowCode: string;
  flowName: string;
  description: string | null;
  status: string;
  enabled: 0 | 1;
  projects: KapsoBusinessFlowProjectRecord[];
  steps: KapsoBusinessFlowStepRecord[];
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

export type MarkLeadFlowAnsweredYesInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  responsePayload: Record<string, unknown>;
};

export type LeadFlowAnsweredYesContext = {
  executionId: number;
  internalLeadId: number;
  idnetsuiteAdmin: number | null;
  idProyectoNetsuite: number | null;
  leadName: string | null;
  projectName: string | null;
  phoneNumberId: string;
  leadPhoneNumber: string;
  projectExternalId: string | null;
};

export type FlowProjectMediaRecord = {
  id: number;
  flowUuid: string;
  idProyectoNetsuite: number;
  stepCode: string;
  mediaType: "image" | "video" | "document";
  originalName: string;
  storedFilename: string;
  relativePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  status: 0 | 1;
  createdAt: string;
  updatedAt: string;
};

export type SaveFlowProjectMediaInput = {
  flowUuid: string;
  idProyectoNetsuite: number;
  stepCode: string;
  mediaType: "image" | "video" | "document";
  originalName: string;
  storedFilename: string;
  relativePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
};

export type IntroFlowExecutionUpdateInput = {
  executionId: number;
  failureReason?: string | null;
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

  /** Lista proyectos CRM activos para asociarlos a flujos Kapso. */
  async listProjectOptions(params: { search?: string; includeInactive?: boolean }) {
    const where: string[] = ["project.id_ProNetsuite IS NOT NULL"];
    const queryParams: Array<string | number> = [];

    if (!params.includeInactive) {
      where.push("project.estado_proyecto = 1");
    }

    if (params.search) {
      where.push("(project.Nombre_proyecto LIKE ? OR CAST(project.id_ProNetsuite AS CHAR) LIKE ?)");
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const rows = await this.dataSource.query(
      `
        SELECT
          project.id_proyecto AS idProyecto,
          project.id_ProNetsuite AS idProNetsuite,
          project.Nombre_proyecto AS name,
          project.Nombre_proyecto AS nombreProyecto,
          project.estado_proyecto AS status
        FROM proyectos project
        WHERE ${where.join(" AND ")}
        ORDER BY project.Nombre_proyecto ASC, project.id_ProNetsuite ASC
      `,
      queryParams,
    );

    return rows as KapsoProjectOptionRecord[];
  }

  /** Lista flujos de negocio con sus pasos y proyectos permitidos. */
  async listBusinessFlows() {
    const flowRows = (await this.dataSource.query(
      `
        SELECT
          flow.id_kapso_business_flow AS id,
          flow.flow_uuid AS flowUuid,
          flow.flow_code AS flowCode,
          flow.flow_name AS flowName,
          flow.description,
          flow.status,
          flow.enabled
        FROM kapso_business_flows flow
        WHERE flow.enabled = 1
        ORDER BY flow.flow_name ASC, flow.id_kapso_business_flow ASC
      `,
    )) as Array<Omit<KapsoBusinessFlowRecord, "projects" | "steps">>;

    if (flowRows.length === 0) {
      return [];
    }

    const flowUuids = flowRows.map((flow) => flow.flowUuid);
    const placeholders = flowUuids.map(() => "?").join(", ");

    const projectRows = (await this.dataSource.query(
      `
        SELECT
          project.id_kapso_business_flow_project AS id,
          project.flow_uuid AS flowUuid,
          project.id_proyecto AS idProyecto,
          project.id_proyecto_netsuite AS idProyectoNetsuite,
          project.project_name AS projectName,
          COALESCE(crm_project.Nombre_proyecto, project.project_name) AS nombreProyecto,
          project.enabled
        FROM kapso_business_flow_projects project
        LEFT JOIN proyectos crm_project
          ON crm_project.id_ProNetsuite = project.id_proyecto_netsuite
        WHERE project.flow_uuid IN (${placeholders})
          AND project.enabled = 1
        ORDER BY COALESCE(crm_project.Nombre_proyecto, project.project_name) ASC
      `,
      flowUuids,
    )) as Array<KapsoBusinessFlowProjectRecord & { flowUuid: string }>;

    const stepRows = (await this.dataSource.query(
      `
        SELECT
          step.id_kapso_business_flow_step AS id,
          step.flow_uuid AS flowUuid,
          step.step_code AS stepCode,
          step.step_name AS stepName,
          step.step_type AS stepType,
          step.sort_order AS sortOrder,
          step.enabled,
          step.template_action_code AS templateActionCode,
          template.template_name AS templateName,
          template.template_external_id AS templateExternalId,
          template.template_language AS templateLanguage,
          template.template_category AS templateCategory,
          template.template_status AS templateStatus,
          template.template_preview AS templatePreview,
          template.parameter_count AS parameterCount
        FROM kapso_business_flow_steps step
        LEFT JOIN kapso_template_catalog template
          ON template.action_code = step.template_action_code
        WHERE step.flow_uuid IN (${placeholders})
          AND step.enabled = 1
        ORDER BY step.sort_order ASC, step.id_kapso_business_flow_step ASC
      `,
      flowUuids,
    )) as Array<KapsoBusinessFlowStepRecord & { flowUuid: string }>;

    return flowRows.map((flow) => ({
      ...flow,
      projects: projectRows
        .filter((project) => project.flowUuid === flow.flowUuid)
        .map(({ flowUuid: _flowUuid, ...project }) => project),
      steps: stepRows.filter((step) => step.flowUuid === flow.flowUuid).map(({ flowUuid: _flowUuid, ...step }) => step),
    }));
  }

  /** Habilita un proyecto CRM para ejecutar un flujo de negocio Kapso. */
  async enableBusinessFlowProject(flowUuid: string, idProyecto: number) {
    const project = await this.findProjectByInternalOrNetSuiteId(idProyecto);

    if (!project) {
      return null;
    }

    await this.dataSource.query(
      `
        INSERT INTO kapso_business_flow_projects (
          flow_uuid,
          id_proyecto,
          id_proyecto_netsuite,
          project_name,
          enabled
        ) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          id_proyecto = VALUES(id_proyecto),
          project_name = VALUES(project_name),
          enabled = VALUES(enabled)
      `,
      [flowUuid, project.idProyecto, project.idProNetsuite, project.nombreProyecto, 1],
    );

    return this.findBusinessFlowProject(flowUuid, project.idProNetsuite);
  }

  /** Deshabilita un proyecto del flujo sin borrar auditoria/configuracion historica. */
  async disableBusinessFlowProject(flowUuid: string, idProyecto: number) {
    const project = await this.findProjectByInternalOrNetSuiteId(idProyecto);
    const idProyectoNetsuite = project?.idProNetsuite ?? idProyecto;

    await this.dataSource.query(
      `
        UPDATE kapso_business_flow_projects
        SET enabled = 0
        WHERE flow_uuid = ?
          AND id_proyecto_netsuite = ?
      `,
      [flowUuid, idProyectoNetsuite],
    );

    return { ok: true, flowUuid, idProyecto: project?.idProyecto ?? null, idProyectoNetsuite };
  }

  private async findProjectByInternalOrNetSuiteId(idProyecto: number) {
    const rows = await this.dataSource.query(
      `
        SELECT
          project.id_proyecto AS idProyecto,
          project.id_ProNetsuite AS idProNetsuite,
          project.Nombre_proyecto AS nombreProyecto,
          project.estado_proyecto AS status
        FROM proyectos project
        WHERE project.id_proyecto = ?
           OR project.id_ProNetsuite = ?
        ORDER BY CASE WHEN project.id_proyecto = ? THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [idProyecto, idProyecto, idProyecto],
    );

    return (rows[0] ?? null) as KapsoProjectOptionRecord | null;
  }

  async findBusinessFlowProject(flowUuid: string, idProyectoNetsuite: number) {
    const rows = await this.dataSource.query(
      `
        SELECT
          project.id_kapso_business_flow_project AS id,
          project.id_proyecto AS idProyecto,
          project.id_proyecto_netsuite AS idProyectoNetsuite,
          project.project_name AS projectName,
          COALESCE(crm_project.Nombre_proyecto, project.project_name) AS nombreProyecto,
          project.enabled
        FROM kapso_business_flow_projects project
        LEFT JOIN proyectos crm_project
          ON crm_project.id_ProNetsuite = project.id_proyecto_netsuite
        WHERE project.flow_uuid = ?
          AND project.id_proyecto_netsuite = ?
        LIMIT 1
      `,
      [flowUuid, idProyectoNetsuite],
    );

    return (rows[0] ?? null) as KapsoBusinessFlowProjectRecord | null;
  }

  /** Lista los adjuntos configurados para un paso de un flujo en un proyecto CRM. */
  async listFlowProjectMedia(flowUuid: string, idProyectoNetsuite: number, stepCode = "intro") {
    const rows = await this.dataSource.query(
      `
        SELECT
          media.id_kapso_flow_project_media AS id,
          media.flow_uuid AS flowUuid,
          media.id_proyecto_netsuite AS idProyectoNetsuite,
          media.step_code AS stepCode,
          media.media_type AS mediaType,
          media.original_name AS originalName,
          media.stored_filename AS storedFilename,
          media.relative_path AS relativePath,
          media.public_url AS publicUrl,
          media.mime_type AS mimeType,
          media.file_size AS fileSize,
          media.sort_order AS sortOrder,
          media.status,
          media.created_at AS createdAt,
          media.updated_at AS updatedAt
        FROM kapso_flow_project_media media
        WHERE media.flow_uuid = ?
          AND media.id_proyecto_netsuite = ?
          AND media.step_code = ?
          AND media.status = 1
        ORDER BY media.sort_order ASC, media.id_kapso_flow_project_media ASC
      `,
      [flowUuid, idProyectoNetsuite, stepCode],
    );

    return rows as FlowProjectMediaRecord[];
  }

  /** Lista solo adjuntos activos para envio automatico del flujo. */
  async listActiveFlowProjectMedia(flowUuid: string, idProyectoNetsuite: number, stepCode = "intro") {
    const rows = await this.dataSource.query(
      `
        SELECT
          media.id_kapso_flow_project_media AS id,
          media.flow_uuid AS flowUuid,
          media.id_proyecto_netsuite AS idProyectoNetsuite,
          media.step_code AS stepCode,
          media.media_type AS mediaType,
          media.original_name AS originalName,
          media.stored_filename AS storedFilename,
          media.relative_path AS relativePath,
          media.public_url AS publicUrl,
          media.mime_type AS mimeType,
          media.file_size AS fileSize,
          media.sort_order AS sortOrder,
          media.status,
          media.created_at AS createdAt,
          media.updated_at AS updatedAt
        FROM kapso_flow_project_media media
        WHERE media.flow_uuid = ?
          AND media.id_proyecto_netsuite = ?
          AND media.step_code = ?
          AND media.status = 1
        ORDER BY media.sort_order ASC, media.id_kapso_flow_project_media ASC
      `,
      [flowUuid, idProyectoNetsuite, stepCode],
    );

    return rows as FlowProjectMediaRecord[];
  }

  /** Guarda metadata de un adjunto subido desde el CRM. */
  async createFlowProjectMedia(input: SaveFlowProjectMediaInput) {
    const result = await this.dataSource.query(
      `
        INSERT INTO kapso_flow_project_media (
          flow_uuid,
          id_proyecto_netsuite,
          step_code,
          media_type,
          original_name,
          stored_filename,
          relative_path,
          public_url,
          mime_type,
          file_size,
          sort_order,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.flowUuid,
        input.idProyectoNetsuite,
        input.stepCode,
        input.mediaType,
        input.originalName,
        input.storedFilename,
        input.relativePath,
        input.publicUrl,
        input.mimeType,
        input.fileSize,
        input.sortOrder,
        1,
      ],
    );

    const insertId = Number(result?.insertId ?? 0);
    return this.findFlowProjectMediaById(insertId);
  }

  /** Busca un adjunto por PK para servirlo o devolverlo al frontend. */
  async findFlowProjectMediaById(id: number) {
    const rows = await this.dataSource.query(
      `
        SELECT
          media.id_kapso_flow_project_media AS id,
          media.flow_uuid AS flowUuid,
          media.id_proyecto_netsuite AS idProyectoNetsuite,
          media.step_code AS stepCode,
          media.media_type AS mediaType,
          media.original_name AS originalName,
          media.stored_filename AS storedFilename,
          media.relative_path AS relativePath,
          media.public_url AS publicUrl,
          media.mime_type AS mimeType,
          media.file_size AS fileSize,
          media.sort_order AS sortOrder,
          media.status,
          media.created_at AS createdAt,
          media.updated_at AS updatedAt
        FROM kapso_flow_project_media media
        WHERE media.id_kapso_flow_project_media = ?
        LIMIT 1
      `,
      [id],
    );

    return (rows[0] ?? null) as FlowProjectMediaRecord | null;
  }

  /** Busca un adjunto por nombre fisico para servir archivos sin exponer rutas internas. */
  async findFlowProjectMediaByStoredFilename(storedFilename: string) {
    const rows = await this.dataSource.query(
      `
        SELECT
          media.id_kapso_flow_project_media AS id,
          media.flow_uuid AS flowUuid,
          media.id_proyecto_netsuite AS idProyectoNetsuite,
          media.step_code AS stepCode,
          media.media_type AS mediaType,
          media.original_name AS originalName,
          media.stored_filename AS storedFilename,
          media.relative_path AS relativePath,
          media.public_url AS publicUrl,
          media.mime_type AS mimeType,
          media.file_size AS fileSize,
          media.sort_order AS sortOrder,
          media.status,
          media.created_at AS createdAt,
          media.updated_at AS updatedAt
        FROM kapso_flow_project_media media
        WHERE media.stored_filename = ?
          AND media.status = 1
        LIMIT 1
      `,
      [storedFilename],
    );

    return (rows[0] ?? null) as FlowProjectMediaRecord | null;
  }

  /** Desactiva un adjunto sin borrar el archivo fisico ni perder auditoria. */
  async deactivateFlowProjectMedia(id: number) {
    await this.dataSource.query(
      `
        UPDATE kapso_flow_project_media
        SET status = 0
        WHERE id_kapso_flow_project_media = ?
      `,
      [id],
    );

    return this.findFlowProjectMediaById(id);
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

  /**
   * Avanza de forma atomica el flujo cuando el cliente acepta recibir informacion.
   * No completa el flujo: queda listo para que el siguiente template se configure y envie.
   */
  async markLeadFlowAnsweredYes(input: MarkLeadFlowAnsweredYesInput) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin,
            execution.id_proyecto_netsuite AS idProyectoNetsuite,
            execution.phone_number_id AS phoneNumberId,
            execution.lead_phone_number AS leadPhoneNumber,
            lead.nombre_lead AS leadName,
            lead.proyecto_lead AS projectName,
            phone.project_external_id AS projectExternalId
          FROM kapso_lead_flow_executions execution
          LEFT JOIN leads lead
            ON lead.idinterno_lead = execution.idinterno_lead
          LEFT JOIN kapso_phone_numbers phone
            ON phone.phone_number_id = execution.phone_number_id
          WHERE execution.phone_number_id = ?
            AND execution.lead_phone_number = ?
            AND execution.execution_status = ?
          ORDER BY execution.initial_template_sent_at DESC, execution.created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [input.phoneNumberId, input.leadPhoneNumber, "initial_template_sent"],
      );

      const execution = rows[0] as LeadFlowAnsweredYesContext | undefined;

      if (!execution) {
        return null;
      }

      await manager.query(
        `
          UPDATE kapso_lead_flow_executions
          SET
            execution_status = ?,
            last_response_json = ?,
            last_response_at = CURRENT_TIMESTAMP,
            completed_at = NULL,
            failure_reason = NULL
          WHERE id_kapso_lead_flow_execution = ?
        `,
        ["answered_yes", JSON.stringify(input.responsePayload), execution.executionId],
      );

      await manager.query(
        `
          UPDATE leads
          SET
            segimineto_lead = ?,
            accion_lead = ?,
            actualizadaaccion_lead = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'),
            whatsapp_template_contact_sent = ?
          WHERE idinterno_lead = ?
        `,
        ["08-LEAD-SEGUIMIENTO", 6, 0, execution.internalLeadId],
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
          69,
          "Cliente acepto recibir informacion por WhatsApp.",
          "Kapso",
          "Acepto informacion WhatsApp",
          1,
          "",
        ],
      );

      return execution;
    });
  }

  /** Marca que la intro normal posterior al "Si" se envio correctamente. */
  async markLeadFlowIntroSent(input: IntroFlowExecutionUpdateInput) {
    await this.dataSource.query(
      `
        UPDATE kapso_lead_flow_executions
        SET
          execution_status = ?,
          failure_reason = NULL
        WHERE id_kapso_lead_flow_execution = ?
      `,
      ["intro_sent", input.executionId],
    );
  }

  /** Marca que la intro normal no pudo enviarse, sin reabrir el saludo inicial. */
  async markLeadFlowIntroFailed(input: IntroFlowExecutionUpdateInput) {
    await this.dataSource.query(
      `
        UPDATE kapso_lead_flow_executions
        SET
          execution_status = ?,
          failure_reason = ?
        WHERE id_kapso_lead_flow_execution = ?
      `,
      ["intro_failed", input.failureReason ?? "Intro message failed", input.executionId],
    );
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
