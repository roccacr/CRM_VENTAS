import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { argon2id, hash as hashArgon2Password, verify as verifyArgon2Hash } from "argon2";

import { normalizeCaseInsensitiveIdentifier } from "../../../common/security/identifier-normalization.js";
import { calendarRouteAccess } from "../calendar/calendar-access.js";
import { withDefaultSalesModule } from "../sales/sales-access.js";
import { type CompleteLocalResetDto, type LocalLoginDto, MAX_LOCAL_PASSWORD_LENGTH, MIN_LOCAL_PASSWORD_LENGTH, type RequestLocalResetDto } from "./dto/local-auth.dto.js";
import type { CreateSystemUserAccessMethod, CreateSystemUserDto, ListSystemUsersQueryDto, UpdateSystemUserDto, UpdateSystemUserStatusDto } from "./dto/system-users.dto.js";
import { type FailedLocalLoginRecord, IdentityRepository } from "./identity.repository.js";
import type { ActiveSessionsResponse, IdentityProfile, SessionResponse, SystemUserDirectoryItem, SystemUsersListResponse } from "./identity.types.js";
import { IdentityAccessManagementRepository } from "./identity-access-management.repository.js";
import { IdentityAuditRecorder } from "./identity-audit-recorder.service.js";
import { MICROSOFT_PROVIDER_CODE } from "./identity-microsoft.constants.js";
import { IdentityMicrosoftSessionService, type MicrosoftLoginStartResult } from "./identity-microsoft-session.service.js";
import { reuseRequestProfile } from "./identity-request-context.js";
import { IdentityTokenService, type IssuedIdentityTokens, type IssuedSessionToken, type RotatedRefreshToken } from "./identity-token.service.js";

const ANONYMOUS_SESSION_RESPONSE: SessionResponse = {
    authenticated: false,
    session: null,
    user: null,
};

const LOCAL_LOGIN_LOCKOUT_MAX_FAILURES = 5;
const LOCAL_LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ARGON2_DUMMY_PASSWORD = "crm-tink-dummy-password-for-timing-only";
const ARGON2_DUMMY_HASH = "$argon2id$v=19$m=19456,p=1,t=2$x4LIsYBb4u+XOPFMuBxIRw$mDnYVwKK/1vyxZmiLGl14UGszNfdgkG5b3ToVx0YB94";
const COMMON_LOCAL_PASSWORDS = new Set(["password", "password123", "password1234", "123456789", "1234567890", "123456789012", "qwerty123", "qwerty123456", "roccacr123", "roccacr1234", "crm123456", "crm123456789", "admin123456", "admin123456789"]);
const LOCAL_PROVIDER_CODE = "local";
const USER_VIEW_LIST_PERMISSION = "user.view_list";
const USER_VIEW_DETAIL_PERMISSION = "user.view_detail";
const USER_CREATE_PERMISSION = "user.create";
const USER_ASSIGN_PASSWORD_PERMISSION = "user.assign_password";
const ROLE_ASSIGN_PERMISSION = "role.assign";
const USER_UPDATE_PERMISSION = "user.update";
const USER_ACTIVATE_PERMISSION = "user.activate";
const USER_DEACTIVATE_PERMISSION = "user.deactivate";
const SYSTEM_USERS_DEFAULT_LIMIT = 25;
const SYSTEM_USERS_MAX_LIMIT = 100;
const DEFAULT_SYSTEM_USER_ACCESS_METHODS: readonly CreateSystemUserAccessMethod[] = ["microsoft", "local"];
export const MICROSOFT_ACCOUNT_NOT_ASSIGNED_MESSAGE = "Cuenta Microsoft no asignada al CRM.";
export const MICROSOFT_ACCOUNT_NOT_AUTHORIZED_MESSAGE = "Usuario CRM no autorizado para iniciar sesión.";

/** Tokens y vencimiento del login. Las cookies las pone quien llama; este resultado no las escribe. */
export interface AuthenticatedSessionResult {
    refreshToken: string;
    refreshTokenExpiresAt: Date;
    response: SessionResponse;
    sessionToken: string;
    sessionTokenExpiresAt: Date;
}

/** Profile image bytes and MIME type. */
export interface ProfileImageResult {
    bytes: Buffer;
    mimeType: string;
}

/** Campos de acceso que comparten el alta y la edición. El cliente no manda el id interno. */
type SystemUserAccessMutationPayload = Pick<CreateSystemUserDto | UpdateSystemUserDto, "accessMethods" | "orgUnitCode" | "orgUnitCodes" | "roleCode" | "roleCodes">;

/** El cuerpo viejo trae un solo rol o unidad. Aquí se vuelve lista, sin vacíos ni duplicados. */
const normalizeSystemUserAccessMutation = (payload: SystemUserAccessMutationPayload): { accessMethods: readonly CreateSystemUserAccessMethod[]; orgUnitCodes: readonly string[]; roleCodes: readonly string[] } => {
    const orgUnitCodes = [...new Set((payload.orgUnitCodes ?? (payload.orgUnitCode ? [payload.orgUnitCode] : [])).map((orgUnitCode) => orgUnitCode.trim().toLowerCase()).filter((orgUnitCode) => orgUnitCode.length > 0))];
    const roleCodes = [...new Set((payload.roleCodes ?? [payload.roleCode]).map((roleCode) => roleCode.trim().toLowerCase()).filter((roleCode) => roleCode.length > 0))];
    const accessMethods = [...new Set(payload.accessMethods && payload.accessMethods.length > 0 ? payload.accessMethods : DEFAULT_SYSTEM_USER_ACCESS_METHODS)];

    return {
        accessMethods,
        orgUnitCodes: withDefaultSalesModule(roleCodes, orgUnitCodes),
        roleCodes,
    };
};

/** Network metadata attached to audit events. */
export interface IdentityRequestAuditContext {
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

/** Lo que hace falta para auditar un login local fallido y aplicar el bloqueo. No dice si el correo existe. */
interface LocalLoginFailureContext {
    ipAddress: string | undefined;
    normalizedEmail: string;
    userAgent: string | undefined;
}

/**
 * Tope de la página del directorio.
 *
 * El DTO ya limita 1–100. Esta función vuelve a cerrar el rango por si el
 * servicio recibe el valor sin pasar por el pipe.
 */
const normalizeSystemUsersLimit = (value: unknown): number => {
    const numericLimit = value === undefined ? SYSTEM_USERS_DEFAULT_LIMIT : Number(value);

    if (!Number.isInteger(numericLimit) || numericLimit < 1 || numericLimit > SYSTEM_USERS_MAX_LIMIT) {
        throw new BadRequestException("Limite de usuarios invalido.");
    }

    return numericLimit;
};

/**
 * Servicio de aplicacion para el corte aprobado de identidad.
 *
 * Este servicio contiene los casos de uso de identidad y mantiene controllers
 * delgados. No conoce detalles SQL ni implementa adapters de proveedor
 * directamente. Asi el runtime P0-S1A queda alineado con futuras
 * implementaciones Microsoft/local sin filtrar infraestructura hacia arriba.
 */
@Injectable()
export class IdentityService {
    /**
     * Inyecta las dependencias del caso de uso.
     *
     * El repository lee/escribe identidad; tokens emite secretos opacos; audit
     * registra eventos sin PII; Microsoft encapsula PKCE/MSAL.
     */
    // Explicit providers keep delegation checks shared across both administrative write paths.
    // eslint-disable-next-line max-params
    constructor(
        @Inject(IdentityRepository) private readonly repository: IdentityRepository,
        @Inject(IdentityTokenService) private readonly tokens: IdentityTokenService,
        @Inject(IdentityAuditRecorder) private readonly audit: IdentityAuditRecorder,
        @Inject(IdentityMicrosoftSessionService) private readonly microsoftSession: IdentityMicrosoftSessionService,
        @Inject(IdentityAccessManagementRepository) private readonly accessManagement: IdentityAccessManagementRepository,
    ) {}

    /**
     * Lee el sobre publico de sesion sin lanzar error para visitantes anonimos.
     *
     * El frontend usa este endpoint para decidir si muestra estado de sesion.
     * Retornar una forma anonima neutral evita exponer detalles internos de
     * busqueda.
     */
    async getSession(sessionToken?: string): Promise<SessionResponse> {
        if (!sessionToken) {
            return ANONYMOUS_SESSION_RESPONSE;
        }

        const profile = await this.repository.findBySessionTokenHash(this.tokens.hashToken(sessionToken));

        if (!profile) {
            return ANONYMOUS_SESSION_RESPONSE;
        }

        this.assertPermissionVersionCurrent(profile);

        return {
            authenticated: true,
            session: profile.session,
            user: profile.user,
        };
    }

    /**
     * Retorna el perfil completo de identidad para requests autenticados.
     *
     * El repository recarga roles activos, areas, overrides directos y permisos
     * efectivos. Eso conserva la regla: permisos removidos deben dejar de
     * funcionar en el siguiente request protegido, sin esperar que expire un
     * token de login largo. Guard y servicio comparten una sola lectura por
     * request, instancia de servicio y token exacto; nunca entre requests.
     */
    async getCurrentUser(sessionToken?: string): Promise<IdentityProfile> {
        if (!sessionToken) {
            throw new UnauthorizedException("No autenticado.");
        }

        return reuseRequestProfile(this, sessionToken, async () => {
            const profile = await this.repository.findBySessionTokenHash(this.tokens.hashToken(sessionToken));
            if (!profile) {
                throw new UnauthorizedException("No autenticado.");
            }
            this.assertPermissionVersionCurrent(profile);
            return profile;
        });
    }

    /**
     * Lee la foto cacheada del usuario autenticado desde almacenamiento interno.
     *
     * La respuesta nunca redirige a Microsoft Graph ni revela tokens Microsoft.
     */
    async getCurrentUserProfileImage(sessionToken?: string, options: { refresh?: boolean } = {}): Promise<ProfileImageResult | null> {
        if (!sessionToken) {
            throw new UnauthorizedException("No autenticado.");
        }

        const sessionTokenHash = this.tokens.hashToken(sessionToken);

        if (options.refresh) {
            const refreshedImage = await this.refreshCurrentUserProfileImage(sessionTokenHash);

            if (refreshedImage) {
                return refreshedImage;
            }
        }

        return this.repository.findProfileImageBySessionTokenHash(sessionTokenHash);
    }

    /**
     * Revoca la sesion activa cuando existe.
     *
     * Logout es idempotente a proposito. Llamarlo sin sesion conocida igual
     * retorna success para que el frontend limpie estado local de forma segura.
     */
    async logout(sessionToken: string | undefined, ipAddress?: string, userAgent?: string): Promise<{ success: true }> {
        if (sessionToken) {
            await this.repository.revokeSessionByTokenHash(this.tokens.hashToken(sessionToken), ipAddress, userAgent);
        }

        return { success: true };
    }

    /**
     * Lista sesiones activas del usuario autenticado actual.
     */
    async listActiveSessions(sessionToken?: string): Promise<ActiveSessionsResponse> {
        if (!sessionToken) {
            throw new UnauthorizedException("No autenticado.");
        }

        const sessions = await this.repository.listActiveSessions(this.tokens.hashToken(sessionToken));

        if (!sessions) {
            throw new UnauthorizedException("No autenticado.");
        }

        return { sessions };
    }

    /**
     * Lista usuarios sin exponer ids internos.
     *
     * Exige `user.view_list` en el API. El permiso de la pantalla no reemplaza esta compuerta.
     */
    async listSystemUsers(sessionToken: string | undefined, query: ListSystemUsersQueryDto): Promise<SystemUsersListResponse> {
        const profile = await this.getCurrentUser(sessionToken);
        this.assertCan(profile, USER_VIEW_LIST_PERMISSION);

        return this.repository.listSystemUsers({
            currentUserPublicId: profile.user.publicId,
            cursor: query.cursor,
            direction: query.direction,
            limit: normalizeSystemUsersLimit(query.limit),
            search: query.search,
            sort: query.sort,
            status: query.status,
        });
    }

    /**
     * Detalle administrativo de un usuario.
     *
     * Exige `user.view_detail`. No reutiliza el permiso de la lista: ver el
     * directorio no autoriza abrir una ficha.
     */
    async getSystemUserDetail(sessionToken: string | undefined, userPublicId: string): Promise<SystemUserDirectoryItem> {
        const profile = await this.getCurrentUser(sessionToken);
        this.assertCan(profile, USER_VIEW_DETAIL_PERMISSION);

        const user = await this.repository.findSystemUserByPublicId(profile.user.publicId, userPublicId);

        if (!user) {
            throw new NotFoundException("Usuario no encontrado.");
        }

        return user;
    }

    /**
     * Crea un usuario interno del CRM.
     *
     * La clave inicial es opcional y exige un privilegio adicional. Solo su hash
     * llega a persistencia; sin clave sigue pendiente de activacion/reset.
     */
    async createSystemUser(sessionToken: string | undefined, payload: CreateSystemUserDto, ipAddress?: string, userAgent?: string): Promise<SystemUserDirectoryItem> {
        const profile = await this.getCurrentUser(sessionToken);
        this.assertCan(profile, USER_CREATE_PERMISSION);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);
        const { accessMethods, orgUnitCodes, roleCodes } = normalizeSystemUserAccessMutation(payload);
        await this.accessManagement.assertDelegableAccess(profile, roleCodes, orgUnitCodes, []);
        const passwordHash = await this.hashAssignedInitialPassword(profile, payload.password, accessMethods);

        return this.repository.createSystemUser({
            validateAccess: (transaction) => this.accessManagement.validateAssignmentInTransaction(transaction, { profile, roleCodes, moduleCodes: orgUnitCodes, overrides: [] }),
            accessMethods,
            actorPublicId: profile.user.publicId,
            displayName: payload.displayName.trim(),
            email: payload.email.trim(),
            externalReferences: payload.externalReferences ?? [],
            initialStatus: passwordHash && payload.initialStatus === "pending" ? "active" : payload.initialStatus,
            ...(passwordHash ? { passwordHash } : {}),
            ipAddress,
            normalizedEmail: normalizeCaseInsensitiveIdentifier(payload.email),
            orgUnitCodes,
            reason: payload.reason.trim(),
            roleCode: roleCodes[0] ?? payload.roleCode.trim(),
            roleCodes,
            userAgent,
        });
    }

    /**
     * Edita datos administrativos, roles, areas y referencias externas.
     *
     * No permite editar la cuenta propia: un cambio de roles/acceso puede dejar
     * al actor sin permisos o sin metodo de entrada antes de terminar la sesión.
     * Omitir accessMethods conserva los metodos existentes, sin reactivar proveedores.
     */
    async updateSystemUser(sessionToken: string | undefined, userPublicId: string, payload: UpdateSystemUserDto, context: IdentityRequestAuditContext = {}): Promise<SystemUserDirectoryItem> {
        const profile = await this.getCurrentUser(sessionToken);

        if (normalizeCaseInsensitiveIdentifier(userPublicId) === normalizeCaseInsensitiveIdentifier(profile.user.publicId)) {
            throw new ForbiddenException("No puedes editar tu propia cuenta desde Administracion.");
        }

        this.assertCan(profile, USER_UPDATE_PERMISSION);
        const { accessMethods, orgUnitCodes, roleCodes } = normalizeSystemUserAccessMutation(payload);
        const current = await this.repository.findSystemUserByPublicId(profile.user.publicId, userPublicId);
        if (!current) throw new NotFoundException("Usuario no encontrado.");
        await this.assertAssignmentChangeAllowed(profile, current, roleCodes, orgUnitCodes);
        const user = await this.repository.updateSystemUser({
            validateAccess: (transaction) => this.accessManagement.validateAssignmentInTransaction(transaction, { profile, roleCodes, moduleCodes: orgUnitCodes, userPublicId, validateAssignments: this.hasEffectivePermission(profile, ROLE_ASSIGN_PERMISSION) }),
            preserveAssignments: !this.hasEffectivePermission(profile, ROLE_ASSIGN_PERMISSION),
            accessMethods: payload.accessMethods === undefined ? undefined : accessMethods,
            actorPublicId: profile.user.publicId,
            displayName: payload.displayName.trim(),
            email: payload.email.trim(),
            externalReferences: payload.externalReferences ?? [],
            ipAddress: context.ipAddress,
            normalizedEmail: normalizeCaseInsensitiveIdentifier(payload.email),
            orgUnitCodes,
            reason: payload.reason.trim(),
            roleCode: roleCodes[0] ?? payload.roleCode.trim(),
            roleCodes,
            userAgent: context.userAgent,
            userPublicId,
        });

        if (!user) {
            throw new NotFoundException("Usuario no encontrado.");
        }

        return user;
    }

    /**
     * Cambia el estado operativo de otro usuario.
     *
     * Activar/desbloquear exige `user.activate`; desactivar/bloquear exige
     * `user.deactivate`. La propia cuenta no puede modificarse desde aqui para
     * evitar auto-bloqueos o degradaciones accidentales de Owner.
     */
    async updateSystemUserStatus(sessionToken: string | undefined, userPublicId: string, payload: UpdateSystemUserStatusDto, context: IdentityRequestAuditContext = {}): Promise<SystemUserDirectoryItem> {
        const profile = await this.getCurrentUser(sessionToken);

        if (normalizeCaseInsensitiveIdentifier(userPublicId) === normalizeCaseInsensitiveIdentifier(profile.user.publicId)) {
            throw new ForbiddenException("No puedes cambiar el estado de tu propia cuenta.");
        }

        this.assertCan(profile, payload.status === "active" ? USER_ACTIVATE_PERMISSION : USER_DEACTIVATE_PERMISSION);

        const user = await this.repository.updateSystemUserStatus({
            actorPublicId: profile.user.publicId,
            ipAddress: context.ipAddress,
            reason: payload.reason.trim(),
            status: payload.status,
            userAgent: context.userAgent,
            userPublicId,
        });

        if (!user) {
            throw new NotFoundException("Usuario no encontrado.");
        }

        return user;
    }

    /**
     * Revoca una sesion activa propia. La operacion es idempotente frente a una
     * sesion objetivo inexistente, pero exige que la sesion actual sea valida.
     */
    async revokeOwnSession(sessionPublicId: string, currentSessionToken?: string, ipAddress?: string, userAgent?: string): Promise<{ success: true }> {
        if (!currentSessionToken) {
            throw new UnauthorizedException("No autenticado.");
        }

        const result = await this.repository.revokeOwnSessionByPublicId(this.tokens.hashToken(currentSessionToken), sessionPublicId, ipAddress, userAgent);

        if (result.status === "not_authenticated") {
            throw new UnauthorizedException("No autenticado.");
        }

        return { success: true };
    }

    /**
     * Rota refresh token, emite nuevo token de sesion y mantiene cookies BFF opacas.
     */
    async refresh(refreshToken?: string, ipAddress?: string, userAgent?: string): Promise<AuthenticatedSessionResult> {
        if (!refreshToken) {
            throw new UnauthorizedException("No autenticado.");
        }

        const refreshTokenHash = this.tokens.hashToken(refreshToken);
        await this.assertRefreshProviderStillValid(refreshTokenHash, ipAddress, userAgent);

        const nextSession = this.tokens.issueSessionToken();
        const nextRefresh = this.tokens.rotateRefreshToken();
        const rotation = await this.repository.rotateRefreshSession({
            ipAddress,
            userAgent,
            nextRefreshExpiresAt: nextRefresh.refreshExpiresAt,
            nextRefreshTokenHash: nextRefresh.refreshTokenHash,
            nextSessionExpiresAt: nextSession.sessionExpiresAt,
            nextSessionTokenHash: nextSession.sessionTokenHash,
            refreshTokenHash,
        });

        if (rotation.status === "reused") {
            await this.audit.recordRefreshReuse(rotation.userId, rotation.sessionPublicId, ipAddress, userAgent);
            throw new UnauthorizedException("No autenticado.");
        }

        if (rotation.status !== "rotated") {
            throw new UnauthorizedException("No autenticado.");
        }

        // Una edición de acceso posterior no descarta tokens que ya rotaron. El reuso sigue siendo no autenticado.
        return this.buildAuthenticatedSessionResult(rotation.snapshot, { ...nextSession, sessionExpiresAt: rotation.sessionExpiresAt }, { ...nextRefresh, refreshExpiresAt: rotation.refreshExpiresAt });
    }

    /** Acceso delegado acotado a la sesión Microsoft actual, sin tokens en DTOs o navegador. */
    async withMicrosoftAccess<T>(sessionToken: string | undefined, scopes: string[], callback: (token: string) => Promise<T>): Promise<T | null> {
        const profile = await this.getCurrentUser(sessionToken);
        if (!sessionToken || profile.auth.currentProvider !== "microsoft") return null;
        const account = await this.repository.findMicrosoftAccountCacheBySessionTokenHash(this.tokens.hashToken(sessionToken));
        if (!account) return null;
        const result = await this.microsoftSession.withAccess({ cache: account.cache, homeAccountId: account.homeAccountId, scopes }, callback);
        if (!result) return null;
        await this.repository.updateMicrosoftCache(account.authIdentityId, result.cache);
        return result.value;
    }

    /**
     * Inicia Microsoft OIDC con PKCE/state/nonce y challenge server-side.
     */
    async startMicrosoftLogin(sessionToken?: string, calendar = false): Promise<MicrosoftLoginStartResult> {
        if (!calendar) return this.microsoftSession.startLogin();
        const profile = await this.getCurrentUser(sessionToken);
        if (!calendarRouteAccess(profile, "read")) throw new ForbiddenException("Calendario no autorizado.");
        return this.microsoftSession.startLogin(profile.user.email);
    }

    /**
     * Completa Microsoft OIDC, sincroniza metadata/foto y crea sesion CRM.
     */
    async completeMicrosoftCallback(input: { challengeCookie?: string; code: string; ipAddress?: string; state: string; userAgent?: string }): Promise<AuthenticatedSessionResult> {
        const microsoftResult = await this.microsoftSession.completeCallback({
            challengeCookie: input.challengeCookie,
            code: input.code,
            state: input.state,
        });
        const account = microsoftResult.account;
        const normalizedEmail = normalizeCaseInsensitiveIdentifier(account.email);
        const identityResolution = await this.repository.findOrCreateActiveMicrosoftIdentityForVerifiedEmail({
            email: account.email,
            normalizedEmail,
            subject: account.subject,
        });

        if (identityResolution.status !== "ready") {
            throw new UnauthorizedException(identityResolution.status === "user_not_active" ? MICROSOFT_ACCOUNT_NOT_AUTHORIZED_MESSAGE : MICROSOFT_ACCOUNT_NOT_ASSIGNED_MESSAGE);
        }

        const identity = identityResolution.identity;

        await this.repository.saveMicrosoftAccount({
            ...identity,
            cache: microsoftResult.encryptedCache,
            displayName: account.displayName,
            email: account.email,
            graphSyncedAt: new Date(),
            homeAccountId: account.homeAccountId,
            oid: account.oid,
            profileImage: account.profilePhoto
                ? {
                      bytes: account.profilePhoto.bytes,
                      mimeType: account.profilePhoto.mimeType,
                      publicUrl: "/identity/me/photo",
                      sourceSubject: account.subject,
                  }
                : null,
            subject: account.subject,
            tenantId: account.tenantId,
        });

        const issuedTokens = this.tokens.issueInitialTokens();
        await this.repository.createSession({
            authIdentityId: identity.authIdentityId,
            ipAddress: input.ipAddress,
            permissionVersion: identity.permissionVersion,
            providerCode: MICROSOFT_PROVIDER_CODE,
            refreshExpiresAt: issuedTokens.refreshExpiresAt,
            refreshFamilyId: issuedTokens.refreshFamilyId,
            refreshTokenHash: issuedTokens.refreshTokenHash,
            sessionExpiresAt: issuedTokens.sessionExpiresAt,
            sessionPublicId: issuedTokens.sessionPublicId,
            sessionTokenHash: issuedTokens.sessionTokenHash,
            userAgent: input.userAgent,
            userId: identity.userId,
        });
        await this.audit.recordMicrosoftLoginSucceeded(identity.userId, input.ipAddress, input.userAgent);

        const profile = await this.readProfileAfterSessionIssue(issuedTokens);
        return this.buildAuthenticatedSessionResult(profile, issuedTokens, issuedTokens);
    }

    /**
     * Autentica una identidad local activa usando clave Argon2id.
     */
    async localLogin(payload: LocalLoginDto, ipAddress?: string, userAgent?: string): Promise<AuthenticatedSessionResult> {
        const normalizedEmail = normalizeCaseInsensitiveIdentifier(payload.email);
        const localIdentity = await this.repository.findActiveLocalIdentity(normalizedEmail);

        if (!localIdentity) {
            await this.verifyDummyPasswordForTiming();
            await this.audit.recordLocalLoginFailure(normalizedEmail, ipAddress, userAgent);
            throw new UnauthorizedException("Credenciales invalidas.");
        }

        if (this.isLocalIdentityLocked(localIdentity.lockedUntil)) {
            await this.verifyDummyPasswordForTiming();
            await this.audit.recordLocalLoginFailure(normalizedEmail, ipAddress, userAgent);
            throw new UnauthorizedException("Credenciales invalidas.");
        }

        if (!(await this.isLocalPasswordValid(localIdentity.passwordHash, payload.password))) {
            await this.recordFailedLocalLogin(localIdentity, {
                ipAddress,
                normalizedEmail,
                userAgent,
            });
            await this.audit.recordLocalLoginFailure(normalizedEmail, ipAddress, userAgent);
            throw new UnauthorizedException("Credenciales invalidas.");
        }

        const issuedTokens = this.tokens.issueInitialTokens();
        await this.repository.recordSuccessfulLocalLogin(localIdentity.authIdentityId, localIdentity.userId);
        await this.repository.createSession({
            authIdentityId: localIdentity.authIdentityId,
            ipAddress,
            permissionVersion: localIdentity.permissionVersion,
            providerCode: LOCAL_PROVIDER_CODE,
            refreshExpiresAt: issuedTokens.refreshExpiresAt,
            refreshFamilyId: issuedTokens.refreshFamilyId,
            refreshTokenHash: issuedTokens.refreshTokenHash,
            sessionExpiresAt: issuedTokens.sessionExpiresAt,
            sessionPublicId: issuedTokens.sessionPublicId,
            sessionTokenHash: issuedTokens.sessionTokenHash,
            userAgent,
            userId: localIdentity.userId,
        });

        await this.audit.recordLocalLoginSucceeded(localIdentity.userId, ipAddress, userAgent);

        const profile = await this.readProfileAfterSessionIssue(issuedTokens);
        return this.buildAuthenticatedSessionResult(profile, issuedTokens, issuedTokens);
    }

    /**
     * Canal de entrega pospuesto: rechaza sin consultar identidades ni emitir tokens.
     * La respuesta uniforme no revela si el correo existe.
     */
    async requestLocalReset(payload: RequestLocalResetDto, ipAddress?: string, userAgent?: string): Promise<never> {
        const normalizedEmail = normalizeCaseInsensitiveIdentifier(payload.email);

        await this.audit.recordLocalResetRequested(normalizedEmail, ipAddress, userAgent);

        throw new ServiceUnavailableException("La recuperacion de clave local no esta disponible.");
    }

    /**
     * Completa activacion/reset local con token opaco y Argon2id.
     */
    async completeLocalReset(payload: CompleteLocalResetDto, ipAddress?: string, userAgent?: string): Promise<{ success: true }> {
        this.assertLocalPasswordIsAllowed(payload.newPassword);
        const tokenHash = this.tokens.hashToken(payload.resetToken);

        if (!(await this.repository.hasUsableLocalPasswordResetToken(tokenHash))) {
            throw new UnauthorizedException("Token de activacion/reset invalido.");
        }

        const result = await this.repository.completeLocalPasswordReset({
            ipAddress,
            passwordHash: await hashArgon2Password(payload.newPassword, { type: argon2id }),
            tokenHash,
            userAgent,
        });

        if (result.status !== "completed") {
            throw new UnauthorizedException("Token de activacion/reset invalido.");
        }

        return { success: true };
    }

    /**
     * Valida que Microsoft pueda renovar token en silencio para esta sesion.
     */
    private async assertMicrosoftSessionStillValid(authIdentityId: number, userId: number, ipAddress?: string, userAgent?: string): Promise<void> {
        const accountCache = await this.repository.findMicrosoftAccountCache(authIdentityId);

        if (!accountCache) {
            await this.repository.markMicrosoftInteractionRequiredAndRevokeSessions(authIdentityId, userId);
            await this.audit.recordMicrosoftInteractionRequired(userId, ipAddress, userAgent);
            throw new UnauthorizedException("No autenticado.");
        }

        const renewedCache = await this.microsoftSession.renewSilentToken({
            cache: accountCache.cache,
            homeAccountId: accountCache.homeAccountId,
        });

        if (!renewedCache) {
            await this.repository.markMicrosoftInteractionRequiredAndRevokeSessions(authIdentityId, userId);
            await this.audit.recordMicrosoftInteractionRequired(userId, ipAddress, userAgent);
            throw new UnauthorizedException("Microsoft requiere iniciar sesion nuevamente.");
        }

        await this.repository.updateMicrosoftCache(authIdentityId, renewedCache);
    }

    /**
     * Valida proveedores externos antes de consumir el refresh BFF.
     */
    private async assertRefreshProviderStillValid(refreshTokenHash: string, ipAddress?: string, userAgent?: string): Promise<void> {
        const refreshSession = await this.repository.findRefreshSessionForProviderValidation(refreshTokenHash);

        if (refreshSession?.providerCode === MICROSOFT_PROVIDER_CODE) {
            await this.assertMicrosoftSessionStillValid(refreshSession.authIdentityId, refreshSession.userId, ipAddress, userAgent);
        }
    }

    /**
     * Relee la foto Microsoft solo bajo demanda cuando el navegador detecta una
     * imagen invalida o ausente. Si Microsoft exige login, la foto cae a fallback
     * visual sin revocar la sesion CRM.
     */
    private async refreshCurrentUserProfileImage(sessionTokenHash: string): Promise<ProfileImageResult | null> {
        const accountCache = await this.repository.findMicrosoftAccountCacheBySessionTokenHash(sessionTokenHash);

        if (!accountCache) {
            return null;
        }

        const refreshResult = await this.microsoftSession.refreshProfilePhoto({
            cache: accountCache.cache,
            homeAccountId: accountCache.homeAccountId,
        });

        if (!refreshResult) {
            return null;
        }

        await this.repository.updateMicrosoftCache(accountCache.authIdentityId, refreshResult.encryptedCache);

        if (!refreshResult.profilePhoto) {
            return null;
        }

        await this.repository.updateUserProfileImage({
            profileImage: {
                bytes: refreshResult.profilePhoto.bytes,
                mimeType: refreshResult.profilePhoto.mimeType,
                publicUrl: "/identity/me/photo",
                sourceSubject: accountCache.sourceSubject,
            },
            userId: accountCache.userId,
        });

        return {
            bytes: refreshResult.profilePhoto.bytes,
            mimeType: refreshResult.profilePhoto.mimeType,
        };
    }

    /**
     * Rechaza claves locales triviales antes de gastar Argon2id.
     *
     * La verificacion contra brechas externas queda como adapter futuro; esta
     * lista local cubre passwords comunes sin enviar datos a terceros.
     */
    private assertLocalPasswordIsAllowed(password: string): void {
        const normalizedPassword = password.trim().toLowerCase();

        if (COMMON_LOCAL_PASSWORDS.has(normalizedPassword)) {
            throw new BadRequestException("La clave no cumple la politica de seguridad.");
        }
    }

    /** La clave inicial no cambia usuarios que ya existen y exige el permiso efectivo. Sin acceso local no se guarda. */
    private async hashAssignedInitialPassword(profile: IdentityProfile, password: string | undefined, accessMethods: readonly CreateSystemUserAccessMethod[]): Promise<string | undefined> {
        if (password === undefined) return undefined;
        this.assertCan(profile, USER_ASSIGN_PASSWORD_PERMISSION);
        if (!accessMethods.includes("local")) throw new BadRequestException("La clave inicial requiere acceso local.");
        if (typeof password !== "string" || password.length < MIN_LOCAL_PASSWORD_LENGTH || password.length > MAX_LOCAL_PASSWORD_LENGTH || password.trim().length === 0) throw new BadRequestException("La clave debe contener entre 12 y 128 caracteres y no puede estar en blanco.");
        this.assertLocalPasswordIsAllowed(password);
        return hashArgon2Password(password, { type: argon2id });
    }

    /**
     * Falla si la version de permisos de la sesion ya no coincide con el usuario.
     */
    private assertPermissionVersionCurrent(profile: IdentityProfile): void {
        if (profile.session.permissionVersion !== profile.user.permissionVersion) {
            throw new ConflictException("La sesion requiere revalidacion de permisos.");
        }
    }

    /** El permiso cuenta solo con allow y sin deny. Las dos faltas responden igual. */
    private assertCan(profile: IdentityProfile, permissionCode: string): void {
        if (!this.hasEffectivePermission(profile, permissionCode)) {
            throw new ForbiddenException("Permiso insuficiente.");
        }
    }

    /** Hay permiso efectivo si existe un allow y ningún deny. El deny gana. */
    private hasEffectivePermission(profile: IdentityProfile, permissionCode: string): boolean {
        return profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "allow") && !profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "deny");
    }

    /** Editar datos no exige el permiso de asignar. Si cambian roles o unidades, sí, y el escritor vuelve a mirar la fila bloqueada. */
    private async assertAssignmentChangeAllowed(profile: IdentityProfile, current: SystemUserDirectoryItem, roleCodes: readonly string[], orgUnitCodes: readonly string[]): Promise<void> {
        const currentOrgUnits = current.orgUnits ?? (current.orgUnit ? [current.orgUnit] : []);
        /** Forma canónica para comparar asignaciones: sin duplicados, sin distinguir mayúsculas y en orden. */
        const codes = (values: readonly string[]): string => JSON.stringify([...new Set(values.map(normalizeCaseInsensitiveIdentifier))].sort());
        const changed = [codes(roleCodes) !== codes(current.roles.map((role) => role.code)), codes(orgUnitCodes) !== codes(currentOrgUnits.map((unit) => unit.code))].includes(true);
        if (changed) {
            this.assertCan(profile, ROLE_ASSIGN_PERMISSION);
            const currentAccess = await this.accessManagement.readUserAccess(current.publicId);
            await this.accessManagement.assertDelegableAccess(profile, roleCodes, orgUnitCodes, currentAccess.permissionOverrides);
        }
    }

    /**
     * Verifica Argon2id sin filtrar hashes corruptos como errores 500.
     */
    private async isLocalPasswordValid(passwordHash: string, password: string): Promise<boolean> {
        try {
            return await verifyArgon2Hash(passwordHash, password);
        } catch {
            return false;
        }
    }

    /**
     * Ejecuta una verificacion Argon2id dummy cuando la cuenta no existe.
     *
     * Esto reduce diferencias de timing entre "correo inexistente" y "clave
     * incorrecta" sin guardar ni aceptar ninguna credencial real.
     */
    private async verifyDummyPasswordForTiming(): Promise<void> {
        await this.isLocalPasswordValid(ARGON2_DUMMY_HASH, ARGON2_DUMMY_PASSWORD);
    }

    /**
     * Indica si una identidad local esta temporalmente bloqueada.
     */
    private isLocalIdentityLocked(lockedUntil: Date | null): boolean {
        return lockedUntil !== null && lockedUntil.getTime() > Date.now();
    }

    /**
     * Incrementa contador persistente y bloquea al llegar al limite.
     *
     * El incremento vive en MySQL para no perder intentos paralelos; el service
     * solo interpreta el resultado y emite la auditoria de lockout.
     */
    private async recordFailedLocalLogin(localIdentity: { authIdentityId: number; failedLoginCount: number; userId: number }, context: LocalLoginFailureContext): Promise<void> {
        const lockUntil = new Date(Date.now() + LOCAL_LOGIN_LOCKOUT_DURATION_MS);
        const failureRecord = await this.repository.recordFailedLocalLogin(localIdentity.authIdentityId, LOCAL_LOGIN_LOCKOUT_MAX_FAILURES, lockUntil);

        if (this.shouldAuditLocalIdentityLocked(failureRecord)) {
            await this.audit.recordLocalIdentityLocked({
                failedLoginCount: failureRecord.failedLoginCount,
                ipAddress: context.ipAddress,
                lockedUntil: failureRecord.lockedUntil,
                normalizedEmail: context.normalizedEmail,
                userAgent: context.userAgent,
                userId: localIdentity.userId,
            });
        }
    }

    /**
     * Audita lockout solo cuando MySQL ya dejo la identidad bloqueada.
     */
    private shouldAuditLocalIdentityLocked(failureRecord: FailedLocalLoginRecord): failureRecord is FailedLocalLoginRecord & { lockedUntil: Date } {
        return failureRecord.lockedUntil !== null && failureRecord.failedLoginCount >= LOCAL_LOGIN_LOCKOUT_MAX_FAILURES;
    }

    /**
     * Lee el perfil recien emitido desde el hash del token opaco.
     */
    private async readProfileAfterSessionIssue(tokens: Pick<IssuedIdentityTokens, "sessionTokenHash"> | Pick<IssuedSessionToken, "sessionTokenHash">): Promise<IdentityProfile> {
        const profile = await this.repository.findBySessionTokenHash(tokens.sessionTokenHash);

        if (!profile) {
            throw new UnauthorizedException("No autenticado.");
        }

        this.assertPermissionVersionCurrent(profile);
        return profile;
    }

    /**
     * Traduce perfil interno y tokens opacos al contrato que consume el controller.
     */
    private buildAuthenticatedSessionResult(profile: Pick<IdentityProfile, "session" | "user">, session: Pick<IssuedIdentityTokens, "sessionExpiresAt" | "sessionToken"> | IssuedSessionToken, refresh: Pick<IssuedIdentityTokens, "refreshExpiresAt" | "refreshToken"> | RotatedRefreshToken): AuthenticatedSessionResult {
        return {
            refreshToken: refresh.refreshToken,
            refreshTokenExpiresAt: refresh.refreshExpiresAt,
            response: {
                authenticated: true,
                session: profile.session,
                user: profile.user,
            },
            sessionToken: session.sessionToken,
            sessionTokenExpiresAt: session.sessionExpiresAt,
        };
    }
}
