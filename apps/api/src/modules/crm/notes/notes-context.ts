import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { hasFormalizationAccess } from "../../../common/security/route-permission.js";
import { CATALOG_DEFINITIONS, getCatalogPermissionCode } from "../catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { legacyNoteOrderIdSchema, type NoteContext, noteIdSchema } from "./notes.contract.js";
import type { NoteModule } from "./notes.permissions.js";

const workspaces: Record<NoteModule, string> = { ventas: "sales", mercadeo: "marketing", formalizacion: "formalization", administration: "admin" };
const views: Record<string, { module: NoteModule; permission?: string }> = {
    "lead-profile": { module: "formalizacion", permission: "lead.profile.read" },
    "sales-home": { module: "ventas", permission: "ventas.home.read" },
    "marketing-home": { module: "mercadeo", permission: "mercadeo.home.read" },
    "marketing-leads": { module: "mercadeo", permission: "mercadeo.leads.read" },
    "admin-home": { module: "administration" },
    ...Object.fromEntries(["home", "calendar", "management", "summary", "files", "contracts"].map((suffix) => [`formalization-${suffix}`, { module: "formalizacion" as const }])),
    users: { module: "administration", permission: "user.view_list" },
    "roles-permissions": { module: "administration", permission: "role.assign" },
    "audit-log": { module: "administration", permission: "role.assign" },
};

/** Solo las identidades fijas del menú y los catálogos conocidos del módulo pueden ser un vínculo. Una vista de otro módulo no entra. */
export function noteViewPermissions(module: NoteModule, code: string): string[] | undefined {
    const view = Object.hasOwn(views, code) ? views[code] : undefined;
    if (view) return view.module === module ? (view.permission ? [view.permission] : []) : undefined;
    if (code === "catalogs" && module === "administration") return CATALOG_DEFINITIONS.map((catalog) => getCatalogPermissionCode(module, catalog, "read"));
    const catalog = CATALOG_DEFINITIONS.find((item) => code === `${module === "administration" ? "" : `${workspaces[module]}-`}catalog-${item.routeCode}`);
    return catalog ? [getCatalogPermissionCode(module, catalog, "read")] : undefined;
}

/** Identidad canónica del inicio registrado. No depende del alias con que se guardó. */
export const noteHomeViewCode = (module: NoteModule): string => `${workspaces[module]}-home`;

/** El código explícito del inicio comparte el almacenamiento y el hash del código omitido. */
export function normalizeNoteContext(module: NoteModule, context: NoteContext): NoteContext {
    return context.kind === "view" && context.code === noteHomeViewCode(module) ? { kind: "view" } : context;
}

/** Una URL, un código desconocido o uno de otro módulo se rechazan, también si el vínculo ya estaba guardado. */
export function authorizeNoteView(profile: Pick<IdentityProfile, "roles" | "permissions">, module: NoteModule, code: string): void {
    const permissions = noteViewPermissions(module, code);
    if (!permissions) throw new BadRequestException("Vista de notas no registrada en el modulo.");
    if (module === "formalizacion" && !hasFormalizationAccess(profile)) throw new ForbiddenException("Vista fuera del modulo activo.");
    if (permissions.length && !permissions.some((permission) => profile.permissions.some((p) => p.code === permission && p.effect === "allow") && !profile.permissions.some((p) => p.code === permission && p.effect === "deny"))) throw new ForbiddenException("Permiso de vista insuficiente.");
}

/** La nota personal reutiliza un vínculo de vista. No adjunta un recurso de negocio. */
export const noteViewStorageCode = (module: NoteModule, context: Extract<NoteContext, { kind: "view" | "personal" }>): string => (context.kind === "personal" ? `${module}.personal` : (context.code ?? `${module}.home`));

interface PersistedNoteLink {
    kind: string;
    entity: string;
    viewCode: string | null;
    orderId: string | null;
    externalId: string | null;
    system: string | null;
}

function decodeViewLink(module: NoteModule, code: string | null): NoteContext | undefined {
    if (code === `${module}.home`) return { kind: "view" };
    if (code === `${module}.personal`) return { kind: "personal" };
    return code && noteViewPermissions(module, code) ? { kind: "view", code } : undefined;
}

function decodeOrderLink(row: PersistedNoteLink): NoteContext | undefined {
    if (row.kind === "native") {
        const id = noteIdSchema.safeParse(row.orderId);
        return id.success ? { kind: "sales_order", source: "native", id: id.data } : undefined;
    }
    if (row.kind !== "external" || row.system !== "legacy_crm") return undefined;
    const id = legacyNoteOrderIdSchema.safeParse(row.externalId);
    return id.success ? { kind: "sales_order", source: "legacy", id: id.data } : undefined;
}

/** Reconstruye solo destinos aprobados y calificados por origen. Quien llama también verifica la clave guardada. */
export function decodeNoteLink(module: NoteModule, row: PersistedNoteLink): NoteContext | undefined {
    if (row.kind === "view" && row.entity === "view") return decodeViewLink(module, row.viewCode);
    return row.entity === "sales_order" ? decodeOrderLink(row) : undefined;
}
