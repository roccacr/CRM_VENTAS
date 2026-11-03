import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;
type ActivityStatus = "active" | "inactive";

/** Native stage configuration; a code is stable while labels remain editable. */
export interface ConfLeadStatusTable {
    code_lead_status: string;
    name_lead_status: string;
    display_order_lead_status: number;
    status_lead_status: Generated<ActivityStatus>;
    created_at_lead_status: Generated<DateTime>;
    updated_at_lead_status: Generated<DateTime>;
}

/** Reasons are independent of stages, activities and external provider identifiers. */
export interface ConfActionReasonTable {
    code_action_reason: string;
    name_action_reason: string;
    detail_action_reason: string | null;
    status_action_reason: Generated<ActivityStatus>;
    created_at_action_reason: Generated<DateTime>;
    updated_at_action_reason: Generated<DateTime>;
}

/** Which reasons can be selected when entering each stage. */
export interface ConfActionReasonStatusTable {
    status_code_action_reason_status: string;
    reason_code_action_reason_status: string;
    status_action_reason_status: Generated<ActivityStatus>;
    created_at_action_reason_status: Generated<DateTime>;
    updated_at_action_reason_status: Generated<DateTime>;
}

/** Acquisition channels, separate from the technical integration that carries a lead. */
export interface ConfLeadSourceTable {
    code_lead_source: string;
    name_lead_source: string;
    status_lead_source: Generated<ActivityStatus>;
    created_at_lead_source: Generated<DateTime>;
    updated_at_lead_source: Generated<DateTime>;
}

/** Interest classification does not replace the commercial stage. */
export interface ConfLeadInterestTable {
    code_lead_interest: string;
    name_lead_interest: string;
    status_lead_interest: Generated<ActivityStatus>;
    created_at_lead_interest: Generated<DateTime>;
    updated_at_lead_interest: Generated<DateTime>;
}

/** Person data may be shared by several commercial leads. */
export interface CrmContactTable {
    id_contact: Generated<number>;
    public_id_contact: string;
    full_name_contact: string;
    email_contact: string | null;
    normalized_email_contact: string | null;
    phone_contact: string | null;
    normalized_phone_contact: string | null;
    country_code_contact: string | null;
    status_contact: Generated<ActivityStatus>;
    created_at_contact: Generated<DateTime>;
    updated_at_contact: Generated<DateTime>;
    created_by_user_id_contact: number | null;
    updated_by_user_id_contact: number | null;
    deleted_at_contact: DateTime | null;
}

/** All relationships use native identities; owner is not an external ERP reference. */
export interface CrmLeadTable {
    id_lead: Generated<number>;
    public_id_lead: string;
    primary_contact_id_lead: number;
    owner_user_id_lead: number | null;
    project_id_lead: number;
    campaign_id_lead: number;
    subsidiary_id_lead: number | null;
    broker_id_lead: number | null;
    source_code_lead: string;
    interest_code_lead: string | null;
    status_code_lead: Generated<string>;
    status_lead: Generated<ActivityStatus>;
    ad_name_lead: string | null;
    company_name_lead: string | null;
    currency_code_lead: string | null;
    initial_comment_lead: string | null;
    initial_contact_template_sent_lead: Generated<0 | 1>;
    has_related_lead_lead: Generated<0 | 1>;
    /** Explicit qualification flag; independent from commercial status or interest. */
    is_qualified_lead: Generated<0 | 1>;
    version_lead: Generated<number>;
    source_created_at_lead: DateTime | null;
    source_updated_at_lead: DateTime | null;
    created_at_lead: Generated<DateTime>;
    updated_at_lead: Generated<DateTime>;
    created_by_user_id_lead: number | null;
    updated_by_user_id_lead: number | null;
    inactivated_at_lead: DateTime | null;
    deleted_at_lead: DateTime | null;
}

/** A system-scoped alias never becomes the identity used in native relationships. */
export interface CrmLeadExternalReferenceTable {
    id_lead_external_reference: Generated<number>;
    lead_id_lead_external_reference: number;
    external_system_id_lead_external_reference: number;
    external_id_lead_external_reference: string;
    status_lead_external_reference: Generated<ActivityStatus>;
    created_at_lead_external_reference: Generated<DateTime>;
    updated_at_lead_external_reference: Generated<DateTime>;
}

/** Append-only through future commands; the schema alone does not enforce write authorization. */
export interface AuditLeadStatusEventTable {
    id_lead_status_event: Generated<number>;
    public_id_lead_status_event: string;
    lead_id_lead_status_event: number;
    sequence_lead_status_event: number;
    event_kind_lead_status_event: "initial_snapshot" | "transition";
    from_status_code_lead_status_event: string | null;
    to_status_code_lead_status_event: string;
    reason_code_lead_status_event: string | null;
    reason_name_snapshot_lead_status_event: string | null;
    comment_lead_status_event: string | null;
    actor_kind_lead_status_event: "user" | "system" | "integration";
    actor_user_id_lead_status_event: number | null;
    external_system_id_lead_status_event: number | null;
    operation_id_lead_status_event: string;
    occurred_at_lead_status_event: DateTime | null;
    recorded_at_lead_status_event: Generated<DateTime>;
}
