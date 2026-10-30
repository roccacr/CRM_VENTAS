import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;
type Digest = ColumnType<Buffer, never, never>;

/** Per-module event configuration; migration 051 adds the initial general form. */
export interface ConfCalendarEventTypeTable {
    form_key_calendar_event_type: string;
    id_calendar_event_type: Generated<number>;
    public_id_calendar_event_type: string;
    module_id_calendar_event_type: number;
    code_calendar_event_type: string;
    name_calendar_event_type: string;
    color_calendar_event_type: string;
    status_calendar_event_type: Generated<"active" | "inactive">;
    created_at_calendar_event_type: Generated<DateTime>;
    updated_at_calendar_event_type: Generated<DateTime>;
}

/** One native event; switching the visible module never changes its origin. */
export interface CrmCalendarEventTable {
    details_calendar_event: ColumnType<unknown, string | null, string | null>;
    legacy_calendar_id_calendar_event: number | null;
    id_calendar_event: Generated<number>;
    public_id_calendar_event: string;
    origin_module_id_calendar_event: number;
    type_id_calendar_event: number;
    organizer_user_id_calendar_event: number;
    title_calendar_event: string;
    description_calendar_event: string | null;
    location_calendar_event: string | null;
    color_override_calendar_event: string | null;
    status_calendar_event: Generated<"scheduled" | "completed" | "cancelled">;
    starts_at_calendar_event: DateTime;
    ends_at_calendar_event: DateTime;
    timezone_calendar_event: string;
    all_day_calendar_event: Generated<0 | 1>;
    cancellation_reason_calendar_event: string | null;
    version_calendar_event: Generated<number>;
    invitation_version_calendar_event: Generated<number>;
    created_by_user_id_calendar_event: number;
    updated_by_user_id_calendar_event: number;
    created_at_calendar_event: Generated<DateTime>;
    updated_at_calendar_event: Generated<DateTime>;
    deleted_at_calendar_event: DateTime | null;
}

/** A participant can respond without gaining event or linked-record editing rights. */
export interface CrmCalendarParticipantTable {
    id_calendar_participant: Generated<number>;
    public_id_calendar_participant: string;
    event_id_calendar_participant: number;
    user_id_calendar_participant: number | null;
    external_email_calendar_participant: string | null;
    display_name_calendar_participant: string | null;
    role_calendar_participant: Generated<"required" | "optional" | "copied" | "coorganizer">;
    status_calendar_participant: Generated<"active" | "revoked">;
    response_calendar_participant: Generated<"pending" | "accepted" | "tentative" | "declined" | "not_required">;
    responded_at_calendar_participant: DateTime | null;
    response_version_calendar_participant: number | null;
    invited_by_user_id_calendar_participant: number;
    invitation_sent_at_calendar_participant: DateTime | null;
    revoked_at_calendar_participant: DateTime | null;
    created_at_calendar_participant: Generated<DateTime>;
    updated_at_calendar_participant: Generated<DateTime>;
}

/** Native public record links require an authorized entity resolver in the future API. */
export interface CrmCalendarEventLinkTable {
    id_calendar_event_link: Generated<number>;
    event_id_calendar_event_link: number;
    entity_type_calendar_event_link: string;
    source_calendar_event_link: Generated<"native" | "legacy">;
    entity_public_id_calendar_event_link: string;
    created_by_user_id_calendar_event_link: number;
    created_at_calendar_event_link: Generated<DateTime>;
    updated_at_calendar_event_link: Generated<DateTime>;
    deleted_at_calendar_event_link: DateTime | null;
}

/** Optional commercial detail; appointments are not the entire calendar. */
export interface CrmCalendarAppointmentTable {
    event_id_calendar_appointment: number;
    lead_id_calendar_appointment: number | null;
    project_id_calendar_appointment: number | null;
    sequence_calendar_appointment: number | null;
    customer_confirmed_at_calendar_appointment: DateTime | null;
    supervisor_verified_at_calendar_appointment: DateTime | null;
    supervisor_user_id_calendar_appointment: number | null;
    progress_calendar_appointment: "planned" | "attended" | "missed" | null;
    created_at_calendar_appointment: Generated<DateTime>;
    updated_at_calendar_appointment: Generated<DateTime>;
}

/** Per-user bell state is independent from RSVP and external message delivery. */
export interface CrmCalendarNotificationTable {
    id_calendar_notification: Generated<number>;
    public_id_calendar_notification: string;
    event_id_calendar_notification: number;
    recipient_user_id_calendar_notification: number;
    kind_calendar_notification: "invitation" | "event_updated" | "event_cancelled" | "event_today" | "reminder";
    dedupe_key_calendar_notification: string;
    visible_at_calendar_notification: DateTime;
    expires_at_calendar_notification: DateTime | null;
    read_at_calendar_notification: DateTime | null;
    dismissed_at_calendar_notification: DateTime | null;
    created_at_calendar_notification: Generated<DateTime>;
    updated_at_calendar_notification: Generated<DateTime>;
}

/** Provider/calendar identity only; authentication secrets remain outside this schema. */
export interface IntCalendarConnectionTable {
    id_calendar_connection: Generated<number>;
    public_id_calendar_connection: string;
    external_system_id_calendar_connection: number;
    owner_user_id_calendar_connection: number;
    external_tenant_id_calendar_connection: string;
    external_account_id_calendar_connection: string;
    external_calendar_id_calendar_connection: string;
    calendar_key_calendar_connection: Digest;
    status_calendar_connection: Generated<"active" | "inactive">;
    created_at_calendar_connection: Generated<DateTime>;
    updated_at_calendar_connection: Generated<DateTime>;
}

/** Multiple mailbox copies retain one native event and separate remote concurrency versions. */
export interface IntCalendarEventSyncTable {
    id_calendar_event_sync: Generated<number>;
    event_id_calendar_event_sync: number;
    connection_id_calendar_event_sync: number;
    external_event_id_calendar_event_sync: string | null;
    external_event_key_calendar_event_sync: ColumnType<Buffer | null, never, never>;
    external_uid_calendar_event_sync: string | null;
    external_version_calendar_event_sync: string | null;
    operation_id_calendar_event_sync: string;
    direction_calendar_event_sync: Generated<"outbound" | "inbound" | "bidirectional">;
    status_calendar_event_sync: Generated<"pending" | "synced" | "error" | "disabled">;
    desired_state_calendar_event_sync: Generated<"present" | "absent">;
    last_synced_version_calendar_event_sync: number | null;
    last_synced_at_calendar_event_sync: DateTime | null;
    attempt_count_calendar_event_sync: Generated<number>;
    next_attempt_at_calendar_event_sync: DateTime | null;
    error_code_calendar_event_sync: string | null;
    created_at_calendar_event_sync: Generated<DateTime>;
    updated_at_calendar_event_sync: Generated<DateTime>;
}
