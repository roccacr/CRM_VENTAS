import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedDateTime = ColumnType<Date, Date | string | undefined, Date | string>;

export interface ConfSalesOrderStateTable {
    code_sales_order_state: string;
    name_sales_order_state: string;
    display_order_sales_order_state: number;
}

export interface ConfSalesOrderApprovalTypeTable {
    code_sales_order_approval_type: string;
    name_sales_order_approval_type: string;
}

export interface CrmSalesOrderTable {
    id_sales_order: Generated<number>;
    public_id_sales_order: string;
    native_code_sales_order: string;
    id_old_produccion_sales_order: number | null;
    unit_file_id_sales_order: number | null;
    lead_id_sales_order: number | null;
    subsidiary_id_sales_order: number | null;
    owner_user_id_sales_order: number | null;
    status_sales_order: Generated<"active" | "inactive" | "unknown">;
    cancellation_marked_on_sales_order: Generated<string | null>;
    cancelled_sales_order: Generated<"yes" | "no" | "unknown">;
    reservation_applied_sales_order: Generated<"yes" | "no" | "unknown">;
    balance_validated_sales_order: Generated<number>;
    balance_validated_by_sales_order: Generated<string | null>;
    balance_validated_at_sales_order: Generated<Date | null>;
    finiquito_sent_sales_order: Generated<number>;
    finiquito_sent_by_sales_order: Generated<string | null>;
    finiquito_sent_at_sales_order: Generated<Date | null>;
    finiquito_received_sales_order: Generated<number>;
    finiquito_received_by_sales_order: Generated<string | null>;
    finiquito_received_at_sales_order: Generated<Date | null>;
    currency_code_sales_order: string | null;
    transaction_date_sales_order: string | null;
    list_price_sales_order: string | null;
    net_sale_price_sales_order: string | null;
    sale_price_sales_order: string | null;
    advisor_commission_sales_order: string | null;
    contract_signed_sales_order: Generated<"yes" | "no" | "unknown">;
    purchase_funds_origin_sales_order: Generated<"own_funds" | "bank_financing" | null>;
    addendum_status_sales_order: Generated<"pending" | "completed" | "cancelled" | "sent" | null>;
    addendum_version_sales_order: Generated<number>;
    addendum_note_sales_order: Generated<string | null>;
    addendum_changed_at_sales_order: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
    commercial_closure_signed_sales_order: Generated<"yes" | "no" | "unknown">;
    advisor_commission_calculated_sales_order: Generated<"yes" | "no" | "unknown">;
    advisor_commission_paid_sales_order: Generated<"yes" | "no" | "unknown">;
    unit_delivered_sales_order: Generated<"yes" | "no" | "unknown">;
    unit_transferred_sales_order: Generated<"yes" | "no" | "unknown">;
    keys_delivered_sales_order: Generated<"yes" | "no" | "unknown">;
    trust_down_payment_validated_sales_order: Generated<"yes" | "no" | "unknown">;
    commission_approved_sales_order: Generated<"yes" | "no" | "unknown">;
    broker_commission_calculated_sales_order: Generated<"yes" | "no" | "unknown">;
    installments_fully_paid_sales_order: Generated<"yes" | "no" | "unknown">;
    source_created_at_sales_order: DateTime | null;
    created_at_sales_order: GeneratedDateTime;
    created_by_user_id_sales_order: number | null;
    updated_at_sales_order: GeneratedDateTime;
    updated_by_user_id_sales_order: number | null;
    deleted_at_sales_order: DateTime | null;
}

export interface CrmSalesOrderExternalReferenceTable {
    id_sales_order_external_reference: Generated<number>;
    sales_order_id_sales_order_external_reference: number;
    external_system_id_sales_order_external_reference: number;
    external_id_sales_order_external_reference: string;
    transaction_number_sales_order_external_reference: string | null;
    status_sales_order_external_reference: Generated<"active" | "inactive">;
    created_at_sales_order_external_reference: GeneratedDateTime;
    updated_at_sales_order_external_reference: GeneratedDateTime;
}

export interface CrmSalesOrderApprovalTable {
    sales_order_id_sales_order_approval: number;
    type_code_sales_order_approval: string;
    status_sales_order_approval: Generated<"approved" | "not_approved" | "unknown">;
    version_sales_order_approval: Generated<number>;
    updated_at_sales_order_approval: GeneratedDateTime;
    updated_by_user_id_sales_order_approval: number | null;
}

export interface AuditSalesOrderStateEventTable {
    id_sales_order_state_event: Generated<number>;
    public_id_sales_order_state_event: string;
    sales_order_id_sales_order_state_event: number;
    sequence_sales_order_state_event: number;
    from_state_code_sales_order_state_event: string | null;
    to_state_code_sales_order_state_event: string;
    event_kind_sales_order_state_event: "created" | "transition" | "import_snapshot";
    effective_at_sales_order_state_event: DateTime | null;
    recorded_at_sales_order_state_event: GeneratedDateTime;
    actor_user_id_sales_order_state_event: number | null;
    actor_snapshot_sales_order_state_event: ColumnType<unknown, string, string> | null;
    responsible_user_id_sales_order_state_event: ColumnType<number | null, number | null | undefined, number | null>;
    responsible_snapshot_sales_order_state_event: ColumnType<unknown, string | null | undefined, string | null>;
    origin_sales_order_state_event: "crm" | "integration" | "legacy_import";
    reason_sales_order_state_event: string;
    operation_id_sales_order_state_event: string;
    correlation_id_sales_order_state_event: string;
}

export interface AuditSalesOrderApprovalEventTable {
    id_sales_order_approval_event: Generated<number>;
    sales_order_id_sales_order_approval_event: number;
    type_code_sales_order_approval_event: string;
    version_sales_order_approval_event: number;
    before_status_sales_order_approval_event: "approved" | "not_approved" | "unknown" | null;
    after_status_sales_order_approval_event: "approved" | "not_approved" | "unknown";
    effective_at_sales_order_approval_event: DateTime | null;
    recorded_at_sales_order_approval_event: GeneratedDateTime;
    actor_user_id_sales_order_approval_event: number | null;
    actor_snapshot_sales_order_approval_event: ColumnType<unknown, string, string> | null;
    origin_sales_order_approval_event: "crm" | "integration" | "legacy_import";
    reason_sales_order_approval_event: string;
    operation_id_sales_order_approval_event: string;
    correlation_id_sales_order_approval_event: string;
}

export interface IntSalesOrderSourceSnapshotTable {
    id_sales_order_source_snapshot: Generated<number>;
    sales_order_id_sales_order_source_snapshot: number;
    external_system_id_sales_order_source_snapshot: number;
    source_record_id_sales_order_source_snapshot: string;
    payload_sales_order_source_snapshot: ColumnType<unknown, string, string>;
    observed_at_sales_order_source_snapshot: GeneratedDateTime;
    operation_id_sales_order_source_snapshot: string;
}

export interface AuditSalesOrderChangeTable {
    id_sales_order_change: Generated<number>;
    sales_order_id_sales_order_change: number;
    action_sales_order_change: "create" | "update" | "import_snapshot";
    before_sales_order_change: ColumnType<unknown, string, string> | null;
    after_sales_order_change: ColumnType<unknown, string, string>;
    actor_user_id_sales_order_change: number | null;
    recorded_at_sales_order_change: GeneratedDateTime;
    origin_sales_order_change: "crm" | "integration" | "legacy_import";
    reason_sales_order_change: string;
    operation_id_sales_order_change: string;
    correlation_id_sales_order_change: string;
}
