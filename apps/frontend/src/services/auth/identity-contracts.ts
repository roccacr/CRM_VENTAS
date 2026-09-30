/**
 * Contrato de `/identity/session`, `/identity/me` y el arranque Microsoft.
 *
 * El cliente recibe `unknown`. Estos parsers rechazan una forma distinta en
 * lugar de completar campos: un payload dañado no debe volverse un perfil con
 * permisos inventados.
 */
export type PermissionEffect = "allow" | "deny";
/**
 * Origen del permiso ya calculado por el API.
 *
 * `role` viene del rol, `override` de una concesión o denegación directa y
 * `system` del propio sistema. La UI no vuelve a mezclar esos orígenes: el
 * `effect` que llega aquí ya es el resultado.
 */
export type PermissionSource = "override" | "role" | "system";

/**
 * Permiso ya resuelto por el API.
 *
 * `deny` gana en la UI. `scope` null significa que este registro no trae
 * alcance; no significa permiso sobre todo el CRM.
 */
export interface EffectivePermission {
    readonly code: string;
    readonly effect: PermissionEffect;
    readonly scope: string | null;
    readonly source: PermissionSource;
}

/**
 * Usuario visible.
 *
 * No trae el id interno de MySQL ni ids de Microsoft. La UI solo usa `publicId`.
 */
export interface IdentityUser {
    readonly publicId: string;
    readonly displayName: string;
    readonly email: string;
    readonly profileImageUrl: string | null;
    readonly status: string;
    /** Versión que el API usa para invalidar la vista. No se calcula en el cliente. */
    readonly permissionVersion: number;
}

/**
 * Metadatos de la sesión BFF.
 *
 * No incluye access token, refresh token ni secreto de Microsoft. El vencimiento
 * informa a la UI; quien corta la sesión es el API.
 */
export interface IdentitySession {
    readonly publicId: string;
    readonly status: string;
    readonly expiresAt: string;
    readonly expiresInSeconds: number;
    /** Misma versión que en el usuario. Si el API la cambia, la vista deja de ser válida. */
    readonly permissionVersion: number;
}

/**
 * Vínculo Microsoft que se puede mostrar.
 *
 * Identifica la cuenta enlazada sin traer tokens. `null` en el resumen de auth
 * significa que no hay vínculo, no que la llamada falló.
 */
export interface IdentityMicrosoftStatus {
    readonly homeAccountId: string | null;
    /** El API pide una interacción nueva. El cliente no renueva el token de Microsoft. */
    readonly interactionRequired: boolean;
    readonly lastSyncedAt: string | null;
    readonly tenantId: string | null;
}

/** Rol activo del usuario. Sirve para mostrar, no para calcular permisos en el cliente. */
export interface IdentityRole {
    readonly code: string;
    readonly name: string;
    readonly status: string;
}

/**
 * Área y membresía que el API ya usó para el alcance.
 *
 * El cliente no reinterpreta `membership` ni `scope` para autorizar una pantalla.
 */
export interface IdentityOrgUnit {
    readonly publicId: string;
    readonly code: string;
    readonly name: string;
    readonly membership: string;
    readonly scope: string;
    readonly status: string;
}

export interface IdentityAuthSummary {
    /** El proveedor principal del CRM es Microsoft. Otro valor invalida el contrato. */
    readonly primaryProvider: "microsoft";
    readonly availableProviders: readonly string[];
    readonly currentProvider: string;
    readonly localStatus: string;
    readonly microsoft: IdentityMicrosoftStatus | null;
}

/**
 * Perfil de `/identity/me`.
 *
 * Usuario y sesión son obligatorios. Los permisos ya vienen resueltos; esta
 * interfaz no es una lista cruda de roles para que el cliente decida el acceso.
 */
export interface IdentityProfile {
    readonly user: IdentityUser;
    readonly session: IdentitySession;
    readonly auth: IdentityAuthSummary;
    readonly roles: readonly IdentityRole[];
    readonly orgUnits: readonly IdentityOrgUnit[];
    readonly permissions: readonly EffectivePermission[];
}

/**
 * Respuesta de `/identity/session`.
 *
 * Sin sesión, `authenticated` es false y usuario y sesión vienen en null. Ese
 * null es un estado válido, no un payload roto.
 */
export interface SessionResponse {
    readonly authenticated: boolean;
    readonly csrfToken: string;
    readonly session: IdentitySession | null;
    readonly user: IdentityUser | null;
}

/**
 * Cuerpo del login local.
 *
 * Viaja solo en el POST. No se guarda en estado, storage ni logs.
 */
export interface LocalLoginCredentials {
    readonly email: string;
    readonly password: string;
}

/**
 * URL que el BFF ya armó para salir hacia Microsoft.
 *
 * El cliente navega a ella y no le agrega parámetros.
 */
export interface MicrosoftStartResponse {
    readonly authorizationUrl: string;
}

/** Objeto plano. Un array también pasa aquí; falla después, cuando le faltan los campos. */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

/** Descarta `NaN` e `Infinity`. Una versión de permisos así no puede colarse como número. */
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Lista de textos. Un elemento que no sea string invalida proveedores disponibles. */
const isStringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every(isString);

/** Solo `allow` y `deny`. Un efecto desconocido no se convierte en permiso. */
const isPermissionEffect = (value: unknown): value is PermissionEffect => value === "allow" || value === "deny";

/** Solo los tres orígenes del API. Un texto nuevo no se acepta como si ya estuviera resuelto. */
const isPermissionSource = (value: unknown): value is PermissionSource => value === "role" || value === "override" || value === "system";

/**
 * Exige un objeto y nombra el contrato en el error.
 *
 * El mensaje no incluye el cuerpo: un payload inválido puede traer datos que
 * no deben aparecer en la UI ni en un log de cliente.
 */
const assertRecord = (value: unknown, contractName: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new TypeError(`Respuesta ${contractName} inválida.`);
    }

    return value;
};

/**
 * Acepta string o null en campos opcionales.
 *
 * Otro tipo se vuelve null para no tumbar el perfil por un opcional mal
 * formado. Los campos obligatorios siguen fallando en su propio parser.
 */
const parseNullableString = (value: unknown): string | null => (value === null || isString(value) ? value : null);

/**
 * Copia solo los campos del usuario.
 *
 * Las claves de más que mande el API se pierden. Así un id interno no entra
 * al objeto tipado aunque el JSON lo traiga.
 */
const parseIdentityUser = (value: unknown): IdentityUser => {
    const record = assertRecord(value, "IdentityUser");

    if (!isString(record.publicId) || !isString(record.displayName) || !isString(record.email) || !isString(record.status) || !isNumber(record.permissionVersion)) {
        throw new TypeError("Respuesta IdentityUser inválida.");
    }

    return {
        displayName: record.displayName,
        email: record.email,
        permissionVersion: record.permissionVersion,
        profileImageUrl: parseNullableString(record.profileImageUrl),
        publicId: record.publicId,
        status: record.status,
    };
};

/** Misma copia cerrada que el usuario: sin tokens y sin campos extra. */
const parseIdentitySession = (value: unknown): IdentitySession => {
    const record = assertRecord(value, "IdentitySession");

    if (!isString(record.publicId) || !isString(record.status) || !isString(record.expiresAt) || !isNumber(record.expiresInSeconds) || !isNumber(record.permissionVersion)) {
        throw new TypeError("Respuesta IdentitySession inválida.");
    }

    return {
        expiresAt: record.expiresAt,
        expiresInSeconds: record.expiresInSeconds,
        permissionVersion: record.permissionVersion,
        publicId: record.publicId,
        status: record.status,
    };
};

/**
 * Permiso efectivo de un ítem de la lista.
 *
 * Efecto y origen tienen que ser exactos. Un `scope` de otro tipo pasa a null,
 * igual que el resto de textos opcionales, y no se interpreta como alcance global.
 */
const parseEffectivePermission = (value: unknown): EffectivePermission => {
    const record = assertRecord(value, "EffectivePermission");

    if (!isString(record.code) || !isPermissionEffect(record.effect) || !isPermissionSource(record.source)) {
        throw new TypeError("Respuesta EffectivePermission inválida.");
    }

    return {
        code: record.code,
        effect: record.effect,
        scope: record.scope === null || isString(record.scope) ? record.scope : null,
        source: record.source,
    };
};

/** Rol de solo lectura. No se usa para deducir permisos que el API no envió. */
const parseRole = (value: unknown): IdentityRole => {
    const record = assertRecord(value, "IdentityRole");

    if (!isString(record.code) || !isString(record.name) || !isString(record.status)) {
        throw new TypeError("Respuesta IdentityRole inválida.");
    }

    return {
        code: record.code,
        name: record.name,
        status: record.status,
    };
};

/** Área ya resuelta. `scope` aquí es obligatorio: a diferencia del permiso, no se vacía si falta. */
const parseOrgUnit = (value: unknown): IdentityOrgUnit => {
    const record = assertRecord(value, "IdentityOrgUnit");

    if (!isString(record.publicId) || !isString(record.code) || !isString(record.name) || !isString(record.membership) || !isString(record.scope) || !isString(record.status)) {
        throw new TypeError("Respuesta IdentityOrgUnit inválida.");
    }

    return {
        code: record.code,
        membership: record.membership,
        name: record.name,
        publicId: record.publicId,
        scope: record.scope,
        status: record.status,
    };
};

/**
 * Estado Microsoft o ausencia de vínculo.
 *
 * `null` es válido. Si el objeto viene, `interactionRequired` tiene que ser
 * booleano; los identificadores opcionales sí pueden degradarse a null.
 */
const parseMicrosoftStatus = (value: unknown): IdentityMicrosoftStatus | null => {
    if (value === null) {
        return null;
    }

    const record = assertRecord(value, "IdentityMicrosoftStatus");

    if (typeof record.interactionRequired !== "boolean") {
        throw new TypeError("Respuesta IdentityMicrosoftStatus inválida.");
    }

    return {
        homeAccountId: parseNullableString(record.homeAccountId),
        interactionRequired: record.interactionRequired,
        lastSyncedAt: parseNullableString(record.lastSyncedAt),
        tenantId: parseNullableString(record.tenantId),
    };
};

/**
 * Resumen de proveedores.
 *
 * `primaryProvider` solo puede ser `microsoft`. Otro valor rechaza el perfil
 * en lugar de dejar que la UI elija un proveedor.
 */
const parseAuthSummary = (value: unknown): IdentityAuthSummary => {
    const record = assertRecord(value, "IdentityAuthSummary");

    if (record.primaryProvider !== "microsoft" || !isStringArray(record.availableProviders) || !isString(record.currentProvider) || !isString(record.localStatus)) {
        throw new TypeError("Respuesta IdentityAuthSummary inválida.");
    }

    return {
        availableProviders: record.availableProviders,
        currentProvider: record.currentProvider,
        localStatus: record.localStatus,
        microsoft: parseMicrosoftStatus(record.microsoft),
        primaryProvider: record.primaryProvider,
    };
};

/**
 * Valida `/identity/session`.
 *
 * Usuario y sesión en null son el caso anónimo. Si vienen objetos, se validan;
 * este parser no exige que `authenticated` coincida con su presencia. Quien
 * decide si esa combinación abre el shell es el llamador.
 */
export const parseSessionResponse = (value: unknown): SessionResponse => {
    const record = assertRecord(value, "SessionResponse");

    if (typeof record.authenticated !== "boolean" || !isString(record.csrfToken)) {
        throw new TypeError("Respuesta SessionResponse inválida.");
    }

    return {
        authenticated: record.authenticated,
        csrfToken: record.csrfToken,
        session: record.session === null ? null : parseIdentitySession(record.session),
        user: record.user === null ? null : parseIdentityUser(record.user),
    };
};

/**
 * Valida `/identity/me`.
 *
 * Roles, áreas y permisos tienen que ser listas. Usuario y sesión no admiten
 * null: si faltan, el parser anidado rechaza el perfil.
 */
export const parseIdentityProfile = (value: unknown): IdentityProfile => {
    const record = assertRecord(value, "IdentityProfile");

    if (!Array.isArray(record.roles) || !Array.isArray(record.orgUnits) || !Array.isArray(record.permissions)) {
        throw new TypeError("Respuesta IdentityProfile inválida.");
    }

    return {
        auth: parseAuthSummary(record.auth),
        orgUnits: record.orgUnits.map(parseOrgUnit),
        permissions: record.permissions.map(parseEffectivePermission),
        roles: record.roles.map(parseRole),
        session: parseIdentitySession(record.session),
        user: parseIdentityUser(record.user),
    };
};

/**
 * Valida la URL que el BFF devuelve para iniciar Microsoft.
 *
 * Solo exige que sea string. El navegador navega a ella; este módulo no la abre.
 */
export const parseMicrosoftStartResponse = (value: unknown): MicrosoftStartResponse => {
    const record = assertRecord(value, "MicrosoftStartResponse");

    if (!isString(record.authorizationUrl)) {
        throw new TypeError("Respuesta MicrosoftStartResponse inválida.");
    }

    return {
        authorizationUrl: record.authorizationUrl,
    };
};
