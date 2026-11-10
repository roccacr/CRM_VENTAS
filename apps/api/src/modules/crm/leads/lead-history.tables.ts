/**
 * Forma física de la bitácora del lead.
 * El tipo de actividad y el motivo aplicable son catálogos. La fila importada apunta al origen; no es la identidad nativa.
 * El vínculo une el lead nuevo con el archivo viejo. La actividad guarda el `operationId` que detecta una repetición.
 */
import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;

export interface ConfLeadActionTypeTable {
    code_lead_action_type: string;
    name_lead_action_type: string;
    status_lead_action_type: Generated<"active" | "inactive">;
    created_at_lead_action_type: Generated<DateTime>;
    updated_at_lead_action_type: Generated<DateTime>;
}
export interface ConfActionReasonActionTable {
    action_code_action_reason_action: string;
    reason_code_action_reason_action: string;
    status_action_reason_action: Generated<"active" | "inactive">;
    created_at_action_reason_action: Generated<DateTime>;
    updated_at_action_reason_action: Generated<DateTime>;
}
export interface IntLeadHistoryEntryTable {
    id_lead_history_entry: Generated<number>;
    source_entry_id_lead_history_entry: number;
    source_lead_reference_lead_history_entry: string;
    source_lead_id_lead_history_entry: number | null;
    record_id_lead_history_entry: string;
    event_id_lead_history_entry: string;
    action_code_lead_history_entry: string;
    reason_code_lead_history_entry: string | null;
    source_reason_id_lead_history_entry: number | null;
    resolution_lead_history_entry: "matched" | "ambiguous" | "missing";
    source_hash_lead_history_entry: string;
    recorded_at_lead_history_entry: Generated<DateTime>;
}
export interface IntLeadHistoryLinkTable {
    lead_id_lead_history_link: number;
    record_id_lead_history_link: string;
    linked_at_lead_history_link: Generated<DateTime>;
}
export interface CrmLeadActivityTable {
    id_lead_activity: Generated<number>;
    public_id_lead_activity: string;
    lead_id_lead_activity: number;
    action_code_lead_activity: string;
    reason_code_lead_activity: string | null;
    detail_lead_activity: string;
    actor_user_id_lead_activity: number;
    operation_id_lead_activity: string;
    event_id_lead_activity: string;
    created_at_lead_activity: Generated<DateTime>;
}
