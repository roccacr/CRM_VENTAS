/**
 * Persistencia de flujos de negocio, proyectos permitidos y media de intro.
 *
 * Tablas: `kapso_business_flows`, `kapso_business_flow_projects`,
 * `kapso_flow_project_media` y JOINs a `proyectos` del CRM.
 */
import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

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
  introMessageTemplate: string | null;
  introOptionsJson: string | null;
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

/**
 * Repositorio de flujos de negocio Kapso, proyectos asociados y media.
 *
 * Responsabilidad: catálogo CRM (`proyectos`), configuración de
 * `kapso_business_flows` / `_projects` / `_steps` (con JOIN a
 * `kapso_template_catalog`) y CRUD soft-delete de `kapso_flow_project_media`.
 */
@Injectable()
export class KapsoFlowProjectMediaRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Lista proyectos CRM como opciones para asociar a un flow.
   *
   * Tablas: `proyectos`.
   * Por qué: el panel elige por `id_ProNetsuite` / nombre; excluye sin NetSuite
   * y opcionalmente inactivos (`estado_proyecto`).
   */
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

  /**
   * Lista flows Kapso con proyectos y pasos habilitados anidados.
   *
   * Tablas: `kapso_business_flows`, `kapso_business_flow_projects`,
   * `kapso_business_flow_steps`, `kapso_template_catalog`, JOIN CRM `proyectos`.
   * Por qué: una respuesta armada en memoria (filter por `flow_uuid`) evita N+1;
   * el JOIN a `proyectos` prioriza el nombre CRM sobre el snapshot del flow.
   */
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
          -- Preferir nombre vivo del CRM; fallback al snapshot guardado en Kapso.
          COALESCE(crm_project.Nombre_proyecto, project.project_name) AS nombreProyecto,
          project.enabled,
          project.intro_message_template AS introMessageTemplate,
          project.intro_options_json AS introOptionsJson
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
      projects: projectRows.filter((project) => project.flowUuid === flow.flowUuid).map(({ flowUuid: _flowUuid, ...project }) => project),
      steps: stepRows.filter((step) => step.flowUuid === flow.flowUuid).map(({ flowUuid: _flowUuid, ...step }) => step),
    }));
  }

  /**
   * Activa o desactiva un flow de negocio por `flow_uuid`.
   *
   * Tablas: `kapso_business_flows`.
   * Por qué: flag `enabled` sin borrar el catálogo ni sus proyectos/pasos.
   */
  async updateBusinessFlowStatus(flowUuid: string, enabled: 0 | 1) {
    const result = (await this.dataSource.query(
      `
        UPDATE kapso_business_flows
        SET enabled = ?
        WHERE flow_uuid = ?
      `,
      [enabled, flowUuid],
    )) as { affectedRows?: number } | Array<{ affectedRows?: number }>;

    const affectedRows = Array.isArray(result) ? result[0]?.affectedRows : result.affectedRows;

    return {
      ok: Number(affectedRows ?? 0) > 0,
      flowUuid,
      enabled,
    };
  }

  /**
   * Guarda copy y labels configurables de la intro por flow/proyecto.
   *
   * Tablas: `kapso_business_flow_projects`.
   * Por qué: el proyecto define cómo se presenta su intro sin cambiar código.
   */
  async updateBusinessFlowProjectIntroConfig(
    flowUuid: string,
    idProyectoNetsuite: number,
    introMessageTemplate: string,
    introOptionsJson: string,
  ) {
    await this.dataSource.query(
      `
        UPDATE kapso_business_flow_projects
        SET
          intro_message_template = ?,
          intro_options_json = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE flow_uuid = ?
          AND id_proyecto_netsuite = ?
          AND enabled = 1
        LIMIT 1
      `,
      [introMessageTemplate, introOptionsJson, flowUuid, idProyectoNetsuite],
    );

    return this.findBusinessFlowProject(flowUuid, idProyectoNetsuite);
  }

  /**
   * Asocia (o re-habilita) un proyecto CRM a un flow.
   *
   * Tablas: `proyectos` (lookup), `kapso_business_flow_projects` (upsert).
   * Por qué: UNIQUE implícito flow+proyecto_netsuite; `ON DUPLICATE KEY UPDATE`
   * reactiva (`enabled = 1`) y refresca nombre/`id_proyecto` sin duplicar.
   */
  async enableBusinessFlowProject(flowUuid: string, idProyecto: number) {
    const project = await this.findProjectByInternalOrNetSuiteId(idProyecto);

    if (!project) {
      return null;
    }

    // Upsert por UNIQUE (flow_uuid, id_proyecto_netsuite): re-habilita si ya existía.
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

  /**
   * Lista todos los vínculos flow↔proyecto, incluidos inactivos/duplicados.
   *
   * Tablas: `proyectos` (resolución de ID), `kapso_business_flow_projects`.
   * Por qué: la baja limpia necesita ubicar todas las filas y carpetas del
   * proyecto, no solo la asociación activa que ve la pantalla.
   */
  async listBusinessFlowProjectsByIdentifier(flowUuid: string, idProyecto: number) {
    const project = await this.findProjectByInternalOrNetSuiteId(idProyecto);
    const idProyectoNetsuite = project?.idProNetsuite ?? idProyecto;

    const rows = await this.dataSource.query(
      `
        SELECT
          flow_project.id_kapso_business_flow_project AS id,
          flow_project.id_proyecto AS idProyecto,
          flow_project.id_proyecto_netsuite AS idProyectoNetsuite,
          flow_project.project_name AS projectName,
          COALESCE(crm_project.Nombre_proyecto, flow_project.project_name) AS nombreProyecto,
          flow_project.enabled
        FROM kapso_business_flow_projects flow_project
        LEFT JOIN proyectos crm_project
          ON crm_project.id_ProNetsuite = flow_project.id_proyecto_netsuite
        WHERE flow_project.flow_uuid = ?
          AND flow_project.id_proyecto_netsuite = ?
        ORDER BY flow_project.id_kapso_business_flow_project ASC
      `,
      [flowUuid, idProyectoNetsuite],
    );

    return rows as KapsoBusinessFlowProjectRecord[];
  }

  /**
   * Elimina definitivamente el vínculo flow↔proyecto.
   *
   * Tablas: `proyectos` (resolución de ID), `kapso_business_flow_projects`.
   * Por qué: al quitar un proyecto del flujo no debe quedar basura funcional
   * ni filas viejas que luego puedan mezclarse en la UI.
   */
  async deleteBusinessFlowProject(flowUuid: string, idProyecto: number) {
    const project = await this.findProjectByInternalOrNetSuiteId(idProyecto);
    const idProyectoNetsuite = project?.idProNetsuite ?? idProyecto;

    const result = (await this.dataSource.query(
      `
        DELETE FROM kapso_business_flow_projects
        WHERE flow_uuid = ?
          AND id_proyecto_netsuite = ?
      `,
      [flowUuid, idProyectoNetsuite],
    )) as { affectedRows?: number } | Array<{ affectedRows?: number }>;

    const affectedRows = Array.isArray(result) ? result[0]?.affectedRows : result.affectedRows;

    return {
      ok: true,
      flowUuid,
      idProyecto: project?.idProyecto ?? null,
      idProyectoNetsuite,
      deletedProjects: Number(affectedRows ?? 0),
    };
  }

  /**
   * Retira definitivamente el proyecto del flujo.
   *
   * Por qué: conserva el nombre histórico del método para no cambiar rutas ni
   * consumidores, pero ya no deja filas inactivas que ensucien la configuración.
   */
  async disableBusinessFlowProject(flowUuid: string, idProyecto: number) {
    return this.deleteBusinessFlowProject(flowUuid, idProyecto);
  }

  /**
   * Lista toda la media de un flow/proyecto, activa o retirada.
   *
   * Tablas: `kapso_flow_project_media`.
   * Por qué: la baja limpia del proyecto debe eliminar metadata vieja y activa.
   */
  async listFlowProjectMediaForProject(flowUuid: string, idProyectoNetsuite: number) {
    return this.queryFlowProjectMedia(
      `
        WHERE media.flow_uuid = ?
          AND media.id_proyecto_netsuite = ?
        ORDER BY media.step_code ASC, media.sort_order ASC, media.id_kapso_flow_project_media ASC
      `,
      [flowUuid, idProyectoNetsuite],
    );
  }

  /**
   * Elimina metadata de media asociada a un flow/proyecto.
   *
   * Tablas: `kapso_flow_project_media`.
   * Por qué: al quitar el proyecto del flujo, los adjuntos dejan de existir
   * para esa configuración y no deben reaparecer como registros huérfanos.
   */
  async deleteFlowProjectMediaForProject(flowUuid: string, idProyectoNetsuite: number) {
    const result = (await this.dataSource.query(
      `
        DELETE FROM kapso_flow_project_media
        WHERE flow_uuid = ?
          AND id_proyecto_netsuite = ?
      `,
      [flowUuid, idProyectoNetsuite],
    )) as { affectedRows?: number } | Array<{ affectedRows?: number }>;

    const affectedRows = Array.isArray(result) ? result[0]?.affectedRows : result.affectedRows;

    return {
      flowUuid,
      idProyectoNetsuite,
      deletedMedia: Number(affectedRows ?? 0),
    };
  }

  /**
   * Obtiene un proyecto de flow por `flow_uuid` + NetSuite, con nombre CRM.
   *
   * Tablas: `kapso_business_flow_projects`, LEFT JOIN `proyectos`.
   * Por qué: detalle post-upsert y validación de asociación.
   */
  async findBusinessFlowProject(flowUuid: string, idProyectoNetsuite: number) {
    const rows = await this.dataSource.query(
      `
        SELECT
          project.id_kapso_business_flow_project AS id,
          project.id_proyecto AS idProyecto,
          project.id_proyecto_netsuite AS idProyectoNetsuite,
          project.project_name AS projectName,
          COALESCE(crm_project.Nombre_proyecto, project.project_name) AS nombreProyecto,
          project.enabled,
          project.intro_message_template AS introMessageTemplate,
          project.intro_options_json AS introOptionsJson
        FROM kapso_business_flow_projects project
        LEFT JOIN proyectos crm_project
          ON crm_project.id_ProNetsuite = project.id_proyecto_netsuite
        WHERE project.flow_uuid = ?
          AND project.id_proyecto_netsuite = ?
        ORDER BY project.enabled DESC, project.id_kapso_business_flow_project DESC
        LIMIT 1
      `,
      [flowUuid, idProyectoNetsuite],
    );

    return (rows[0] ?? null) as KapsoBusinessFlowProjectRecord | null;
  }

  /**
   * Lista media activa de un flow/proyecto/paso (default step `intro`).
   *
   * Tablas: `kapso_flow_project_media` (`status = 1`).
   * Por qué: assets vigentes para envío/UI; soft-delete excluye `status = 0`.
   */
  async listFlowProjectMedia(flowUuid: string, idProyectoNetsuite: number, stepCode = "intro") {
    return this.queryFlowProjectMedia(
      `
        WHERE media.flow_uuid = ?
          AND media.id_proyecto_netsuite = ?
          AND media.step_code = ?
          AND media.status = 1
        ORDER BY media.sort_order ASC, media.id_kapso_flow_project_media ASC
      `,
      [flowUuid, idProyectoNetsuite, stepCode],
    );
  }

  /**
   * Alias de listado de media activa (mismo filtro `status = 1`).
   *
   * Tablas: `kapso_flow_project_media`.
   * Por qué: semántica explícita para consumidores que solo quieren activos.
   */
  async listActiveFlowProjectMedia(flowUuid: string, idProyectoNetsuite: number, stepCode = "intro") {
    return this.queryFlowProjectMedia(
      `
        WHERE media.flow_uuid = ?
          AND media.id_proyecto_netsuite = ?
          AND media.step_code = ?
          AND media.status = 1
        ORDER BY media.sort_order ASC, media.id_kapso_flow_project_media ASC
      `,
      [flowUuid, idProyectoNetsuite, stepCode],
    );
  }

  /**
   * Inserta un archivo de media asociado a flow + proyecto + paso.
   *
   * Tablas: `kapso_flow_project_media` (`status = 1` al crear).
   * Por qué: alta de asset; metadatos de storage (path, mime, tamaño, orden).
   */
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

  /**
   * Busca media por PK interna (incluye soft-deleted).
   *
   * Tablas: `kapso_flow_project_media`.
   */
  async findFlowProjectMediaById(id: number) {
    const rows = await this.queryFlowProjectMedia("WHERE media.id_kapso_flow_project_media = ? LIMIT 1", [id]);
    return rows[0] ?? null;
  }

  /**
   * Busca media activa por nombre de archivo almacenado.
   *
   * Tablas: `kapso_flow_project_media` (`status = 1`).
   * Por qué: resolución desde storage/URL sin conocer la PK.
   */
  async findFlowProjectMediaByStoredFilename(storedFilename: string) {
    const rows = await this.queryFlowProjectMedia("WHERE media.stored_filename = ? AND media.status = 1 LIMIT 1", [storedFilename]);
    return rows[0] ?? null;
  }

  /**
   * Soft-delete de media: marca `status = 0` sin borrar el archivo en BD.
   *
   * Tablas: `kapso_flow_project_media`.
   * Por qué: conserva historial y evita reutilizar la fila como activa.
   */
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
        -- Preferir match por PK interna si ambos coinciden numéricamente.
        ORDER BY CASE WHEN project.id_proyecto = ? THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [idProyecto, idProyecto, idProyecto],
    );

    return (rows[0] ?? null) as KapsoProjectOptionRecord | null;
  }

  private async queryFlowProjectMedia(whereClause: string, params: Array<string | number>) {
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
        ${whereClause}
      `,
      params,
    );

    return rows as FlowProjectMediaRecord[];
  }
}
