/**
 * Persistencia del ciclo comercial de leads Kapso (candidatos, respuestas, bitácoras).
 *
 * Transacciones multi-tabla sobre `kapso_lead_flow_executions`, `leads`,
 * `bitacoras` y JOINs a `admins` / `admin_kapso_integrations` / templates.
 * Usa `FOR UPDATE` y UNIQUE `(flow_uuid, idinterno_lead)` para anti-repetición.
 */
import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

export type LeadTemplateCandidateRecord = Record<string, unknown> & {
  leadId: number;
  internalLeadId: number | null;
  idEmpleadoLead: number | null;
  leadPhoneNumberRaw: string | null;
  idProyectoNetsuite: number | null;
  projectName: string | null;
  projectExternalId: string | null;
  adminId: number | null;
  adminName: string | null;
  adminEmail: string | null;
  adminStatus: number | null;
  kapsoRelationId: number | null;
  kapsoPhoneNumberId: number | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  flowUuid: string | null;
  templateActionCode: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  templateStatus: string | null;
  templateParameterCount: number | null;
};

export type MarkLeadFlowAnsweredNoInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  contextMessageId?: string | null;
  responsePayload: Record<string, unknown>;
};

export type MarkLeadFlowAnsweredYesInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  contextMessageId?: string | null;
  responsePayload: Record<string, unknown>;
};

export type RegisterUnidentifiedInitialReplyInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  contextMessageId?: string | null;
  replyText: string;
  responsePayload: Record<string, unknown>;
};

export type MarkLeadFlowIntroOptionAnsweredInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  contextMessageId?: string | null;
  optionId: string;
  optionLabel: string;
  keepInteractiveReady?: boolean;
  nextInteractiveMessageId?: string | null;
  responsePayload: Record<string, unknown>;
};

export type FindLeadFlowIntroOptionContextInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  contextMessageId?: string | null;
};

export type LeadFlowAnsweredYesContext = {
  executionId: number;
  flowUuid: string;
  internalLeadId: number;
  idnetsuiteAdmin: number | null;
  idProyectoNetsuite: number | null;
  leadName: string | null;
  projectName: string | null;
  adminName: string | null;
  phoneNumberId: string;
  leadPhoneNumber: string;
  projectExternalId: string | null;
  introMessageTemplate: string | null;
  introOptionsJson: string | null;
};

export type LeadFlowIntroInteractiveContext = {
  executionId: number;
  phoneNumberId: string;
  projectExternalId: string | null;
  interactivePayload: Record<string, unknown>;
};

export type IntroFlowExecutionUpdateInput = {
  executionId: number;
  messageId?: string | null;
  failureReason?: string | null;
};

export type LeadFlowIntroMediaPendingInput = {
  executionId: number;
  pendingPayload: Record<string, unknown>;
};

export type ReserveInitialTemplateSendInput = {
  flowUuid: string;
  leadId: number;
  internalLeadId: number;
  idnetsuiteAdmin: number;
  idProyectoNetsuite: number | null;
  phoneNumberId: string;
  leadPhoneNumber: string;
};

export type MarkLeadTemplateCandidateInvalidPhoneInput = ReserveInitialTemplateSendInput & {
  leadStatus: number;
};

export type InitialTemplateExecutionUpdateInput = {
  executionId: number;
  messageId?: string | null;
  responsePayload?: Record<string, unknown>;
  failureReason?: string | null;
};

export type InitialTemplateDeliveryFailureInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  messageId: string | null;
  failureReason: string;
  responsePayload: Record<string, unknown>;
};

export type InitialTemplateDeliverySuccessInput = {
  phoneNumberId: string;
  leadPhoneNumber: string;
  messageId: string | null;
  deliveryStatus: "delivered" | "read";
  responsePayload: Record<string, unknown>;
};

export type IntroMediaDeliveryInput = InitialTemplateDeliverySuccessInput;
export type IntroMediaFailureInput = InitialTemplateDeliveryFailureInput;

export type IntroMediaDeliveryResult =
  | { state: "updated_pending" }
  | { state: "ready"; context: LeadFlowIntroInteractiveContext }
  | null;

export type IntroMediaFailureResult =
  | { state: "updated_pending" }
  | { state: "ready"; context: LeadFlowIntroInteractiveContext }
  | { state: "failed" }
  | null;

/**
 * Repositorio de automatización de leads vía flows Kapso (templates / respuestas).
 *
 * Responsabilidad: seleccionar candidatos CRM (`leads` + JOINs a admins,
 * integraciones y flows), reservar ejecuciones idempotentes en
 * `kapso_lead_flow_executions` (anti-repetición `flow_uuid` + `idinterno_lead`
 * con `FOR UPDATE`) y persistir bitácoras/estado del lead en transacciones.
 */
@Injectable()
export class KapsoLeadAutomationRepository {
  constructor(private readonly dataSource: DataSource) {}

  private resolveInboundExecution<T>(rows: T[], hasStrongCorrelationId: boolean): T | undefined {
    if (hasStrongCorrelationId) {
      return rows[0];
    }

    return rows.length === 1 ? rows[0] : undefined;
  }

  private async isInitialTemplateFlowReady(manager: EntityManager, flowUuid: string, idProyectoNetsuite: number | null) {
    if (idProyectoNetsuite === null) {
      return false;
    }

    const rows = await manager.query(
      `
        SELECT 1 AS ready
        FROM kapso_business_flows business_flow
        INNER JOIN kapso_business_flow_projects flow_project
          ON flow_project.flow_uuid = business_flow.flow_uuid
         AND flow_project.id_proyecto_netsuite = ?
         AND flow_project.enabled = 1
        INNER JOIN kapso_business_flow_steps step
          ON step.flow_uuid = business_flow.flow_uuid
         AND step.step_code = ?
         AND step.step_type = ?
         AND step.enabled = 1
        INNER JOIN kapso_template_catalog template
          ON template.action_code = step.template_action_code
         AND LOWER(template.template_status) = ?
        WHERE business_flow.flow_uuid = ?
          AND business_flow.enabled = 1
        LIMIT 1
      `,
      [idProyectoNetsuite, "saludo", "template", "approved", flowUuid],
    );

    return Boolean(rows[0]);
  }

  private parseJsonRecord(value: unknown): Record<string, unknown> {
    if (!value) {
      return {};
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    }

    return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private async isFlowProjectEnabled(manager: EntityManager, flowUuid: string, idProyectoNetsuite: number | null) {
    if (idProyectoNetsuite === null) {
      return false;
    }

    const rows = await manager.query(
      `
        SELECT 1 AS ready
        FROM kapso_business_flows business_flow
        INNER JOIN kapso_business_flow_projects flow_project
          ON flow_project.flow_uuid = business_flow.flow_uuid
         AND flow_project.id_proyecto_netsuite = ?
         AND flow_project.enabled = 1
        WHERE business_flow.flow_uuid = ?
          AND business_flow.enabled = 1
        LIMIT 1
      `,
      [idProyectoNetsuite, flowUuid],
    );

    return Boolean(rows[0]);
  }

  /**
   * Selecciona un lote de leads candidatos al envío del template inicial.
   *
   * Tablas: `leads`, `admins` (dedupe), `admin_kapso_integrations`,
   * `kapso_phone_numbers`, `kapso_business_flow_projects`,
   * `kapso_business_flows`, `kapso_business_flow_steps`, `kapso_template_catalog`.
   * Por qué: JOINs CRM+Kapso resuelven asesor, número, flow/proyecto habilitado
   * y template `approved` del paso `saludo`; filtra segmento interesado y flag
   * `whatsapp_template_contact_sent = 2` (pendiente de envío).
   */
  async listLeadTemplateCandidates(batchSize: number, flowUuid: string): Promise<LeadTemplateCandidateRecord[]> {
    const rows = await this.dataSource.query(
      `
        SELECT
          leads.*,
          leads.id_lead AS leadId,
          leads.idinterno_lead AS internalLeadId,
          leads.id_empleado_lead AS idEmpleadoLead,
          leads.telefono_lead AS leadPhoneNumberRaw,
          leads.idproyecto_lead AS idProyectoNetsuite,
          leads.proyecto_lead AS projectName,
          picked.idnetsuite_admin AS adminId,
          picked.name_admin AS adminName,
          picked.email_admin AS adminEmail,
          picked.status_admin AS adminStatus,
          relation.id_admin_kapso_integration AS kapsoRelationId,
          relation.id_kapso_phone_number AS kapsoPhoneNumberId,
          phone.phone_number_id AS phoneNumberId,
          phone.display_phone_number AS displayPhoneNumber,
          phone.project_external_id AS projectExternalId,
          business_flow.flow_uuid AS flowUuid,
          step.template_action_code AS templateActionCode,
          template.template_name AS templateName,
          template.template_language AS templateLanguage,
          template.template_status AS templateStatus,
          template.parameter_count AS templateParameterCount
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
          -- Una sola relación Kapso activa por admin (MIN id) para no duplicar leads.
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
        LEFT JOIN kapso_business_flow_projects flow_project
          ON flow_project.flow_uuid = ?
          AND flow_project.id_proyecto_netsuite = leads.idproyecto_lead
          AND flow_project.enabled = 1
        LEFT JOIN kapso_business_flows business_flow
          ON business_flow.flow_uuid = flow_project.flow_uuid
          AND business_flow.enabled = 1
        LEFT JOIN kapso_business_flow_steps step
          ON step.flow_uuid = business_flow.flow_uuid
          AND step.step_code = ?
          AND step.step_type = ?
          AND step.enabled = 1
        LEFT JOIN kapso_template_catalog template
          ON template.action_code = step.template_action_code
          AND LOWER(template.template_status) = ?
        WHERE leads.segimineto_lead = ?
          AND leads.whatsapp_template_contact_sent = ?
          AND leads.estado_lead = ?
        ORDER BY leads.id_lead ASC
        LIMIT ?
      `,
      [flowUuid, "saludo", "template", "approved", "01-LEAD-INTERESADO", 2, 1, batchSize],
    );

    return rows as LeadTemplateCandidateRecord[];
  }

  /**
   * Marca el lead como no enviado por falta de configuración Kapso del asesor.
   *
   * Tablas: `leads` (flag), `bitacoras` (auditoría).
   * Por qué: transacción atómica — solo escribe bitácora si el UPDATE del flag
   * (`whatsapp_template_contact_sent` 2→0) afecta exactamente 1 fila (idempotencia).
   */
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

  /**
   * Descarta candidato por teléfono inválido y registra ejecución `invalid_phone`.
   *
   * Tablas: `kapso_lead_flow_executions` (FOR UPDATE + INSERT), `leads`, `bitacoras`.
   * Por qué: transacción con lock en `flow_uuid`+`idinterno_lead` evita doble
   * ejecución; si ya existe fila no inserta otra (anti-repetición); bitácora
   * solo cuando se crea la ejecución nueva.
   */
  async markLeadTemplateCandidateInvalidPhone(input: MarkLeadTemplateCandidateInvalidPhoneInput) {
    return this.dataSource.transaction(async (manager) => {
      // Revalidacion defensiva: un flujo o proyecto apagado no debe tocar el lead,
      // incluso cuando el candidato quedo en memoria antes del cambio operativo.
      if (!(await this.isInitialTemplateFlowReady(manager, input.flowUuid, input.idProyectoNetsuite))) {
        return false;
      }

      // Anti-repetición: bloquea la pareja flow_uuid + idinterno_lead si ya existe.
      const existingRows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId
          FROM kapso_lead_flow_executions execution
          WHERE execution.flow_uuid = ?
            AND execution.idinterno_lead = ?
          LIMIT 1
          FOR UPDATE
        `,
        [input.flowUuid, input.internalLeadId],
      );

      const updateResult = await manager.query(
        `
          UPDATE leads
          SET whatsapp_template_contact_sent = 0
          WHERE id_lead = ?
            AND segimineto_lead = ?
            AND whatsapp_template_contact_sent = ?
            AND estado_lead = ?
        `,
        [input.leadId, "01-LEAD-INTERESADO", 2, input.leadStatus],
      );

      if (Number(updateResult?.affectedRows ?? 0) !== 1) {
        return false;
      }

      if (existingRows[0]) {
        return true;
      }

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
          input.internalLeadId,
          input.idnetsuiteAdmin,
          68,
          "No se logro enviar el template inicial porque el numero de telefono no es valido para WhatsApp/Kapso.",
          "Kapso",
          "Numero no valido",
          input.leadStatus,
          "",
        ],
      );

      await manager.query(
        `
          INSERT INTO kapso_lead_flow_executions (
            flow_uuid,
            idinterno_lead,
            idnetsuite_admin,
            id_proyecto_netsuite,
            phone_number_id,
            lead_phone_number,
            execution_status,
            completed_at,
            failure_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `,
        [
          input.flowUuid,
          input.internalLeadId,
          input.idnetsuiteAdmin,
          input.idProyectoNetsuite,
          input.phoneNumberId,
          input.leadPhoneNumber,
          "invalid_phone",
          "Numero de telefono no valido para WhatsApp/Kapso.",
        ],
      );

      return true;
    });
  }

  /**
   * Reserva el envío del template inicial (estado `reserved`) de forma exclusiva.
   *
   * Tablas: `leads` (claim del flag), `kapso_lead_flow_executions` (FOR UPDATE + INSERT).
   * Por qué: UPDATE condicional (flag 2→0) + lock `flow_uuid`+`idinterno_lead`
   * garantizan que un solo worker reserve; si ya hay ejecución, retorna null.
   */
  async reserveInitialTemplateSend(input: ReserveInitialTemplateSendInput) {
    return this.dataSource.transaction(async (manager) => {
      // Revalidacion defensiva: si el flujo o el proyecto se apagan despues
      // de leer candidatos, el envio debe detenerse antes de reclamar el lead.
      if (!(await this.isInitialTemplateFlowReady(manager, input.flowUuid, input.idProyectoNetsuite))) {
        return null;
      }

      // Claim optimista del lead: solo un worker pasa si el flag sigue en 2.
      const updateResult = await manager.query(
        `
          UPDATE leads
          SET whatsapp_template_contact_sent = 0
          WHERE id_lead = ?
            AND segimineto_lead = ?
            AND whatsapp_template_contact_sent = ?
            AND estado_lead = ?
        `,
        [input.leadId, "01-LEAD-INTERESADO", 2, 1],
      );

      if (Number(updateResult?.affectedRows ?? 0) !== 1) {
        return null;
      }

      // Anti-repetición flow_uuid + idinterno_lead bajo FOR UPDATE.
      const existingRows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.execution_status AS executionStatus,
            execution.initial_template_sent_at AS initialTemplateSentAt
          FROM kapso_lead_flow_executions execution
          WHERE execution.flow_uuid = ?
            AND execution.idinterno_lead = ?
          LIMIT 1
          FOR UPDATE
        `,
        [input.flowUuid, input.internalLeadId],
      );

      const existingExecution = existingRows[0] as
        | {
            executionId: number | string;
            executionStatus: string | null;
            initialTemplateSentAt: Date | string | null;
          }
        | undefined;

      if (existingExecution?.executionStatus === "reserved" && !existingExecution.initialTemplateSentAt) {
        await manager.query(
          `
            UPDATE kapso_lead_flow_executions
            SET
              idnetsuite_admin = ?,
              id_proyecto_netsuite = ?,
              phone_number_id = ?,
              lead_phone_number = ?,
              failure_reason = NULL
            WHERE id_kapso_lead_flow_execution = ?
          `,
          [input.idnetsuiteAdmin, input.idProyectoNetsuite, input.phoneNumberId, input.leadPhoneNumber, existingExecution.executionId],
        );

        return { executionId: Number(existingExecution.executionId) };
      }

      if (existingExecution) {
        return null;
      }

      const insertResult = await manager.query(
        `
          INSERT INTO kapso_lead_flow_executions (
            flow_uuid,
            idinterno_lead,
            idnetsuite_admin,
            id_proyecto_netsuite,
            phone_number_id,
            lead_phone_number,
            execution_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          input.flowUuid,
          input.internalLeadId,
          input.idnetsuiteAdmin,
          input.idProyectoNetsuite,
          input.phoneNumberId,
          input.leadPhoneNumber,
          "reserved",
        ],
      );

      return { executionId: Number(insertResult?.insertId ?? 0) };
    });
  }

  /**
   * Marca la ejecución como template inicial enviado.
   *
   * Tablas: `kapso_lead_flow_executions`.
   * Por qué: avanza el ciclo de vida a `initial_template_sent` y guarda payload.
   */
  async markInitialTemplateSent(input: InitialTemplateExecutionUpdateInput) {
    await this.dataSource.query(
      `
        UPDATE kapso_lead_flow_executions
        SET
          execution_status = ?,
          initial_template_message_id = ?,
          initial_template_sent_at = CURRENT_TIMESTAMP,
          last_response_json = ?,
          completed_at = NULL,
          failure_reason = NULL
        WHERE id_kapso_lead_flow_execution = ?
      `,
      ["initial_template_sent", input.messageId ?? null, JSON.stringify(input.responsePayload ?? {}), input.executionId],
    );
  }

  /**
   * Marca la ejecución como fallida en el envío del template inicial.
   *
   * Tablas: `kapso_lead_flow_executions`.
   * Por qué: cierra con `completed_at` y `failure_reason` para no reintentar
   * el mismo envío sin intervención.
   */
  async markInitialTemplateFailed(input: InitialTemplateExecutionUpdateInput) {
    await this.dataSource.query(
      `
        UPDATE kapso_lead_flow_executions
        SET
          execution_status = ?,
          completed_at = CURRENT_TIMESTAMP,
          failure_reason = ?
        WHERE id_kapso_lead_flow_execution = ?
      `,
      ["initial_template_failed", input.failureReason ?? "Initial template failed", input.executionId],
    );
  }

  /**
   * Marca como fallida una plantilla que Kapso acepto inicialmente, pero Meta
   * rechazo luego por webhook asincronico.
   *
   * Tablas: `kapso_lead_flow_executions`, `leads`, `bitacoras`.
   * Por que: no se reintenta automaticamente un fallo terminal de entrega, pero
   * el asesor conserva trazabilidad del motivo dentro del CRM.
   */
  async markInitialTemplateDeliveryFailed(input: InitialTemplateDeliveryFailureInput) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.flow_uuid AS flowUuid,
            execution.id_proyecto_netsuite AS idProyectoNetsuite,
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin,
            crm_lead.estado_lead AS leadStatus
          FROM kapso_lead_flow_executions execution
          LEFT JOIN leads crm_lead
            ON crm_lead.idinterno_lead = execution.idinterno_lead
          WHERE execution.phone_number_id = ?
            AND execution.execution_status = ?
            AND (
              (? IS NOT NULL AND execution.initial_template_message_id = ?)
              OR (? IS NULL AND execution.lead_phone_number = ?)
            )
          ORDER BY execution.initial_template_sent_at DESC, execution.created_at DESC
          LIMIT 2
          FOR UPDATE
        `,
        [
          input.phoneNumberId,
          "initial_template_sent",
          input.messageId,
          input.messageId,
          input.messageId,
          input.leadPhoneNumber,
        ],
      );

      const execution = this.resolveInboundExecution(rows, Boolean(input.messageId)) as
        | {
            executionId: number;
            flowUuid: string;
            idnetsuiteAdmin: number | null;
            idProyectoNetsuite: number | null;
            internalLeadId: number;
            leadStatus: number | null;
          }
        | undefined;

      if (!execution) {
        return false;
      }

      if (!(await this.isFlowProjectEnabled(manager, execution.flowUuid, execution.idProyectoNetsuite))) {
        return false;
      }

      await manager.query(
        `
          UPDATE kapso_lead_flow_executions
          SET
            execution_status = ?,
            completed_at = CURRENT_TIMESTAMP,
            failure_reason = ?,
            last_response_json = ?,
            last_response_at = CURRENT_TIMESTAMP
          WHERE id_kapso_lead_flow_execution = ?
        `,
        ["initial_template_failed", input.failureReason, JSON.stringify(input.responsePayload), execution.executionId],
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
          68,
          `No se logro entregar el template inicial por WhatsApp. Motivo: ${input.failureReason}. El flujo Kapso queda cerrado para evitar reintentos automaticos.`,
          "Kapso",
          "Template no entregado",
          execution.leadStatus ?? 1,
          "",
        ],
      );

      return true;
    });
  }

  /**
   * Confirma entrega real del template inicial cuando Meta/Kapso reporta
   * `delivered` o `read`.
   *
   * Tablas: `kapso_lead_flow_executions`, `leads`, `caidas`, `bitacoras`.
   * Por que: el POST a Kapso puede devolver 200 antes del estado final; solo el
   * webhook asincronico confirma que el lead recibio el mensaje.
   */
  async markInitialTemplateDeliverySucceeded(input: InitialTemplateDeliverySuccessInput) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.flow_uuid AS flowUuid,
            execution.id_proyecto_netsuite AS idProyectoNetsuite,
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin,
            crm_lead.estado_lead AS leadStatus
          FROM kapso_lead_flow_executions execution
          LEFT JOIN leads crm_lead
            ON crm_lead.idinterno_lead = execution.idinterno_lead
          WHERE execution.phone_number_id = ?
            AND execution.execution_status = ?
            AND (
              (? IS NOT NULL AND execution.initial_template_message_id = ?)
              OR (? IS NULL AND execution.lead_phone_number = ?)
            )
          ORDER BY execution.initial_template_sent_at DESC, execution.created_at DESC
          LIMIT 2
          FOR UPDATE
        `,
        [
          input.phoneNumberId,
          "initial_template_sent",
          input.messageId,
          input.messageId,
          input.messageId,
          input.leadPhoneNumber,
        ],
      );

      const execution = this.resolveInboundExecution(rows, Boolean(input.messageId)) as
        | {
            executionId: number;
            flowUuid: string;
            idnetsuiteAdmin: number | null;
            idProyectoNetsuite: number | null;
            internalLeadId: number;
            leadStatus: number | null;
          }
        | undefined;

      if (!execution) {
        return false;
      }

      if (!(await this.isFlowProjectEnabled(manager, execution.flowUuid, execution.idProyectoNetsuite))) {
        return false;
      }

      const successDropRows = await manager.query(
        `
          SELECT id_caida AS idCaida
          FROM caidas
          WHERE nombre_caida = ?
          LIMIT 1
        `,
        ["Template inicial entregado por WhatsApp"],
      );

      let successDropId = (successDropRows[0] as { idCaida?: number } | undefined)?.idCaida;

      if (!successDropId) {
        const insertResult = await manager.query(
          `
            INSERT INTO caidas (
              nombre_caida,
              estado_caida,
              segui
            ) VALUES (?, ?, ?)
          `,
          ["Template inicial entregado por WhatsApp", 0, 0],
        );

        successDropId = Number(insertResult.insertId);
      }

      await manager.query(
        `
          UPDATE kapso_lead_flow_executions
          SET
            execution_status = ?,
            failure_reason = NULL,
            completed_at = CURRENT_TIMESTAMP,
            last_response_json = ?,
            last_response_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id_kapso_lead_flow_execution = ?
        `,
        ["initial_template_delivered", JSON.stringify(input.responsePayload), execution.executionId],
      );

      await manager.query(
        `
          UPDATE leads
          SET
            segimineto_lead = ?,
            accion_lead = ?,
            actualizadaaccion_lead = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'),
            whatsapp_template_contact_sent = ?,
            id_Caida = ?
          WHERE idinterno_lead = ?
        `,
        ["08-LEAD-SEGUIMIENTO", 3, 0, successDropId, execution.internalLeadId],
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
          successDropId,
          `Template inicial de WhatsApp entregado correctamente al lead. Estado reportado: ${input.deliveryStatus}.`,
          "Kapso",
          "Template inicial entregado",
          execution.leadStatus ?? 1,
          "",
        ],
      );

      return true;
    });
  }

  /**
   * Procesa respuesta "No" del lead: pierde el lead y cierra la ejecución.
   *
   * Tablas: `kapso_lead_flow_executions` (FOR UPDATE), `leads`, `bitacoras`.
   * Por qué: transacción — lockea la ejecución `initial_template_sent` más
   * reciente por número, marca `answered_no`, mueve el lead a perdido (caída 67)
   * e inserta bitácora CRM.
   */
  async markLeadFlowAnsweredNo(input: MarkLeadFlowAnsweredNoInput) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.flow_uuid AS flowUuid,
            execution.id_proyecto_netsuite AS idProyectoNetsuite,
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin
          FROM kapso_lead_flow_executions execution
          WHERE execution.phone_number_id = ?
            AND execution.execution_status IN (?, ?)
            AND (
              (? IS NOT NULL AND execution.initial_template_message_id = ?)
              OR (? IS NULL AND execution.lead_phone_number = ?)
            )
          ORDER BY execution.initial_template_sent_at DESC, execution.created_at DESC
          LIMIT 2
          FOR UPDATE
        `,
        [
          input.phoneNumberId,
          "initial_template_sent",
          "initial_template_delivered",
          input.contextMessageId ?? null,
          input.contextMessageId ?? null,
          input.contextMessageId ?? null,
          input.leadPhoneNumber,
        ],
      );

      const execution = this.resolveInboundExecution(rows, Boolean(input.contextMessageId)) as
        | {
            executionId: number;
            flowUuid: string;
            idProyectoNetsuite: number | null;
            internalLeadId: number;
            idnetsuiteAdmin: number | null;
          }
        | undefined;

      if (!execution) {
        return false;
      }

      if (!(await this.isFlowProjectEnabled(manager, execution.flowUuid, execution.idProyectoNetsuite))) {
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
   * Procesa respuesta "Sí": pasa el lead a seguimiento y deja la ejecución abierta.
   *
   * Tablas: `kapso_lead_flow_executions` (FOR UPDATE + JOINs CRM/Kapso),
   * `leads`, `bitacoras`, `kapso_phone_numbers`.
   * Por qué: transacción — lockea ejecución pendiente, marca `answered_yes`,
   * actualiza segmento/acción del lead y retorna contexto para el mensaje intro.
   */
  async markLeadFlowAnsweredYes(input: MarkLeadFlowAnsweredYesInput) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.flow_uuid AS flowUuid,
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin,
            execution.id_proyecto_netsuite AS idProyectoNetsuite,
            execution.phone_number_id AS phoneNumberId,
            execution.lead_phone_number AS leadPhoneNumber,
            crm_lead.nombre_lead AS leadName,
            crm_lead.proyecto_lead AS projectName,
            admin.name_admin AS adminName,
            phone.project_external_id AS projectExternalId,
            flow_project.intro_message_template AS introMessageTemplate,
            flow_project.intro_options_json AS introOptionsJson
          FROM kapso_lead_flow_executions execution
          LEFT JOIN leads crm_lead
            ON crm_lead.idinterno_lead = execution.idinterno_lead
          LEFT JOIN admins admin
            ON admin.idnetsuite_admin = execution.idnetsuite_admin
          LEFT JOIN kapso_phone_numbers phone
            ON phone.phone_number_id = execution.phone_number_id
          LEFT JOIN kapso_business_flow_projects flow_project
            ON flow_project.flow_uuid = execution.flow_uuid
           AND flow_project.id_proyecto_netsuite = execution.id_proyecto_netsuite
           AND flow_project.enabled = 1
          WHERE execution.phone_number_id = ?
            AND execution.execution_status IN (?, ?)
            AND (
              (? IS NOT NULL AND execution.initial_template_message_id = ?)
              OR (? IS NULL AND execution.lead_phone_number = ?)
            )
          ORDER BY execution.initial_template_sent_at DESC, execution.created_at DESC
          LIMIT 2
          FOR UPDATE
        `,
        [
          input.phoneNumberId,
          "initial_template_sent",
          "initial_template_delivered",
          input.contextMessageId ?? null,
          input.contextMessageId ?? null,
          input.contextMessageId ?? null,
          input.leadPhoneNumber,
        ],
      );

      const execution = this.resolveInboundExecution(rows, Boolean(input.contextMessageId)) as LeadFlowAnsweredYesContext | undefined;

      if (!execution) {
        return null;
      }

      if (!(await this.isFlowProjectEnabled(manager, execution.flowUuid, execution.idProyectoNetsuite))) {
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

  /**
   * Marca la ejecución como intro enviado tras la aceptación del lead.
   *
   * Tablas: `kapso_lead_flow_executions`.
   * Por qué: avanza a `intro_sent` limpiando `failure_reason`.
   */
  /**
   * Registra una respuesta escrita que no permite decidir si el cliente acepta o rechaza.
   *
   * Tablas: `kapso_lead_flow_executions`, `leads`, `bitacoras`.
   * Por que: deja trazabilidad para el asesor sin cambiar el lead ni cerrar el flujo.
   */
  async findLeadFlowIntroOptionContext(input: FindLeadFlowIntroOptionContextInput): Promise<LeadFlowAnsweredYesContext | null> {
    const rows = await this.dataSource.query(
      `
        SELECT
          execution.id_kapso_lead_flow_execution AS executionId,
          execution.flow_uuid AS flowUuid,
          execution.idinterno_lead AS internalLeadId,
          execution.idnetsuite_admin AS idnetsuiteAdmin,
          execution.id_proyecto_netsuite AS idProyectoNetsuite,
          execution.phone_number_id AS phoneNumberId,
          execution.lead_phone_number AS leadPhoneNumber,
          crm_lead.nombre_lead AS leadName,
          crm_lead.proyecto_lead AS projectName,
          admin.name_admin AS adminName,
          phone.project_external_id AS projectExternalId,
          flow_project.intro_message_template AS introMessageTemplate,
          flow_project.intro_options_json AS introOptionsJson
        FROM kapso_lead_flow_executions execution
        INNER JOIN kapso_business_flows business_flow
          ON business_flow.flow_uuid = execution.flow_uuid
         AND business_flow.enabled = 1
        INNER JOIN kapso_business_flow_projects flow_project
          ON flow_project.flow_uuid = execution.flow_uuid
         AND flow_project.id_proyecto_netsuite = execution.id_proyecto_netsuite
         AND flow_project.enabled = 1
        LEFT JOIN leads crm_lead
          ON crm_lead.idinterno_lead = execution.idinterno_lead
        LEFT JOIN admins admin
          ON admin.idnetsuite_admin = execution.idnetsuite_admin
        LEFT JOIN kapso_phone_numbers phone
          ON phone.phone_number_id = execution.phone_number_id
        WHERE execution.phone_number_id = ?
          AND execution.execution_status IN (?, ?)
          AND (
            (? IS NOT NULL AND execution.intro_interactive_message_id = ?)
            OR (? IS NULL AND execution.lead_phone_number = ?)
          )
        ORDER BY execution.last_response_at DESC, execution.created_at DESC
        LIMIT 2
      `,
      [
        input.phoneNumberId,
        "intro_interactive_ready",
        "intro_sent",
        input.contextMessageId ?? null,
        input.contextMessageId ?? null,
        input.contextMessageId ?? null,
        input.leadPhoneNumber,
      ],
    );

    return (this.resolveInboundExecution(rows, Boolean(input.contextMessageId)) as LeadFlowAnsweredYesContext | undefined) ?? null;
  }

  async markLeadFlowIntroOptionAnswered(input: MarkLeadFlowIntroOptionAnsweredInput) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.flow_uuid AS flowUuid,
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin,
            execution.id_proyecto_netsuite AS idProyectoNetsuite,
            execution.phone_number_id AS phoneNumberId,
            execution.lead_phone_number AS leadPhoneNumber,
            crm_lead.nombre_lead AS leadName,
            crm_lead.proyecto_lead AS projectName,
            admin.name_admin AS adminName,
            phone.project_external_id AS projectExternalId,
            flow_project.intro_message_template AS introMessageTemplate,
            flow_project.intro_options_json AS introOptionsJson
          FROM kapso_lead_flow_executions execution
          LEFT JOIN leads crm_lead
            ON crm_lead.idinterno_lead = execution.idinterno_lead
          LEFT JOIN admins admin
            ON admin.idnetsuite_admin = execution.idnetsuite_admin
          LEFT JOIN kapso_phone_numbers phone
            ON phone.phone_number_id = execution.phone_number_id
          LEFT JOIN kapso_business_flow_projects flow_project
            ON flow_project.flow_uuid = execution.flow_uuid
           AND flow_project.id_proyecto_netsuite = execution.id_proyecto_netsuite
           AND flow_project.enabled = 1
          WHERE execution.phone_number_id = ?
            AND execution.execution_status IN (?, ?)
            AND (
              (? IS NOT NULL AND execution.intro_interactive_message_id = ?)
              OR (? IS NULL AND execution.lead_phone_number = ?)
            )
          ORDER BY execution.last_response_at DESC, execution.created_at DESC
          LIMIT 2
          FOR UPDATE
        `,
        [
          input.phoneNumberId,
          "intro_interactive_ready",
          "intro_sent",
          input.contextMessageId ?? null,
          input.contextMessageId ?? null,
          input.contextMessageId ?? null,
          input.leadPhoneNumber,
        ],
      );

      const execution = this.resolveInboundExecution(rows, Boolean(input.contextMessageId)) as LeadFlowAnsweredYesContext | undefined;

      if (!execution) {
        return null;
      }

      if (!(await this.isFlowProjectEnabled(manager, execution.flowUuid, execution.idProyectoNetsuite))) {
        return null;
      }

      await manager.query(
        `
          UPDATE kapso_lead_flow_executions
          SET
            execution_status = ?,
            intro_interactive_message_id = COALESCE(?, intro_interactive_message_id),
            last_response_json = ?,
            last_response_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            failure_reason = NULL
          WHERE id_kapso_lead_flow_execution = ?
        `,
        [
          input.keepInteractiveReady ? "intro_interactive_ready" : "intro_option_answered",
          input.nextInteractiveMessageId ?? null,
          JSON.stringify(input.responsePayload),
          execution.executionId,
        ],
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
          `Cliente selecciono opcion de intro WhatsApp: ${input.optionLabel}.`,
          "Kapso",
          "Opcion intro WhatsApp",
          1,
          "",
        ],
      );

      return execution;
    });
  }

  async registerUnidentifiedInitialReply(input: RegisterUnidentifiedInitialReplyInput) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.flow_uuid AS flowUuid,
            execution.id_proyecto_netsuite AS idProyectoNetsuite,
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin,
            crm_lead.estado_lead AS leadStatus
          FROM kapso_lead_flow_executions execution
          LEFT JOIN leads crm_lead
            ON crm_lead.idinterno_lead = execution.idinterno_lead
          WHERE execution.phone_number_id = ?
            AND execution.execution_status IN (?, ?)
            AND (
              (? IS NOT NULL AND execution.initial_template_message_id = ?)
              OR (? IS NULL AND execution.lead_phone_number = ?)
            )
          ORDER BY execution.initial_template_sent_at DESC, execution.created_at DESC
          LIMIT 2
          FOR UPDATE
        `,
        [
          input.phoneNumberId,
          "initial_template_sent",
          "initial_template_delivered",
          input.contextMessageId ?? null,
          input.contextMessageId ?? null,
          input.contextMessageId ?? null,
          input.leadPhoneNumber,
        ],
      );

      const execution = this.resolveInboundExecution(rows, Boolean(input.contextMessageId)) as
        | {
            executionId: number;
            flowUuid: string;
            idProyectoNetsuite: number | null;
            internalLeadId: number;
            idnetsuiteAdmin: number | null;
            leadStatus: number | null;
          }
        | undefined;

      if (!execution) {
        return false;
      }

      if (!(await this.isFlowProjectEnabled(manager, execution.flowUuid, execution.idProyectoNetsuite))) {
        return false;
      }

      await manager.query(
        `
          UPDATE kapso_lead_flow_executions
          SET
            last_response_json = ?,
            last_response_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id_kapso_lead_flow_execution = ?
        `,
        [JSON.stringify(input.responsePayload), execution.executionId],
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
          null,
          `No se logro identificar la intencion de la respuesta recibida por WhatsApp. Mensaje del cliente: "${input.replyText}". Revisar seguimiento manual antes de continuar el flujo.`,
          "Kapso",
          "Respuesta WhatsApp no identificada",
          execution.leadStatus ?? 1,
          "",
        ],
      );

      return true;
    });
  }

  async markLeadFlowIntroMediaPending(input: LeadFlowIntroMediaPendingInput) {
    await this.dataSource.query(
      `
        UPDATE kapso_lead_flow_executions
        SET
          execution_status = ?,
          failure_reason = NULL,
          last_response_json = ?,
          last_response_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id_kapso_lead_flow_execution = ?
      `,
      ["intro_media_pending", JSON.stringify(input.pendingPayload), input.executionId],
    );
  }

  async markLeadFlowIntroMediaDelivered(input: IntroMediaDeliveryInput): Promise<IntroMediaDeliveryResult> {
    if (!input.messageId) {
      return null;
    }

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.phone_number_id AS phoneNumberId,
            execution.last_response_json AS lastResponseJson,
            phone.project_external_id AS projectExternalId
          FROM kapso_lead_flow_executions execution
          LEFT JOIN kapso_phone_numbers phone
            ON phone.phone_number_id = execution.phone_number_id
          WHERE execution.phone_number_id = ?
            AND execution.lead_phone_number = ?
            AND execution.execution_status = ?
          ORDER BY execution.updated_at DESC, execution.created_at DESC
          LIMIT 10
          FOR UPDATE
        `,
        [input.phoneNumberId, input.leadPhoneNumber, "intro_media_pending"],
      );

      const matchingRows = rows.filter((row: { lastResponseJson?: unknown }) => {
        const payload = this.parseJsonRecord(row.lastResponseJson);
        const mediaMessages = Array.isArray(payload.mediaMessages) ? payload.mediaMessages : [];

        return mediaMessages.some((mediaMessage) => this.parseJsonRecord(mediaMessage).messageId === input.messageId);
      });

      if (matchingRows.length !== 1) {
        return null;
      }

      const execution = matchingRows[0] as {
        executionId: number;
        phoneNumberId: string;
        lastResponseJson: unknown;
        projectExternalId: string | null;
      };
      const payload = this.parseJsonRecord(execution.lastResponseJson);
      const mediaMessages = Array.isArray(payload.mediaMessages) ? payload.mediaMessages : [];
      const updatedMessages = mediaMessages.map((mediaMessage) => {
        const mediaMessageRecord = this.parseJsonRecord(mediaMessage);

        if (mediaMessageRecord.messageId !== input.messageId) {
          return mediaMessageRecord;
        }

        const currentStatus = String(mediaMessageRecord.status ?? "").toLowerCase();
        const incomingStatus = String(input.deliveryStatus ?? "").toLowerCase();
        const currentIsConfirmed = currentStatus === "delivered" || currentStatus === "read";
        const incomingIsConfirmed = incomingStatus === "delivered" || incomingStatus === "read";
        const deliveredAt =
          incomingIsConfirmed || !mediaMessageRecord.deliveredAt
            ? new Date().toISOString()
            : mediaMessageRecord.deliveredAt;

        return {
          ...mediaMessageRecord,
          status: currentIsConfirmed && !incomingIsConfirmed ? mediaMessageRecord.status : input.deliveryStatus,
          deliveredAt,
          deliveryPayload: incomingIsConfirmed || !currentIsConfirmed ? input.responsePayload : mediaMessageRecord.deliveryPayload,
        };
      });
      const allMediaConfirmed =
        updatedMessages.length > 0 &&
        updatedMessages.every((mediaMessage) => {
          const status = String(this.parseJsonRecord(mediaMessage).status ?? "").toLowerCase();
          return status === "delivered" || status === "read";
        });
      const updatedPayload: Record<string, unknown> = {
        ...payload,
        mediaMessages: updatedMessages,
        lastDeliveryPayload: input.responsePayload,
      };

      if (!allMediaConfirmed) {
        await manager.query(
          `
            UPDATE kapso_lead_flow_executions
            SET
              last_response_json = ?,
              last_response_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id_kapso_lead_flow_execution = ?
          `,
          [JSON.stringify(updatedPayload), execution.executionId],
        );

        return { state: "updated_pending" };
      }

      await manager.query(
        `
          UPDATE kapso_lead_flow_executions
          SET
            execution_status = ?,
            last_response_json = ?,
            last_response_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id_kapso_lead_flow_execution = ?
        `,
        ["intro_interactive_ready", JSON.stringify(updatedPayload), execution.executionId],
      );

      return {
        state: "ready",
        context: {
          executionId: execution.executionId,
          phoneNumberId: execution.phoneNumberId,
          projectExternalId: execution.projectExternalId,
          interactivePayload: this.parseJsonRecord(updatedPayload.interactivePayload),
        },
      };
    });
  }

  async markLeadFlowIntroMediaFailed(input: IntroMediaFailureInput): Promise<IntroMediaFailureResult> {
    if (!input.messageId) {
      return null;
    }

    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `
          SELECT
            execution.id_kapso_lead_flow_execution AS executionId,
            execution.phone_number_id AS phoneNumberId,
            execution.last_response_json AS lastResponseJson,
            phone.project_external_id AS projectExternalId
          FROM kapso_lead_flow_executions execution
          LEFT JOIN kapso_phone_numbers phone
            ON phone.phone_number_id = execution.phone_number_id
          WHERE execution.phone_number_id = ?
            AND execution.lead_phone_number = ?
            AND execution.execution_status = ?
          ORDER BY execution.updated_at DESC, execution.created_at DESC
          LIMIT 10
          FOR UPDATE
        `,
        [input.phoneNumberId, input.leadPhoneNumber, "intro_media_pending"],
      );

      const matchingRows = rows.filter((row: { lastResponseJson?: unknown }) => {
        const payload = this.parseJsonRecord(row.lastResponseJson);
        const mediaMessages = Array.isArray(payload.mediaMessages) ? payload.mediaMessages : [];

        return mediaMessages.some((mediaMessage) => this.parseJsonRecord(mediaMessage).messageId === input.messageId);
      });

      if (matchingRows.length !== 1) {
        return null;
      }

      const execution = matchingRows[0] as {
        executionId: number;
        phoneNumberId: string;
        lastResponseJson: unknown;
        projectExternalId: string | null;
      };
      const payload = this.parseJsonRecord(execution.lastResponseJson);
      const mediaMessages = Array.isArray(payload.mediaMessages) ? payload.mediaMessages : [];
      const updatedMessages = mediaMessages.map((mediaMessage) => {
        const mediaMessageRecord = this.parseJsonRecord(mediaMessage);

        if (mediaMessageRecord.messageId !== input.messageId) {
          return mediaMessageRecord;
        }

        return {
          ...mediaMessageRecord,
          status: "failed",
          failedAt: new Date().toISOString(),
          failureReason: input.failureReason,
          failurePayload: input.responsePayload,
        };
      });
      const updatedPayload: Record<string, unknown> = {
        ...payload,
        mediaMessages: updatedMessages,
        lastFailurePayload: input.responsePayload,
      };
      const allMediaTerminal =
        updatedMessages.length > 0 &&
        updatedMessages.every((mediaMessage) => {
          const status = String(this.parseJsonRecord(mediaMessage).status ?? "").toLowerCase();
          return status === "delivered" || status === "read" || status === "failed";
        });
      const hasConfirmedMedia = updatedMessages.some((mediaMessage) => {
        const status = String(this.parseJsonRecord(mediaMessage).status ?? "").toLowerCase();
        return status === "delivered" || status === "read";
      });

      if (!allMediaTerminal) {
        await manager.query(
          `
            UPDATE kapso_lead_flow_executions
            SET
              last_response_json = ?,
              last_response_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id_kapso_lead_flow_execution = ?
          `,
          [JSON.stringify(updatedPayload), execution.executionId],
        );

        return { state: "updated_pending" };
      }

      if (hasConfirmedMedia) {
        await manager.query(
          `
            UPDATE kapso_lead_flow_executions
            SET
              execution_status = ?,
              last_response_json = ?,
              last_response_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id_kapso_lead_flow_execution = ?
          `,
          ["intro_interactive_ready", JSON.stringify(updatedPayload), execution.executionId],
        );

        return {
          state: "ready",
          context: {
            executionId: execution.executionId,
            phoneNumberId: execution.phoneNumberId,
            projectExternalId: execution.projectExternalId,
            interactivePayload: this.parseJsonRecord(updatedPayload.interactivePayload),
          },
        };
      }

      await manager.query(
        `
          UPDATE kapso_lead_flow_executions
          SET
            execution_status = ?,
            failure_reason = ?,
            completed_at = CURRENT_TIMESTAMP,
            last_response_json = ?,
            last_response_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id_kapso_lead_flow_execution = ?
        `,
        [
          "intro_failed",
          input.failureReason,
          JSON.stringify(updatedPayload),
          execution.executionId,
        ],
      );

      return { state: "failed" };
    });
  }

  async markLeadFlowIntroSent(input: IntroFlowExecutionUpdateInput) {
    await this.dataSource.query(
      `
        UPDATE kapso_lead_flow_executions
        SET
          execution_status = ?,
          intro_interactive_message_id = COALESCE(?, intro_interactive_message_id),
          failure_reason = NULL
        WHERE id_kapso_lead_flow_execution = ?
      `,
      ["intro_sent", input.messageId ?? null, input.executionId],
    );
  }

  /**
   * Marca fallo al enviar el mensaje intro del flow.
   *
   * Tablas: `kapso_lead_flow_executions`.
   * Por qué: deja `intro_failed` + motivo para diagnóstico/reintento manual.
   */
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
}
