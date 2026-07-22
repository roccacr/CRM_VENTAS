/**
 * Persistencia del ciclo comercial de leads Kapso (candidatos, respuestas, bitácoras).
 *
 * Transacciones multi-tabla sobre `kapso_lead_flow_executions`, `leads`,
 * `bitacoras` y JOINs a `admins` / `admin_kapso_integrations` / templates.
 * Usa `FOR UPDATE` y UNIQUE `(flow_uuid, idinterno_lead)` para anti-repetición.
 */
import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

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

export type IntroFlowExecutionUpdateInput = {
  executionId: number;
  failureReason?: string | null;
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
  responsePayload?: Record<string, unknown>;
  failureReason?: string | null;
};

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
            execution.id_kapso_lead_flow_execution AS executionId
          FROM kapso_lead_flow_executions execution
          WHERE execution.flow_uuid = ?
            AND execution.idinterno_lead = ?
          LIMIT 1
          FOR UPDATE
        `,
        [input.flowUuid, input.internalLeadId],
      );

      if (existingRows[0]) {
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
          initial_template_sent_at = CURRENT_TIMESTAMP,
          last_response_json = ?,
          completed_at = NULL,
          failure_reason = NULL
        WHERE id_kapso_lead_flow_execution = ?
      `,
      ["initial_template_sent", JSON.stringify(input.responsePayload ?? {}), input.executionId],
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
            execution.idinterno_lead AS internalLeadId,
            execution.idnetsuite_admin AS idnetsuiteAdmin,
            execution.id_proyecto_netsuite AS idProyectoNetsuite,
            execution.phone_number_id AS phoneNumberId,
            execution.lead_phone_number AS leadPhoneNumber,
            crm_lead.nombre_lead AS leadName,
            crm_lead.proyecto_lead AS projectName,
            phone.project_external_id AS projectExternalId
          FROM kapso_lead_flow_executions execution
          LEFT JOIN leads crm_lead
            ON crm_lead.idinterno_lead = execution.idinterno_lead
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

  /**
   * Marca la ejecución como intro enviado tras la aceptación del lead.
   *
   * Tablas: `kapso_lead_flow_executions`.
   * Por qué: avanza a `intro_sent` limpiando `failure_reason`.
   */
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
