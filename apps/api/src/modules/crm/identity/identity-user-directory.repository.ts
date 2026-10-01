import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

import { normalizeCaseInsensitiveIdentifier } from "../../../common/security/identifier-normalization.js";
import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import type { CreateSystemUserAccessMethod, CreateSystemUserExternalSystem, CreateSystemUserStatus, SystemUserSortDirection, SystemUserSortKey, SystemUserStatusFilter } from "./dto/system-users.dto.js";
import type { SystemUserDirectoryItem, SystemUserDirectoryOrgUnit, SystemUserProvider, SystemUsersListResponse, SystemUsersSummary } from "./identity.types.js";
import { MICROSOFT_PROVIDER_CODE } from "./identity-microsoft.constants.js";
import { ACTIVE_STATUS, LOCAL_PROVIDER_CODE, PENDING_LOCAL_STATUS } from "./identity-repository.shared.js";

const BLOCKED_STATUS = "blocked";
const INACTIVE_STATUS = "inactive";
const DEFAULT_LIMIT = 25;
const DEFAULT_SORT: SystemUserSortKey = "name";
const DEFAULT_DIRECTION: SystemUserSortDirection = "asc";
const ACTIVE_RELATION_STATUS = ACTIVE_STATUS;
const PROVIDER_ACTIVE_STATUSES = [ACTIVE_STATUS, PENDING_LOCAL_STATUS] as const;
const USER_CREATED_EVENT_TYPE = "user_created";

type IdentityDirectoryExecutor = Pick<Kysely<CrmDatabase>, "insertInto" | "selectFrom">;

type DirectoryCursor = {
    direction: SystemUserSortDirection;
    id: number;
    sort: SystemUserSortKey;
    value: string | null;
};

type UserDirectoryRow = {
    email: string;
    id: number;
    lastActivityAt: Date | string | null;
    name: string;
    profileImageUrl: string | null;
    publicId: string;
    status: string;
};

type UserRoleRow = {
    assignedAt: Date | string;
    code: string;
    name: string;
    userId: number;
};

type UserOrgUnitRow = {
    code: string;
    name: string;
    publicId: string;
    userId: number;
};

type UserProviderRow = {
    provider: string;
    status: string;
    userId: number;
};

type StatusCountRow = {
    status: string;
    total: string | number | bigint;
};

type UserCreationCatalog = {
    actorUserId: number;
    orgUnits: readonly {
        code: string;
        id: number;
    }[];
    roles: readonly {
        code: string;
        id: number;
    }[];
};

export interface ListSystemUsersInput {
    currentUserPublicId: string;
    cursor?: string | undefined;
    direction?: SystemUserSortDirection | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    sort?: SystemUserSortKey | undefined;
    status?: SystemUserStatusFilter | undefined;
}

export interface CreateSystemUserInput {
    accessMethods: readonly CreateSystemUserAccessMethod[];
    actorPublicId: string;
    displayName: string;
    email: string;
    externalReferences: readonly {
        externalUserId: string;
        systemCode: CreateSystemUserExternalSystem;
    }[];
    initialStatus: CreateSystemUserStatus;
    ipAddress?: string | undefined;
    normalizedEmail: string;
    orgUnitCodes: readonly string[];
    reason: string;
    roleCode: string;
    roleCodes: readonly string[];
    userAgent?: string | undefined;
}

interface FindUserPageInput {
    cursor: DirectoryCursor | null;
    direction: SystemUserSortDirection;
    limit: number;
    search?: string | undefined;
    sort: SystemUserSortKey;
    status?: SystemUserStatusFilter | undefined;
}

/**
 * Lecturas paginadas del directorio administrativo de usuarios.
 */
@Injectable()
export class IdentityUserDirectoryRepository {
    /**
     * Inyecta el acceso tipado a MySQL.
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
    ) {}

    /**
     * Crea un usuario interno, su acceso local pendiente y sus relaciones base.
     */
    async create(input: CreateSystemUserInput): Promise<SystemUserDirectoryItem> {
        const createdPublicId = ulid();

        await this.database.db.transaction().execute(async (transaction) => {
            const now = new Date();
            const catalog = await this.readUserCreationCatalog(transaction, input);

            await this.assertEmailIsAvailable(transaction, input.normalizedEmail);
            await this.assertExternalReferencesAreAvailable(transaction, input.externalReferences);

            const userInsert = await transaction
                .insertInto("sec_user")
                .values({
                    created_at_user: now,
                    created_by_user_id_user: catalog.actorUserId,
                    deleted_at_user: null,
                    deleted_by_user_id_user: null,
                    display_name_user: input.displayName,
                    email_user: input.email,
                    last_login_at_user: null,
                    normalized_email_user: input.normalizedEmail,
                    permission_version_user: 1,
                    public_id_user: createdPublicId,
                    status_user: input.initialStatus,
                    updated_at_user: now,
                    updated_by_user_id_user: catalog.actorUserId,
                })
                .executeTakeFirstOrThrow();
            const userId = Number(userInsert.insertId);

            if (input.accessMethods.includes(LOCAL_PROVIDER_CODE)) {
                await transaction
                    .insertInto("sec_auth_identity")
                    .values({
                        created_at_auth_identity: now,
                        email_auth_identity: input.email,
                        failed_login_count_auth_identity: 0,
                        last_failed_login_at_auth_identity: null,
                        last_used_at_auth_identity: null,
                        locked_until_auth_identity: null,
                        normalized_email_auth_identity: input.normalizedEmail,
                        password_hash_auth_identity: null,
                        provider_code_auth_identity: LOCAL_PROVIDER_CODE,
                        provider_subject_auth_identity: null,
                        status_auth_identity: PENDING_LOCAL_STATUS,
                        updated_at_auth_identity: now,
                        user_id_auth_identity: userId,
                    })
                    .executeTakeFirstOrThrow();
            }

            await transaction
                .insertInto("sec_user_role")
                .values(
                    catalog.roles.map((role) => ({
                        assigned_at_user_role: now,
                        assigned_by_user_id_user_role: catalog.actorUserId,
                        revoked_at_user_role: null,
                        revoked_by_user_id_user_role: null,
                        role_id_user_role: role.id,
                        status_user_role: ACTIVE_RELATION_STATUS,
                        user_id_user_role: userId,
                    })),
                )
                .executeTakeFirstOrThrow();

            await transaction
                .insertInto("sec_user_org_unit")
                .values(
                    catalog.orgUnits.map((orgUnit) => ({
                        assigned_at_user_org_unit: now,
                        assigned_by_user_id_user_org_unit: catalog.actorUserId,
                        membership_code_user_org_unit: this.resolveMembershipForRoleCodes(catalog.roles.map((role) => role.code)),
                        org_unit_id_user_org_unit: orgUnit.id,
                        revoked_at_user_org_unit: null,
                        revoked_by_user_id_user_org_unit: null,
                        scope_code_user_org_unit: this.resolveScopeForRoleCodes(catalog.roles.map((role) => role.code)),
                        status_user_org_unit: ACTIVE_RELATION_STATUS,
                        user_id_user_org_unit: userId,
                    })),
                )
                .executeTakeFirstOrThrow();

            await this.insertExternalReferences(transaction, userId, input);
            await this.audit.record(
                {
                    actorUserId: catalog.actorUserId,
                    eventType: USER_CREATED_EVENT_TYPE,
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
                        externalSystems: input.externalReferences.map((reference) => reference.systemCode),
                        initialStatus: input.initialStatus,
                        accessMethods: input.accessMethods,
                        orgUnitCodes: catalog.orgUnits.map((orgUnit) => orgUnit.code),
                        roleCode: input.roleCode,
                        roleCodes: catalog.roles.map((role) => role.code),
                    },
                    reason: input.reason,
                    summary: "Usuario interno creado.",
                    targetUserId: userId,
                    userAgent: input.userAgent ?? null,
                },
                transaction,
            );
        });

        const created = await this.findByPublicId(input.actorPublicId, createdPublicId);

        if (!created) {
            throw new BadRequestException("Usuario creado no disponible.");
        }

        return created;
    }

    /**
     * Lista usuarios con filtros, ordenamiento y paginacion keyset.
     */
    async list(input: ListSystemUsersInput): Promise<SystemUsersListResponse> {
        const limit = input.limit ?? DEFAULT_LIMIT;
        const sort = input.sort ?? DEFAULT_SORT;
        const direction = input.direction ?? DEFAULT_DIRECTION;
        const cursor = this.decodeCursor(input.cursor, sort, direction);
        const rows = await this.findUserPage({
            cursor,
            direction,
            limit,
            search: input.search,
            sort,
            status: input.status,
        });
        const hasNextPage = rows.length > limit;
        const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
        const userIds = pageRows.map((row) => row.id);
        const [rolesByUser, orgUnitsByUser, providersByUser, total, summary] = await Promise.all([this.findRolesByUser(userIds), this.findOrgUnitsByUser(userIds), this.findProvidersByUser(userIds), this.countMatchingUsers(input), this.countUsersByStatus()]);

        return {
            items: pageRows.map((row) =>
                this.mapDirectoryItem({
                    currentUserPublicId: input.currentUserPublicId,
                    orgUnits: orgUnitsByUser.get(row.id) ?? [],
                    providers: providersByUser.get(row.id) ?? [],
                    roles: rolesByUser.get(row.id) ?? [],
                    row,
                }),
            ),
            page: {
                limit,
                nextCursor: hasNextPage ? this.encodeCursor(pageRows[pageRows.length - 1], sort, direction) : null,
                total,
            },
            summary,
        };
    }

    /**
     * Lee el detalle administrativo de un usuario por identificador publico.
     */
    async findByPublicId(currentUserPublicId: string, userPublicId: string): Promise<SystemUserDirectoryItem | null> {
        const row = await this.database.db
            .selectFrom("sec_user as user")
            .leftJoin("sec_user_profile_image as profileImage", (join) => join.onRef("profileImage.user_id_user_profile_image", "=", "user.id_user").on("profileImage.status_user_profile_image", "=", ACTIVE_STATUS).on("profileImage.expires_at_user_profile_image", "is", null))
            .select(["user.display_name_user as name", "user.email_user as email", "user.id_user as id", "user.last_login_at_user as lastActivityAt", "user.public_id_user as publicId", "user.status_user as status", "profileImage.public_url_user_profile_image as profileImageUrl"])
            .where("user.public_id_user", "=", userPublicId)
            .where("user.deleted_at_user", "is", null)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        const [[, roles], [, orgUnits], [, providers]] = await Promise.all([this.findRolesByUser([row.id]).then((map) => [row.id, map.get(row.id) ?? []] as const), this.findOrgUnitsByUser([row.id]).then((map) => [row.id, map.get(row.id) ?? []] as const), this.findProvidersByUser([row.id]).then((map) => [row.id, map.get(row.id) ?? []] as const)]);

        return this.mapDirectoryItem({
            currentUserPublicId,
            orgUnits,
            providers,
            roles,
            row,
        });
    }

    private async readUserCreationCatalog(executor: IdentityDirectoryExecutor, input: CreateSystemUserInput): Promise<UserCreationCatalog> {
        const requestedOrgUnitCodes = [...new Set(input.orgUnitCodes.map((orgUnitCode) => orgUnitCode.trim()).filter((orgUnitCode) => orgUnitCode.length > 0))];
        const requestedRoleCodes = [...new Set((input.roleCodes.length > 0 ? input.roleCodes : [input.roleCode]).map((roleCode) => roleCode.trim()).filter((roleCode) => roleCode.length > 0))];

        if (requestedOrgUnitCodes.length === 0) {
            throw new BadRequestException("Area inicial no disponible.");
        }

        if (requestedRoleCodes.length === 0) {
            throw new BadRequestException("Rol inicial no disponible.");
        }

        const [actor, roles, orgUnits] = await Promise.all([
            executor.selectFrom("sec_user").select("id_user as id").where("public_id_user", "=", input.actorPublicId).where("deleted_at_user", "is", null).executeTakeFirst(),
            executor.selectFrom("sec_role").select(["code_role as code", "id_role as id"]).where("code_role", "in", requestedRoleCodes).where("status_role", "=", ACTIVE_STATUS).where("deleted_at_role", "is", null).execute(),
            executor.selectFrom("sec_org_unit").select(["code_org_unit as code", "id_org_unit as id"]).where("code_org_unit", "in", requestedOrgUnitCodes).where("status_org_unit", "=", ACTIVE_STATUS).where("deleted_at_org_unit", "is", null).execute(),
        ]);

        if (!actor) {
            throw new BadRequestException("Actor no disponible para crear usuario.");
        }

        if (roles.length !== requestedRoleCodes.length) {
            throw new BadRequestException("Rol inicial no disponible.");
        }

        if (orgUnits.length !== requestedOrgUnitCodes.length) {
            throw new BadRequestException("Area inicial no disponible.");
        }

        return {
            actorUserId: actor.id,
            orgUnits,
            roles,
        };
    }

    private async assertEmailIsAvailable(executor: IdentityDirectoryExecutor, normalizedEmail: string): Promise<void> {
        const existing = await executor.selectFrom("sec_user").select("id_user").where("normalized_email_user", "=", normalizedEmail).where("deleted_at_user", "is", null).executeTakeFirst();

        if (existing) {
            throw new ConflictException("Ya existe un usuario con ese correo.");
        }
    }

    private async assertExternalReferencesAreAvailable(executor: IdentityDirectoryExecutor, references: CreateSystemUserInput["externalReferences"]): Promise<void> {
        for (const reference of references) {
            const existing = await executor
                .selectFrom("int_user_external_identity as externalIdentity")
                .innerJoin("int_external_system as externalSystem", "externalSystem.id_external_system", "externalIdentity.external_system_id_user_external_identity")
                .select("externalIdentity.id_user_external_identity")
                .where("externalSystem.code_external_system", "=", reference.systemCode)
                .where("externalIdentity.external_user_id_user_external_identity", "=", reference.externalUserId)
                .where("externalIdentity.deleted_at_user_external_identity", "is", null)
                .executeTakeFirst();

            if (existing) {
                throw new ConflictException("Ya existe un usuario con una referencia externa indicada.");
            }
        }
    }

    private async insertExternalReferences(executor: IdentityDirectoryExecutor, userId: number, input: CreateSystemUserInput): Promise<void> {
        if (input.externalReferences.length === 0) {
            return;
        }

        const now = new Date();

        for (const reference of input.externalReferences) {
            const externalSystem = await executor.selectFrom("int_external_system").select("id_external_system as id").where("code_external_system", "=", reference.systemCode).executeTakeFirst();

            if (!externalSystem) {
                throw new BadRequestException("Sistema externo no disponible.");
            }

            await executor
                .insertInto("int_user_external_identity")
                .values({
                    created_at_user_external_identity: now,
                    deleted_at_user_external_identity: null,
                    external_system_id_user_external_identity: externalSystem.id,
                    external_user_id_user_external_identity: reference.externalUserId,
                    external_username_user_external_identity: input.email,
                    metadata_user_external_identity: JSON.stringify({ createdReason: input.reason }),
                    status_user_external_identity: ACTIVE_STATUS,
                    updated_at_user_external_identity: now,
                    user_id_user_external_identity: userId,
                })
                .executeTakeFirstOrThrow();
        }
    }

    private resolveMembershipForRoleCodes(roleCodes: readonly string[]): string {
        if (roleCodes.includes("jefe_general") || roleCodes.includes("jefe_area")) {
            return "leader";
        }

        if (roleCodes.includes("subjefe_area")) {
            return "assistant_leader";
        }

        if (roleCodes.includes("gerente") || roleCodes.includes("supervisor")) {
            return "supervisor";
        }

        return "member";
    }

    private resolveScopeForRoleCodes(roleCodes: readonly string[]): string {
        if (roleCodes.includes("owner")) {
            return "all_areas";
        }

        if (roleCodes.some((roleCode) => roleCode === "jefe_general" || roleCode === "gerente" || roleCode === "jefe_area" || roleCode === "subjefe_area" || roleCode === "supervisor")) {
            return "own_area_and_children";
        }

        return "self";
    }

    /**
     * Trae una página y una fila de más.
     *
     * Esa fila extra solo dice si hay cursor siguiente; no se devuelve. El id
     * interno desempata el orden y no sale en la respuesta.
     */
    private async findUserPage(input: FindUserPageInput): Promise<UserDirectoryRow[]> {
        let query = this.database.db
            .selectFrom("sec_user as user")
            .leftJoin("sec_user_profile_image as profileImage", (join) => join.onRef("profileImage.user_id_user_profile_image", "=", "user.id_user").on("profileImage.status_user_profile_image", "=", ACTIVE_STATUS).on("profileImage.expires_at_user_profile_image", "is", null))
            .select(["user.display_name_user as name", "user.email_user as email", "user.id_user as id", "user.last_login_at_user as lastActivityAt", "user.public_id_user as publicId", "user.status_user as status", "profileImage.public_url_user_profile_image as profileImageUrl"])
            .where("user.deleted_at_user", "is", null);

        if (input.status) {
            query = query.where("user.status_user", "=", input.status);
        }

        if (input.search) {
            query = query.where(this.buildSearchCondition(input.search));
        }

        if (input.cursor) {
            query = query.where(this.buildCursorCondition(input.cursor));
        }

        return query
            .orderBy(this.getSortColumn(input.sort), input.direction)
            .orderBy("user.id_user", input.direction)
            .limit(input.limit + 1)
            .execute();
    }

    /**
     * Cuenta el filtro completo, sin el cursor.
     *
     * El total de la página no debe bajar solo porque el cliente pidió la segunda hoja.
     */
    private async countMatchingUsers(input: Pick<ListSystemUsersInput, "search" | "status">): Promise<number> {
        let query = this.database.db
            .selectFrom("sec_user as user")
            .select(sql<string | number | bigint>`COUNT(*)`.as("total"))
            .where("user.deleted_at_user", "is", null);

        if (input.status) {
            query = query.where("user.status_user", "=", input.status);
        }

        if (input.search) {
            query = query.where(this.buildSearchCondition(input.search));
        }

        const row = await query.executeTakeFirst();
        return Number(row?.total ?? 0);
    }

    /**
     * Conteos globales por estado.
     *
     * No aplican la búsqueda ni el filtro activo: los KPI siguen mostrando el
     * directorio entero. Un estado desconocido suma a `all` y no abre una casilla nueva.
     */
    private async countUsersByStatus(): Promise<SystemUsersSummary> {
        const rows = await this.database.db
            .selectFrom("sec_user")
            .select(["status_user as status", sql<number>`COUNT(*)`.as("total")])
            .where("deleted_at_user", "is", null)
            .groupBy("status_user")
            .execute();
        const summary: SystemUsersSummary = {
            active: 0,
            all: 0,
            blocked: 0,
            inactive: 0,
            pending: 0,
        };

        for (const row of rows as StatusCountRow[]) {
            const total = Number(row.total);
            summary.all += total;

            if (row.status === ACTIVE_STATUS || row.status === BLOCKED_STATUS || row.status === INACTIVE_STATUS || row.status === PENDING_LOCAL_STATUS) {
                summary[row.status] = total;
            }
        }

        return summary;
    }

    /**
     * Roles activos de la página, en una sola consulta.
     *
     * Una lista vacía no arma un `IN ()`. Roles o asignaciones inactivas no se muestran.
     */
    private async findRolesByUser(userIds: readonly number[]): Promise<Map<number, UserRoleRow[]>> {
        if (userIds.length === 0) {
            return new Map();
        }

        const rows = await this.database.db
            .selectFrom("sec_user_role as userRole")
            .innerJoin("sec_role as role", "role.id_role", "userRole.role_id_user_role")
            .select(["role.code_role as code", "role.name_role as name", "userRole.assigned_at_user_role as assignedAt", "userRole.user_id_user_role as userId"])
            .where("userRole.user_id_user_role", "in", [...userIds])
            .where("userRole.status_user_role", "=", ACTIVE_RELATION_STATUS)
            .where("role.status_role", "=", ACTIVE_STATUS)
            .where("role.deleted_at_role", "is", null)
            .execute();

        return this.groupByUser(rows);
    }

    /** Áreas activas de la página. La membresía borrada o inactiva no cuenta como alcance visible. */
    private async findOrgUnitsByUser(userIds: readonly number[]): Promise<Map<number, UserOrgUnitRow[]>> {
        if (userIds.length === 0) {
            return new Map();
        }

        const rows = await this.database.db
            .selectFrom("sec_user_org_unit as membership")
            .innerJoin("sec_org_unit as orgUnit", "orgUnit.id_org_unit", "membership.org_unit_id_user_org_unit")
            .select(["membership.user_id_user_org_unit as userId", "orgUnit.code_org_unit as code", "orgUnit.name_org_unit as name", "orgUnit.public_id_org_unit as publicId"])
            .where("membership.user_id_user_org_unit", "in", [...userIds])
            .where("membership.status_user_org_unit", "=", ACTIVE_RELATION_STATUS)
            .where("orgUnit.status_org_unit", "=", ACTIVE_STATUS)
            .where("orgUnit.deleted_at_org_unit", "is", null)
            .execute();

        return this.groupByUser(rows);
    }

    /**
     * Proveedores vigentes de la página.
     *
     * Solo entran local activo o pendiente y Microsoft activo. Un proveedor
     * borrado no debe verse como método de acceso.
     */
    private async findProvidersByUser(userIds: readonly number[]): Promise<Map<number, UserProviderRow[]>> {
        if (userIds.length === 0) {
            return new Map();
        }

        const rows = await this.database.db
            .selectFrom("sec_auth_identity")
            .select(["provider_code_auth_identity as provider", "status_auth_identity as status", "user_id_auth_identity as userId"])
            .where("user_id_auth_identity", "in", [...userIds])
            .where("status_auth_identity", "in", [...PROVIDER_ACTIVE_STATUSES])
            .where("deleted_at_auth_identity", "is", null)
            .execute();

        return this.groupByUser(rows);
    }

    private groupByUser<TRow extends { readonly userId: number }>(rows: readonly TRow[]): Map<number, TRow[]> {
        const map = new Map<number, TRow[]>();

        for (const row of rows) {
            map.set(row.userId, [...(map.get(row.userId) ?? []), row]);
        }

        return map;
    }

    /**
     * Arma la fila pública.
     *
     * El id interno no sale. `invitedBy` queda null porque esta lectura todavía
     * no tiene ese dato. El MFA no se consulta: Microsoft o mixto se informan
     * como habilitado y el resto como no configurado. Si hay varias áreas, se
     * muestra la primera.
     */
    private mapDirectoryItem(input: { currentUserPublicId: string; orgUnits: readonly UserOrgUnitRow[]; providers: readonly UserProviderRow[]; roles: readonly UserRoleRow[]; row: UserDirectoryRow }): SystemUserDirectoryItem {
        const provider = this.resolveProvider(input.providers);
        const roleChangedAt = this.resolveLatestRoleChangedAt(input.roles);

        return {
            email: input.row.email,
            invitedBy: null,
            isCurrentUser: input.row.publicId === input.currentUserPublicId,
            lastActivityAt: this.toIsoString(input.row.lastActivityAt),
            mfaStatus: provider === MICROSOFT_PROVIDER_CODE || provider === "mixed" ? "enabled" : "not_configured",
            name: input.row.name,
            orgUnit: input.orgUnits[0] ? this.mapOrgUnit(input.orgUnits[0]) : null,
            profileImageUrl: input.row.profileImageUrl,
            provider,
            publicId: input.row.publicId,
            roleChangedAt,
            roles: input.roles.map((role) => ({ code: role.code, name: role.name })),
            status: input.row.status as SystemUserDirectoryItem["status"],
        };
    }

    private mapOrgUnit(orgUnit: UserOrgUnitRow): SystemUserDirectoryOrgUnit {
        return {
            code: orgUnit.code,
            name: orgUnit.name,
            publicId: orgUnit.publicId,
        };
    }

    /**
     * Local y Microsoft juntos son `mixed`.
     *
     * Sin Microsoft se informa local, aunque no haya proveedor activo: la UI
     * no deja el acceso en blanco.
     */
    private resolveProvider(providers: readonly UserProviderRow[]): SystemUserProvider {
        const providerCodes = new Set(providers.map((provider) => provider.provider));
        const hasLocal = providerCodes.has(LOCAL_PROVIDER_CODE);
        const hasMicrosoft = providerCodes.has(MICROSOFT_PROVIDER_CODE);

        if (hasLocal && hasMicrosoft) {
            return "mixed";
        }

        if (hasMicrosoft) {
            return MICROSOFT_PROVIDER_CODE;
        }

        return LOCAL_PROVIDER_CODE;
    }

    /** Fecha de la asignación de rol más reciente. Sin roles, no hay cambio que mostrar. */
    private resolveLatestRoleChangedAt(roles: readonly UserRoleRow[]): string | null {
        const latest = roles.reduce<Date | null>((current, role) => {
            const next = this.toDate(role.assignedAt);
            return !current || next.getTime() > current.getTime() ? next : current;
        }, null);

        return latest ? latest.toISOString() : null;
    }

    /**
     * Traduce la columna lógica al nombre físico.
     *
     * El cliente pide `name` o `lastActivity`. Esas palabras no existen como
     * columnas y no se concatenan en el SQL.
     */
    private getSortColumn(sort: SystemUserSortKey): "user.display_name_user" | "user.last_login_at_user" | "user.status_user" {
        if (sort === "lastActivity") {
            return "user.last_login_at_user";
        }

        if (sort === "status") {
            return "user.status_user";
        }

        return "user.display_name_user";
    }

    /**
     * Busca por nombre, correo, rol o área activos.
     *
     * El correo normalizado usa la misma normalización del login. Los comodines
     * del usuario ya vienen escapados.
     */
    private buildSearchCondition(search: string) {
        const like = `%${this.escapeLike(search)}%`;
        const normalizedLike = `%${this.escapeLike(normalizeCaseInsensitiveIdentifier(search))}%`;

        return sql<boolean>`(
            user.display_name_user LIKE ${like} ESCAPE '\\'
            OR user.email_user LIKE ${like} ESCAPE '\\'
            OR user.normalized_email_user LIKE ${normalizedLike} ESCAPE '\\'
            OR EXISTS (
                SELECT 1
                FROM sec_user_role AS search_user_role
                INNER JOIN sec_role AS search_role
                    ON search_role.id_role = search_user_role.role_id_user_role
                WHERE search_user_role.user_id_user_role = user.id_user
                  AND search_user_role.status_user_role = ${ACTIVE_RELATION_STATUS}
                  AND search_role.status_role = ${ACTIVE_STATUS}
                  AND search_role.name_role LIKE ${like} ESCAPE '\\'
            )
            OR EXISTS (
                SELECT 1
                FROM sec_user_org_unit AS search_membership
                INNER JOIN sec_org_unit AS search_org_unit
                    ON search_org_unit.id_org_unit = search_membership.org_unit_id_user_org_unit
                WHERE search_membership.user_id_user_org_unit = user.id_user
                  AND search_membership.status_user_org_unit = ${ACTIVE_RELATION_STATUS}
                  AND search_org_unit.status_org_unit = ${ACTIVE_STATUS}
                  AND search_org_unit.name_org_unit LIKE ${like} ESCAPE '\\'
            )
        )`;
    }

    /**
     * Desempata el keyset con el id interno.
     *
     * Dos filas con el mismo nombre o la misma fecha no se saltan ni se
     * repiten. Una actividad nula se ordena como fecha mínima, no como NULL
     * suelto, porque MySQL no compara NULL de forma estable en este corte.
     */
    private buildCursorCondition(cursor: DirectoryCursor) {
        const operator = cursor.direction === "asc" ? sql`>` : sql`<`;

        if (cursor.sort === "lastActivity") {
            return sql<boolean>`(
                COALESCE(user.last_login_at_user, TIMESTAMP('1000-01-01 00:00:00.000')) ${operator} COALESCE(${cursor.value}, TIMESTAMP('1000-01-01 00:00:00.000'))
                OR (
                    COALESCE(user.last_login_at_user, TIMESTAMP('1000-01-01 00:00:00.000')) = COALESCE(${cursor.value}, TIMESTAMP('1000-01-01 00:00:00.000'))
                    AND user.id_user ${operator} ${cursor.id}
                )
            )`;
        }

        const column = cursor.sort === "status" ? sql`user.status_user` : sql`user.display_name_user`;

        return sql<boolean>`(
            ${column} ${operator} ${cursor.value}
            OR (${column} = ${cursor.value} AND user.id_user ${operator} ${cursor.id})
        )`;
    }

    /**
     * Cursor opaco. Incluye orden y dirección.
     *
     * Un cursor de otro sort se rechaza en lugar de devolver una página cruzada.
     */
    private encodeCursor(row: UserDirectoryRow | undefined, sort: SystemUserSortKey, direction: SystemUserSortDirection): string | null {
        if (!row) {
            return null;
        }

        const payload: DirectoryCursor = {
            direction,
            id: row.id,
            sort,
            value: this.getCursorValue(row, sort),
        };

        return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    }

    /** Un cursor ilegible o de otro orden vuelve a la primera página. No responde 500. */
    private decodeCursor(value: string | undefined, sort: SystemUserSortKey, direction: SystemUserSortDirection): DirectoryCursor | null {
        if (!value) {
            return null;
        }

        try {
            const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<DirectoryCursor>;

            if (!this.isValidCursorPayload(payload, sort, direction)) {
                return null;
            }

            return {
                direction,
                id: payload.id,
                sort,
                value: payload.value ?? null,
            };
        } catch {
            return null;
        }
    }

    private isValidCursorPayload(payload: Partial<DirectoryCursor>, sort: SystemUserSortKey, direction: SystemUserSortDirection): payload is DirectoryCursor {
        const hasValidValue = payload.value === null || typeof payload.value === "string";
        return payload.sort === sort && payload.direction === direction && typeof payload.id === "number" && hasValidValue;
    }

    private getCursorValue(row: UserDirectoryRow, sort: SystemUserSortKey): string | null {
        if (sort === "lastActivity") {
            return this.toIsoString(row.lastActivityAt);
        }

        if (sort === "status") {
            return row.status;
        }

        return row.name;
    }

    /** Escapa `%`, `_` y `\` para que la búsqueda no se convierta en un patrón LIKE. */
    private escapeLike(value: string): string {
        return value.replace(/[\\%_]/gu, "\\$&");
    }

    private toDate(value: Date | string): Date {
        return value instanceof Date ? value : new Date(value);
    }

    private toIsoString(value: Date | string | null): string | null {
        return value ? this.toDate(value).toISOString() : null;
    }
}
