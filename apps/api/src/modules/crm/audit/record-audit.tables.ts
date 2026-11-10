import type { ColumnType } from "kysely";

/** Fecha asignada por el servidor. Se lee y se inserta. No se actualiza. */
type RecordedAt = ColumnType<Date, Date | string | undefined, never>;

/** Identidad logica de lo auditado, aparte de las llaves operativas. Borrar el negocio no exige borrar esta fila. */
export interface AuditRecordTable {
    id_record: string;
    source_schema_record: string;
    entity_type_record: string;
    source_table_record: string;
    source_id_record: string;
    created_at_record: RecordedAt;
}

/** Columnas fisicas del evento. El tipo solo permite insertar: actualizar y borrar no estan en el contrato. */
export interface AuditRecordEventTable {
    id_record_event: string;
    record_id_record_event: string;
    sequence_record_event: number;
    action_record_event: string;
    module_record_event: string;
    origin_record_event: string;
    source_schema_record_event: string;
    source_table_record_event: string;
    source_id_record_event: string;
    actor_kind_record_event: string;
    actor_reference_record_event: string | null;
    actor_snapshot_record_event: string;
    occurred_at_record_event: ColumnType<Date | null, Date | string | null, never>;
    recorded_at_record_event: RecordedAt;
    operation_id_record_event: string;
    correlation_id_record_event: string;
    reason_record_event: string | null;
    snapshot_version_record_event: number;
    snapshot_scope_record_event: string;
    before_record_event: string | null;
    after_record_event: string | null;
    changes_record_event: string;
    restored_sequence_record_event: number | null;
    request_id_record_event: string | null;
    ip_address_record_event: string | null;
    user_agent_record_event: string | null;
}
