import { canUseBanks } from "../../modules/crm/banks/banks.permissions.js";
import { calendarRouteAccess } from "../../modules/crm/calendar/calendar-access.js";
import { type CatalogPermissionAction, findCatalogDefinition, getCatalogPermissionCode, isCatalogContextModuleCode } from "../../modules/crm/catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../../modules/crm/identity/identity.types.js";
import { canUseCollaboration, canUseNotes } from "../../modules/crm/notes/notes.permissions.js";
import type { CookieRequest } from "./cookie-request.type.js";
import type { PermissionRequirement } from "./require-permission.decorator.js";

/**
 * Permiso de ruta, resuelto antes de los pipes y del handler.
 *
 * Falla cerrado. Sin descriptor, con un kind no contemplado o con un codigo que
 * no esta efectivamente permitido, el resultado es denegar. El permiso efectivo
 * exige un allow y que no exista un deny del mismo codigo.
 *
 * El cuerpo y el query se leen solo en propiedades propias. Un campo colgado
 * del prototipo no elige el modulo ni el estado. Esta capa no autoriza la fila,
 * el recurso ni la transaccion: eso sigue en el servicio.
 */

/** Propiedad propia del valor recibido. No recorre la cadena del prototipo. */
const field = (input: unknown, key: string): unknown => (typeof input === "object" && input !== null && Object.hasOwn(input, key) ? Reflect.get(input, key) : undefined);

/** Allow presente y deny ausente. Un deny gana aunque el mismo codigo tambien tenga allow. */
const can = (profile: Pick<IdentityProfile, "permissions">, code: string): boolean => profile.permissions.some((entry) => entry.code === code && entry.effect === "allow") && !profile.permissions.some((entry) => entry.code === code && entry.effect === "deny");

/** Un codigo ausente no autoriza. Sirve para mapeos que pueden no resolver ninguna grant. */
const canSelected = (profile: IdentityProfile, code: string | undefined): boolean => code !== undefined && can(profile, code);

/**
 * El mismo endpoint cambia de privilegio segun el estado pedido. Activar no es
 * desactivar: un cuerpo distinto de esos tres estados no produce codigo y se niega.
 */
function userStatusPermission(body: unknown): string | undefined {
    const status = field(body, "status");
    if (status === "active") return "user.activate";
    if (status === "inactive" || status === "blocked") return "user.deactivate";
    return undefined;
}

/**
 * La accion de ruta `status` no es un permiso. Activo exige actualizar;
 * inactivo exige inactivar. Otro estado, u otra accion fuera de la lista, no mapea.
 */
function catalogAction(action: CatalogPermissionAction | "status", body: unknown): CatalogPermissionAction | undefined {
    if (action !== "status") return ["read", "create", "update", "inactivate"].includes(action) ? action : undefined;
    const status = field(body, "status");
    if (status === "active") return "update";
    if (status === "inactive") return "inactivate";
    return undefined;
}

/** Modulo, catalogo o accion desconocidos no producen un codigo inventado. */
function catalogGrant(moduleCode: unknown, catalog: unknown, action: CatalogPermissionAction | undefined): string | undefined {
    if (typeof moduleCode !== "string" || !isCatalogContextModuleCode(moduleCode) || !action) return undefined;
    const definition = typeof catalog === "string" ? findCatalogDefinition(catalog) : undefined;
    return definition ? getCatalogPermissionCode(moduleCode, definition, action) : undefined;
}

/**
 * La lectura toma el modulo del query y la escritura del cuerpo, que es donde
 * el cliente declara el contexto. El guard corre antes del pipe, asi que el
 * trim replica el unico recorte de los DTO de catalogo. El codigo de catalogo
 * sale del descriptor o del parametro de ruta, no de un campo libre del cuerpo.
 */
function catalogPermission(requirement: Extract<PermissionRequirement, { kind: "catalog" }>, request: CookieRequest): string | undefined {
    const source = requirement.action === "read" ? request.query : request.body;
    const rawModule = field(source, "moduleCode");
    // Los DTO de catalogo solo recortan. Expedientes, mas abajo, comparan el valor exacto.
    const moduleCode = typeof rawModule === "string" ? rawModule.trim() : undefined;
    return catalogGrant(moduleCode, requirement.catalog ?? field(request.params, "catalogCode"), catalogAction(requirement.action, request.body));
}

/**
 * Lectura de auditoria. Un deny explicito de `role.assign` gana al allow y
 * tambien al rol Owner activo: el rol no es un atajo por encima del deny.
 */
export function canReadAudit(profile: IdentityProfile): boolean {
    if (profile.permissions.some((entry) => entry.code === "role.assign" && entry.effect === "deny")) return false;
    return can(profile, "role.assign") || profile.roles.some((role) => role.code === "owner" && role.status === "active");
}

/**
 * El perfil ya trae solo permisos de modulos vigentes. Una excepcion personal
 * cuenta sin exigir un rol de nombre fijo.
 */
export const hasFormalizationAccess = (profile: Pick<IdentityProfile, "permissions">): boolean => profile.permissions.some((entry) => entry.code.startsWith("formalizacion.") && can(profile, entry.code));

/** Lectura de ordenes. El codigo es especifico; el deny del mismo codigo la apaga. */
export const canReadFormalizationOrder = (profile: Pick<IdentityProfile, "roles" | "permissions">): boolean => can(profile, "formalizacion.orders.read");

/** Grant historico de etapas. No cubre aprobaciones ni la bandeja de adendos. */
export const FORMALIZATION_STAGE_READ_PERMISSION = "formalizacion.home.stages.read";

/**
 * Membresia heredada de la etapa no salta un deny individual. Cada cola tiene
 * su codigo y `can` sigue exigiendo allow sin deny.
 */
export const FORMALIZATION_READ_PERMISSIONS = {
    approvals: "formalizacion.home.approvals.read",
    contracts: "formalizacion.home.contracts.read",
    bank: "formalizacion.home.banking.read",
    balance: "formalizacion.home.balance.read",
    transfer: "formalizacion.home.transfer_pending.read",
    signed: "formalizacion.home.transfer_signed.read",
    closed: "formalizacion.home.closed.read",
} as const;

/**
 * Acceso de lectura por cola.
 *
 * El fallback historico de etapas solo aparece si el perfil no tiene ninguna
 * entrada, allow o deny, en las colas granulares distintas de aprobaciones, y
 * ademas tiene el grant de etapas. Aprobaciones nunca heredan ese fallback.
 * Adendos exigen lectura de orden y su permiso propio; el fallback no los concede.
 */
export function formalizationReadAccess(profile: Pick<IdentityProfile, "roles" | "permissions">) {
    const granular = Object.values(FORMALIZATION_READ_PERMISSIONS).filter((code) => code !== FORMALIZATION_READ_PERMISSIONS.approvals);
    const fallback = !profile.permissions.some((entry) => granular.includes(entry.code as never)) && can(profile, FORMALIZATION_STAGE_READ_PERMISSION);
    const allowed = (code: string) => can(profile, code) || (code !== FORMALIZATION_READ_PERMISSIONS.approvals && fallback);
    const stages = Object.fromEntries(Object.entries(FORMALIZATION_READ_PERMISSIONS).map(([queue, code]) => [queue, allowed(code)])) as Record<keyof typeof FORMALIZATION_READ_PERMISSIONS, boolean>;
    // La bandeja de adendos tiene permiso propio: el fallback historico de etapas no la concede.
    return { ...stages, addendum: canReadFormalizationOrder(profile) && can(profile, "formalizacion.orders.addendum.read") };
}

/**
 * `all` es la union de las colas concedidas, adendos incluidos. `send` y
 * `signature` son el mismo acceso que contratos: dos nombres de cliente, un permiso.
 */
export function canReadFormalizationQueue(profile: Pick<IdentityProfile, "roles" | "permissions">, queue: string): boolean {
    const access = formalizationReadAccess(profile);
    if (queue === "all") return Object.values(access).some(Boolean);
    return Object.entries(access).some(([key, allowed]) => key === (["send", "signature"].includes(queue) ? "contracts" : queue) && allowed);
}
export const canReadFormalizationStages = (profile: Pick<IdentityProfile, "roles" | "permissions">): boolean => canReadFormalizationQueue(profile, "all");

/**
 * Forma historica del decorador. El codigo de rol declarado no autoriza por si
 * solo: sin una lista explicita y no vacia de permisos, el requisito se niega.
 * No se agrega un rol oculto para compensar.
 */
function hasActiveRoleRequirement(profile: IdentityProfile, requirement: Extract<PermissionRequirement, { kind: "active-role" }>): boolean {
    return requirement.permissionCodes !== undefined && requirement.permissionCodes.length > 0 && hasAllPermissions(profile, requirement.permissionCodes);
}

/**
 * Punto de entrada del guard. Sin requisito, deniega. Formalizacion y calendario
 * salen por su politica; el resto entra al mapeo cerrado, cuyo default tambien deniega.
 */
export function hasRoutePermission(profile: IdentityProfile, requirement: PermissionRequirement | undefined, request: CookieRequest): boolean {
    if (!requirement) return false;
    if (requirement.kind === "formalization-order-read") return canReadFormalizationOrder(profile);
    if (requirement.kind === "formalization-read") return canReadFormalizationStages(profile);
    if (requirement.kind === "calendar") return calendarRouteAccess(profile, requirement.action);
    return hasDeclaredRoutePermission(profile, requirement, request);
}

/**
 * Notas exigen lectura y la accion pedida sobre el modulo. La lectura cruzada
 * es opt-in y solo para un modulo de catalogo conocido, por colaboracion; no
 * abre el resto de las acciones.
 */
function notesRoutePermission(profile: IdentityProfile, requirement: Extract<PermissionRequirement, { kind: "notes" }>, request: CookieRequest): boolean {
    const source = requirement.source ?? (requirement.action === "read" ? "query" : "body");
    const moduleCode = field(request[source], "moduleCode");
    if (requirement.action === "read" && requirement.allowCrossModuleRead === true && typeof moduleCode === "string" && isCatalogContextModuleCode(moduleCode)) return canUseCollaboration(profile, moduleCode, "read", true);
    return canUseNotes(profile, moduleCode, "read") && canUseNotes(profile, moduleCode, requirement.action);
}

/**
 * Bancos no usan el codigo generico de catalogo. Exigen modulo y accion por su
 * propia politica, que ya incluye las excepciones personales del perfil.
 */
function catalogRoutePermission(profile: IdentityProfile, requirement: Extract<PermissionRequirement, { kind: "catalog" }>, request: CookieRequest): boolean {
    const catalog = requirement.catalog ?? field(request.params, "catalogCode");
    if (catalog !== "banks") return canSelected(profile, catalogPermission(requirement, request));
    const source = requirement.action === "read" ? request.query : request.body;
    const moduleCode = field(source, "moduleCode");
    const action = catalogAction(requirement.action, request.body);
    return action !== undefined && canUseBanks(profile, typeof moduleCode === "string" ? moduleCode.trim() : moduleCode, action);
}

/**
 * Mapeo cerrado. Expedientes comparan `moduleCode` tal como llega, sin trim:
 * a diferencia del catalogo, no hay un DTO que recorte ese valor antes de autorizar.
 */
function hasDeclaredRoutePermission(profile: IdentityProfile, requirement: PermissionRequirement, request: CookieRequest): boolean {
    switch (requirement.kind) {
        case "active-role":
            return hasActiveRoleRequirement(profile, requirement);
        case "all":
            return hasAllPermissions(profile, requirement.codes);
        case "notes":
            return notesRoutePermission(profile, requirement, request);
        case "audit":
            return canReadAudit(profile);
        case "user-status":
            return canSelected(profile, userStatusPermission(request.body));
        case "unit-files":
            return canSelected(profile, catalogGrant(field(request.query, "moduleCode"), "files", "read"));
        case "catalog":
            return catalogRoutePermission(profile, requirement, request);
        default:
            return false;
    }
}

/**
 * Lista no vacia y todos los codigos bien formados y permitidos. Un arreglo
 * vacio no puede colarse por un `every` que seria verdadero.
 */
function hasAllPermissions(profile: IdentityProfile, codes: readonly string[]): boolean {
    return Array.isArray(codes) && codes.length > 0 && codes.every((code) => typeof code === "string" && code.length > 0 && can(profile, code));
}
