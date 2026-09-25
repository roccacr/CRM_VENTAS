import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

/**
 * Mapa de tablas Kysely para el esquema de identidad aprobado en CRM_THINK_V2.
 *
 * Este archivo replica nombres fisicos SQL para que los repositories queden
 * tipados. No es el diccionario de negocio. El significado de columnas y los
 * comentarios MySQL viven en `Arquitectura/SQL/001_identity_schema_p0_s1.sql`
 * y en el diccionario de datos.
 */
type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

export interface SecUserTable {
    id_user: GeneratedNumber;
    public_id_user: string;
    email_user: string;
    normalized_email_user: string;
    display_name_user: string;
    status_user: string;
    permission_version_user: number;
    last_login_at_user: DateTime | null;
    created_at_user: DateTime;
    created_by_user_id_user: number | null;
    updated_at_user: DateTime;
    updated_by_user_id_user: number | null;
    deleted_at_user: DateTime | null;
    deleted_by_user_id_user: number | null;
}

export interface SecAuthIdentityTable {
    id_auth_identity: GeneratedNumber;
    user_id_auth_identity: number;
    provider_code_auth_identity: string;
    provider_subject_auth_identity: string | null;
    email_auth_identity: string;
    normalized_email_auth_identity: string;
    password_hash_auth_identity: string | null;
    status_auth_identity: string;
    last_used_at_auth_identity: DateTime | null;
    created_at_auth_identity: DateTime;
    updated_at_auth_identity: DateTime;
    deleted_at_auth_identity: DateTime | null;
}

export interface SecAuthSessionTable {
    id_auth_session: GeneratedNumber;
    public_id_auth_session: string;
    user_id_auth_session: number;
    auth_identity_id_auth_session: number;
    permission_version_auth_session: number;
    status_auth_session: string;
    ip_address_auth_session: string | null;
    user_agent_auth_session: string | null;
    created_at_auth_session: DateTime;
    expires_at_auth_session: DateTime;
    revoked_at_auth_session: DateTime | null;
    revoked_by_user_id_auth_session: number | null;
}

export interface SecRoleTable {
    id_role: GeneratedNumber;
    code_role: string;
    name_role: string;
    description_role: string | null;
    status_role: string;
    created_at_role: DateTime;
    updated_at_role: DateTime;
    deleted_at_role: DateTime | null;
}

export interface SecPermissionTable {
    id_permission: GeneratedNumber;
    code_permission: string;
    module_code_permission: string;
    action_code_permission: string;
    description_permission: string | null;
    status_permission: string;
    created_at_permission: DateTime;
    updated_at_permission: DateTime;
}

export interface SecUserRoleTable {
    id_user_role: GeneratedNumber;
    user_id_user_role: number;
    role_id_user_role: number;
    status_user_role: string;
    active_key_user_role: number | null;
    assigned_at_user_role: DateTime;
    assigned_by_user_id_user_role: number | null;
    revoked_at_user_role: DateTime | null;
    revoked_by_user_id_user_role: number | null;
}

export interface SecRolePermissionTable {
    id_role_permission: GeneratedNumber;
    role_id_role_permission: number;
    permission_id_role_permission: number;
    status_role_permission: string;
    active_key_role_permission: number | null;
    created_at_role_permission: DateTime;
}

export interface SecOrgUnitTable {
    id_org_unit: GeneratedNumber;
    public_id_org_unit: string;
    parent_org_unit_id_org_unit: number | null;
    code_org_unit: string;
    name_org_unit: string;
    status_org_unit: string;
    sort_order_org_unit: number;
    created_at_org_unit: DateTime;
    updated_at_org_unit: DateTime;
    deleted_at_org_unit: DateTime | null;
}

export interface SecUserOrgUnitTable {
    id_user_org_unit: GeneratedNumber;
    user_id_user_org_unit: number;
    org_unit_id_user_org_unit: number;
    membership_code_user_org_unit: string;
    scope_code_user_org_unit: string;
    status_user_org_unit: string;
    active_key_user_org_unit: number | null;
    assigned_at_user_org_unit: DateTime;
    assigned_by_user_id_user_org_unit: number | null;
    revoked_at_user_org_unit: DateTime | null;
    revoked_by_user_id_user_org_unit: number | null;
}

export interface SecUserPermissionOverrideTable {
    id_user_permission_override: GeneratedNumber;
    user_id_user_permission_override: number;
    permission_id_user_permission_override: number;
    effect_user_permission_override: string;
    reason_user_permission_override: string;
    status_user_permission_override: string;
    active_key_user_permission_override: number | null;
    starts_at_user_permission_override: DateTime;
    ends_at_user_permission_override: DateTime | null;
    created_by_user_id_user_permission_override: number | null;
    created_at_user_permission_override: DateTime;
    revoked_by_user_id_user_permission_override: number | null;
    revoked_at_user_permission_override: DateTime | null;
}

export interface AuditSecurityEventTable {
    id_security_event: GeneratedNumber;
    public_id_security_event: string;
    event_type_security_event: string;
    actor_user_id_security_event: number | null;
    target_user_id_security_event: number | null;
    summary_security_event: string;
    reason_security_event: string | null;
    ip_address_security_event: string | null;
    user_agent_security_event: string | null;
    metadata_security_event: string | null;
    created_at_security_event: DateTime;
}

export interface CrmDatabase {
    sec_user: SecUserTable;
    sec_auth_identity: SecAuthIdentityTable;
    sec_auth_session: SecAuthSessionTable;
    sec_role: SecRoleTable;
    sec_permission: SecPermissionTable;
    sec_user_role: SecUserRoleTable;
    sec_role_permission: SecRolePermissionTable;
    sec_org_unit: SecOrgUnitTable;
    sec_user_org_unit: SecUserOrgUnitTable;
    sec_user_permission_override: SecUserPermissionOverrideTable;
    audit_security_event: AuditSecurityEventTable;
}

export type SecurityEventInsert = Insertable<AuditSecurityEventTable>;
export type SecurityEventRow = Selectable<AuditSecurityEventTable>;
export type SecurityEventUpdate = Updateable<AuditSecurityEventTable>;
