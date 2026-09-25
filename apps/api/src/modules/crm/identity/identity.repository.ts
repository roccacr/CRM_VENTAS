import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service.js";
import { LOGOUT_REQUESTED_EVENT } from "../audit/security-audit.events.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import { DEFAULT_DIRECT_OVERRIDE_SCOPE, EffectivePermissionService } from "../permissions/effective-permission.service.js";
import type { PermissionInput, PermissionOverrideInput } from "../permissions/permission.types.js";
import { resolveHighestPermissionScope } from "../permissions/permission-scope.js";
import type { IdentityAuthSummary, IdentityOrgUnit, IdentityProfile, IdentityRole } from "./identity.types.js";

const ACTIVE_STATUS = "active";
const REVOKED_STATUS = "revoked";
const LOCAL_PROVIDER_CODE = "local";
const MICROSOFT_PROVIDER_CODE = "microsoft";
const PENDING_LOCAL_STATUS = "pending";
const IDENTITY_RUNTIME_AUDIT_SOURCE = "identity_runtime";
const UPDATE_RESULT_EMPTY_COUNT = 0;
const LOCAL_PROVIDER_AVAILABLE_STATUSES = new Set([ACTIVE_STATUS, PENDING_LOCAL_STATUS]);

type ActiveSessionRow = {
    sessionPublicId: string;
    sessionStatus: string;
    sessionExpiresAt: Date | string;
    sessionPermissionVersion: number;
    userId: number;
    userPublicId: string;
    displayName: string;
    email: string;
    userStatus: string;
    permissionVersion: number;
};

type UpdateResultWithCount = {
    numUpdatedRows?: bigint | number;
};

/**
 * Determina si un UPDATE realmente cambio una fila.
 *
 * Kysely devuelve `numUpdatedRows` como bigint en MySQL. Encapsular la lectura
 * evita que el logout audite dos veces en carreras concurrentes: solo la
 * peticion que revoca la sesion activa registra el evento.
 */
const hasUpdatedRows = (result: UpdateResultWithCount | undefined): boolean => Number(result?.numUpdatedRows ?? UPDATE_RESULT_EMPTY_COUNT) > UPDATE_RESULT_EMPTY_COUNT;

/**
 * Frontera de persistencia para lecturas/escrituras de identidad.
 *
 * Todos los joins usan tablas canonicas CRM e IDs numericos internos solo en la
 * capa de base de datos. Las respuestas publicas exponen `publicId` y campos
 * neutrales. IDs de proveedores externos quedan fuera de este repository salvo
 * que un adapter futuro los mapee primero a usuarios canonicos.
 */
@Injectable()
export class IdentityRepository {
    /**
     * Inyecta base de datos y calculadora de permisos efectivos.
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(EffectivePermissionService) private readonly permissions: EffectivePermissionService,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
    ) {}

    /**
     * Carga la sesion activa y recalcula permisos efectivos del usuario.
     *
     * Esto intencionalmente no se lee desde un payload cacheado de login. Quitar
     * permisos, denies directos, cambios de rol y cambios de area deben afectar
     * el siguiente request protegido bajo la regla P0-S1A.
     */
    async findBySessionPublicId(sessionPublicId: string): Promise<IdentityProfile | null> {
        const session = await this.findActiveSessionByPublicId(sessionPublicId);

        if (!session) {
            return null;
        }

        const [roles, orgUnits, overrides, localStatus] = await Promise.all([this.findRoles(session.userId), this.findOrgUnits(session.userId), this.findOverrides(session.userId), this.findLocalAuthStatus(session.userId)]);
        const rolePermissionScope = resolveHighestPermissionScope(orgUnits.map((orgUnit) => orgUnit.scope));
        const rolePermissions = await this.findRolePermissions(session.userId, rolePermissionScope);
        const effective = this.permissions.calculate({ rolePermissions, overrides });

        return this.buildIdentityProfile({
            session,
            roles,
            orgUnits,
            localStatus,
            permissions: effective.permissions,
        });
    }

    /**
     * Busca la sesion activa usando solo identidad canonica del CRM.
     *
     * La sesion debe estar activa, no expirada, y el usuario debe seguir activo y
     * sin borrado logico. Esta consulta es la compuerta real antes de recalcular
     * permisos efectivos.
     */
    private async findActiveSessionByPublicId(sessionPublicId: string): Promise<ActiveSessionRow | null> {
        const now = new Date();
        const row = await this.database.db
            .selectFrom("sec_auth_session as session")
            .innerJoin("sec_user as user", "user.id_user", "session.user_id_auth_session")
            .select(["session.public_id_auth_session as sessionPublicId", "session.status_auth_session as sessionStatus", "session.expires_at_auth_session as sessionExpiresAt", "session.permission_version_auth_session as sessionPermissionVersion", "user.id_user as userId", "user.public_id_user as userPublicId", "user.display_name_user as displayName", "user.email_user as email", "user.status_user as userStatus", "user.permission_version_user as permissionVersion"])
            .where("session.public_id_auth_session", "=", sessionPublicId)
            .where("session.status_auth_session", "=", ACTIVE_STATUS)
            .where("session.expires_at_auth_session", ">", now)
            .where("user.deleted_at_user", "is", null)
            .where("user.status_user", "=", ACTIVE_STATUS)
            .executeTakeFirst();

        return row ?? null;
    }

    /**
     * Arma el contrato publico de identidad sin exponer IDs internos.
     */
    private buildIdentityProfile(input: { session: ActiveSessionRow; roles: IdentityRole[]; orgUnits: IdentityOrgUnit[]; localStatus: string | null; permissions: IdentityProfile["permissions"] }): IdentityProfile {
        const { session, roles, orgUnits, localStatus, permissions } = input;

        return {
            user: {
                publicId: session.userPublicId,
                displayName: session.displayName,
                email: session.email,
                status: session.userStatus,
                permissionVersion: session.permissionVersion,
            },
            session: {
                publicId: session.sessionPublicId,
                status: session.sessionStatus,
                expiresAt: new Date(session.sessionExpiresAt).toISOString(),
                permissionVersion: session.sessionPermissionVersion,
            },
            auth: this.buildAuthSummary(localStatus),
            roles,
            orgUnits,
            permissions,
        };
    }

    /**
     * Traduce el estado local a un resumen de autenticacion provider-neutral.
     */
    private buildAuthSummary(localStatus: string | null): IdentityAuthSummary {
        const resolvedLocalStatus = localStatus ?? PENDING_LOCAL_STATUS;
        const availableProviders = LOCAL_PROVIDER_AVAILABLE_STATUSES.has(resolvedLocalStatus) ? [MICROSOFT_PROVIDER_CODE, LOCAL_PROVIDER_CODE] : [MICROSOFT_PROVIDER_CODE];

        return {
            primaryProvider: MICROSOFT_PROVIDER_CODE,
            availableProviders,
            localStatus: resolvedLocalStatus,
        };
    }

    /**
     * Revoca una sesion y registra auditoria de seguridad en una transaccion.
     *
     * Si la sesion no existe, logout sigue siendo idempotente y no crea fila de
     * auditoria porque no hay usuario canonico para usar como actor/target.
     */
    async revokeSessionByPublicId(sessionPublicId: string, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.database.db.transaction().execute(async (transaction) => {
            const session = await transaction.selectFrom("sec_auth_session").select(["id_auth_session", "user_id_auth_session"]).where("public_id_auth_session", "=", sessionPublicId).where("status_auth_session", "=", ACTIVE_STATUS).executeTakeFirst();

            if (!session) {
                return;
            }

            const updateResult = await transaction
                .updateTable("sec_auth_session")
                .set({
                    status_auth_session: REVOKED_STATUS,
                    revoked_at_auth_session: new Date(),
                    revoked_by_user_id_auth_session: session.user_id_auth_session,
                })
                .where("id_auth_session", "=", session.id_auth_session)
                .where("status_auth_session", "=", ACTIVE_STATUS)
                .executeTakeFirst();

            if (!hasUpdatedRows(updateResult)) {
                return;
            }

            await this.audit.record(
                {
                    eventType: LOGOUT_REQUESTED_EVENT.eventType,
                    actorUserId: session.user_id_auth_session,
                    targetUserId: session.user_id_auth_session,
                    summary: LOGOUT_REQUESTED_EVENT.summary,
                    reason: LOGOUT_REQUESTED_EVENT.reason,
                    ...(ipAddress ? { ipAddress } : {}),
                    ...(userAgent ? { userAgent } : {}),
                    metadata: {
                        source: IDENTITY_RUNTIME_AUDIT_SOURCE,
                    },
                },
                transaction,
            );
        });
    }

    /**
     * Retorna roles activos asignados directamente al usuario canonico CRM.
     */
    private async findRoles(userId: number): Promise<IdentityRole[]> {
        const rows = await this.database.db.selectFrom("sec_user_role as userRole").innerJoin("sec_role as role", "role.id_role", "userRole.role_id_user_role").select(["role.code_role as code", "role.name_role as name", "role.status_role as status"]).where("userRole.user_id_user_role", "=", userId).where("userRole.status_user_role", "=", ACTIVE_STATUS).where("role.status_role", "=", ACTIVE_STATUS).where("role.deleted_at_role", "is", null).execute();

        return rows;
    }

    /**
     * Retorna membresias de area activas del usuario canonico CRM.
     *
     * La membresia de area determina el scope ABAC usado luego por resolucion
     * de permisos: self, assigned, own area, area tree o all areas.
     */
    private async findOrgUnits(userId: number): Promise<IdentityOrgUnit[]> {
        const rows = await this.database.db
            .selectFrom("sec_user_org_unit as userOrg")
            .innerJoin("sec_org_unit as org", "org.id_org_unit", "userOrg.org_unit_id_user_org_unit")
            .select(["org.public_id_org_unit as publicId", "org.code_org_unit as code", "org.name_org_unit as name", "userOrg.membership_code_user_org_unit as membership", "userOrg.scope_code_user_org_unit as scope", "userOrg.status_user_org_unit as status"])
            .where("userOrg.user_id_user_org_unit", "=", userId)
            .where("userOrg.status_user_org_unit", "=", ACTIVE_STATUS)
            .where("org.status_org_unit", "=", ACTIVE_STATUS)
            .where("org.deleted_at_org_unit", "is", null)
            .execute();

        return rows;
    }

    /**
     * Retorna permisos derivados de rol usando el scope organizacional activo mas amplio del usuario.
     */
    private async findRolePermissions(userId: number, scope: string): Promise<PermissionInput[]> {
        const rows = await this.database.db
            .selectFrom("sec_user_role as userRole")
            .innerJoin("sec_role as role", "role.id_role", "userRole.role_id_user_role")
            .innerJoin("sec_role_permission as rolePermission", "rolePermission.role_id_role_permission", "userRole.role_id_user_role")
            .innerJoin("sec_permission as permission", "permission.id_permission", "rolePermission.permission_id_role_permission")
            .select(["permission.code_permission as code"])
            .where("userRole.user_id_user_role", "=", userId)
            .where("userRole.status_user_role", "=", ACTIVE_STATUS)
            .where("role.status_role", "=", ACTIVE_STATUS)
            .where("role.deleted_at_role", "is", null)
            .where("rolePermission.status_role_permission", "=", ACTIVE_STATUS)
            .where("permission.status_permission", "=", ACTIVE_STATUS)
            .execute();

        return rows.map((row) => ({ code: row.code, scope }));
    }

    /**
     * Retorna grants/denies directos activos del usuario canonico CRM.
     *
     * P0-S1A permite overrides directos, pero mantiene delegacion temporal fuera
     * de alcance. Un deny aqui debe imponerse sobre un allow por rol en
     * `EffectivePermissionService`.
     */
    private async findOverrides(userId: number): Promise<PermissionOverrideInput[]> {
        const now = new Date();
        const rows = await this.database.db
            .selectFrom("sec_user_permission_override as override")
            .innerJoin("sec_permission as permission", "permission.id_permission", "override.permission_id_user_permission_override")
            .select(["permission.code_permission as code", "override.effect_user_permission_override as effect"])
            .where("override.user_id_user_permission_override", "=", userId)
            .where("override.status_user_permission_override", "=", ACTIVE_STATUS)
            .where("override.revoked_at_user_permission_override", "is", null)
            .where("permission.status_permission", "=", ACTIVE_STATUS)
            .where("override.starts_at_user_permission_override", "<=", now)
            .where((expression) => expression.or([expression("override.ends_at_user_permission_override", "is", null), expression("override.ends_at_user_permission_override", ">", now)]))
            .execute();

        return rows.filter((row): row is { code: string; effect: "allow" | "deny" } => row.effect === "allow" || row.effect === "deny").map((row) => ({ code: row.code, effect: row.effect, scope: DEFAULT_DIRECT_OVERRIDE_SCOPE }));
    }

    /**
     * Retorna estado de login local sin exponer detalles de credenciales.
     */
    private async findLocalAuthStatus(userId: number): Promise<string | null> {
        const row = await this.database.db.selectFrom("sec_auth_identity").select("status_auth_identity").where("user_id_auth_identity", "=", userId).where("provider_code_auth_identity", "=", LOCAL_PROVIDER_CODE).where("deleted_at_auth_identity", "is", null).executeTakeFirst();

        return row?.status_auth_identity ?? null;
    }
}
