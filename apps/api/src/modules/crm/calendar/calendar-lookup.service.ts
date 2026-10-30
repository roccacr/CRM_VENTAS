import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type RawBuilder, sql, type Transaction } from "kysely";
import { z } from "zod";

import { canReadFormalizationOrder } from "../../../common/security/route-permission.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { includeDescendants } from "../marketing/marketing-home.repository.js";
import { canUseCollaboration } from "../notes/notes.permissions.js";
import { CALENDAR_MODULES, type CalendarLink, calendarLink, type CalendarParticipant, calendarParticipant, type CalendarSelectionOption, type CalendarSelectionOptions } from "./calendar.contract.js";
import { CalendarRepository } from "./calendar.repository.js";
import { calendarAccess, calendarRouteAccess } from "./calendar-access.js";

export type CalendarLookupKind = "users" | "notes" | "leads" | "orders";
export type CalendarLookupItem = CalendarSelectionOption;
type Tx = Transaction<CrmDatabase>;
type Selection = { search: string; limit: number; id?: string; ids?: readonly string[] };
const querySchema = z.strictObject({ moduleCode: z.enum(CALENDAR_MODULES), kind: z.enum(["users", "notes", "leads", "orders"]), search: z.string().trim().max(100).default(""), limit: z.number().int().min(1).max(100).default(20) });
const nativeId = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const legacyId = /^[1-9][0-9]{0,14}$/;
const knownScopes = ["self", "assigned", "own_area", "own_area_and_children", "all_areas"];
const activeOrder = sql`o.status_sales_order='active' AND o.cancelled_sales_order='no' AND o.deleted_at_sales_order IS NULL`;
const activeLegacyOrder = sql`o.status_ov=1 AND o.caida_ov=0`;
const orderReferences = sql`crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference AND s.status_external_system='active'`;
const activeOrderReference = sql`x.sales_order_id_sales_order_external_reference=o.id_sales_order AND x.status_sales_order_external_reference='active'`;
const orderNumber = sql<string>`COALESCE((SELECT MIN(x.transaction_number_sales_order_external_reference) FROM ${orderReferences} WHERE ${activeOrderReference} AND x.transaction_number_sales_order_external_reference IS NOT NULL),o.native_code_sales_order)`;
function validIdentity(link: CalendarLink): boolean {
    return (link.source === "native" ? nativeId : legacyId).test(link.id) && (link.entityType !== "note" || link.source === "native");
}
/** Whitelist the response even when a query gains internal columns later. */
function item(row: CalendarLookupItem): CalendarLookupItem {
    return { id: row.id, source: row.source, label: row.label, ...(row.secondary ? { secondary: row.secondary } : {}) };
}
/** Bounded, source-qualified selections. Calendar permission never substitutes for resource authorization. */
@Injectable()
export class CalendarLookupService {
    /** Reuses the native read-only snapshot and existing organizational seller policy. */
    constructor(
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(CalendarRepository) private readonly snapshot: CalendarRepository,
    ) {}

    /** The parent supplies a fresh server profile; no client access/type metadata authorizes a lookup. */
    async lookup(profile: IdentityProfile, input: unknown): Promise<{ items: CalendarLookupItem[] }> {
        const parsed = querySchema.safeParse(input);
        if (!parsed.success) throw new BadRequestException("Selección de calendario inválida.");
        const query = parsed.data;
        if (!calendarAccess(profile, query.moduleCode, "read").allowed) throw new ForbiddenException("Calendario no autorizado.");
        if ((query.kind === "leads" || query.kind === "orders") && query.search.length < 2) return { items: [] };
        const items = await this.snapshot.read((tx) => this.select(tx, profile, query.kind, query));
        return { items: items.map(item) };
    }

    /**
     * Rechecks exact identities on the save transaction and returns identities only.
     * The parent must additionally check calendar.read for the event's actual module before invoking its save callback.
     * Retired legacy aliases are rejected, preserving command identities and hashes.
     */
    async validateLinks(tx: Tx, profile: IdentityProfile, links: readonly CalendarLink[]): Promise<CalendarLink[]> {
        if (!calendarRouteAccess(profile, "read")) throw new ForbiddenException("Calendario no autorizado.");
        const parsed = z.array(calendarLink).max(100).safeParse(links);
        if (!parsed.success) throw new BadRequestException("Vínculos de calendario inválidos.");
        for (const link of parsed.data) await this.linkSelection(tx, profile, link);
        return parsed.data;
    }

    /** Presentation hides unavailable relations; infrastructure errors must still fail the read. */
    async canManageLinks(tx: Tx, profile: IdentityProfile, links: readonly CalendarLink[]): Promise<boolean> {
        try {
            await this.validateLinks(tx, profile, links);
            return true;
        } catch (error) {
            if (error instanceof HttpException && [400, 403, 404].includes(error.getStatus())) return false;
            throw error;
        }
    }

    /**
     * Hydrates persisted selections only after the parent checks event editability and its calendar module.
     * Restricted relations expose only exact participant descriptors, never partial linked-resource labels.
     */
    async selectionOptions(tx: Tx, profile: IdentityProfile, input: { links: readonly CalendarLink[]; participants: readonly CalendarParticipant[] }): Promise<CalendarSelectionOptions> {
        if (!calendarRouteAccess(profile, "read")) throw new ForbiddenException("Calendario no autorizado.");
        const parsed = z.strictObject({ links: z.array(calendarLink).max(100), participants: z.array(calendarParticipant).max(100) }).safeParse(input);
        if (!parsed.success) throw new BadRequestException("Selecciones de calendario inválidas.");
        const ids = [...new Set(parsed.data.participants.flatMap((participant) => (participant.userId ? [participant.userId] : [])))];
        const users = ids.length ? (await this.users(tx, { ids, search: "", limit: 100 })).map(item) : [];
        const linked = await this.linkedOptions(tx, profile, parsed.data.links);
        return { ...(users.length ? { users } : {}), ...linked };
    }

    private async linkedOptions(tx: Tx, profile: IdentityProfile, links: readonly CalendarLink[]): Promise<CalendarSelectionOptions> {
        const options: CalendarSelectionOptions = {};
        try {
            for (const link of links) {
                const { kind, option } = await this.linkSelection(tx, profile, link);
                const list = options[kind] ?? [];
                if (!list.some((existing) => existing.source === option.source && existing.id === option.id)) list.push(option);
                options[kind] = list;
            }
            return options;
        } catch (error) {
            if (error instanceof HttpException && [400, 403, 404].includes(error.getStatus())) return {};
            throw error;
        }
    }

    private async linkSelection(tx: Tx, profile: IdentityProfile, link: CalendarLink): Promise<{ kind: Exclude<CalendarLookupKind, "users">; option: CalendarLookupItem }> {
        if (!validIdentity(link)) throw new BadRequestException("Identidad de vínculo inválida.");
        await this.assertUnmapped(tx, link);
        const kind = { note: "notes", lead: "leads", sales_order: "orders" }[link.entityType] as Exclude<CalendarLookupKind, "users">;
        const rows = await this.selectSource(tx, profile, kind, { source: link.source, id: link.id, search: "", limit: 2 });
        const row = rows[0];
        if (rows.length !== 1 || row?.id !== link.id) throw new NotFoundException("Vínculo no disponible.");
        return { kind, option: item(row) };
    }

    private async select(tx: Tx, profile: IdentityProfile, kind: CalendarLookupKind, query: Selection): Promise<CalendarLookupItem[]> {
        const native = await this.selectSource(tx, profile, kind, { ...query, source: "native" });
        if (kind === "users" || kind === "notes" || native.length >= query.limit || !this.legacyEnabled()) return native.slice(0, query.limit);
        const legacy = await this.selectSource(tx, profile, kind, { ...query, source: "legacy", limit: query.limit - native.length });
        return [...native, ...legacy].slice(0, query.limit);
    }
    private selectSource(tx: Tx, profile: IdentityProfile, kind: CalendarLookupKind, query: Selection & { source: "native" | "legacy" }): Promise<CalendarLookupItem[]> {
        const { source } = query;
        if (source === "legacy" && !this.legacyEnabled()) throw new NotFoundException("Origen no disponible.");
        switch (kind) {
            case "users":
                return this.users(tx, query);
            case "notes":
                return this.notes(tx, profile, query);
            case "leads":
                return this.leads(tx, profile, source, query);
            case "orders":
                return this.orders(tx, profile, source, query);
        }
    }
    private legacyEnabled(): boolean {
        return this.config.get<unknown>("ENABLE_LEGACY_FALLBACK") === true;
    }
    private async users(tx: Tx, query: Selection): Promise<CalendarLookupItem[]> {
        // This is the calendar invitation directory, including dormant accounts, as in note invitations.
        if (query.ids?.length === 0) return [];
        let identity = sql`(${query.search}='' OR LOCATE(${query.search},display_name_user)>0 OR LOCATE(${query.search},normalized_email_user)>0)`;
        if (query.id) identity = sql`public_id_user=${query.id}`;
        if (query.ids) identity = sql`public_id_user IN (${sql.join(query.ids)})`;
        return (await sql<CalendarLookupItem>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ public_id_user AS id,'native' AS source,display_name_user AS label,normalized_email_user AS secondary FROM sec_user WHERE status_user IN ('active','inactive','pending') AND deleted_at_user IS NULL AND ${identity} ORDER BY display_name_user,public_id_user LIMIT ${query.limit}`.execute(tx)).rows;
    }
    private async notes(tx: Tx, profile: IdentityProfile, query: Selection): Promise<CalendarLookupItem[]> {
        const modules = [...CALENDAR_MODULES, "administration" as const].filter((module) => canUseCollaboration(profile, module, "read", true));
        if (!modules.length) throw new ForbiddenException("Notas no autorizadas.");
        const identity = query.id ? sql`n.public_id_note=${query.id}` : sql`(${query.search}='' OR LOCATE(${query.search},n.title_note)>0)`;
        return (
            await sql<CalendarLookupItem>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ n.public_id_note AS id,'native' AS source,COALESCE(NULLIF(n.title_note,''),'Nota pendiente') AS label
            FROM crm_note n JOIN sec_user actor ON actor.public_id_user=${profile.user.publicId} AND actor.status_user='active' AND actor.deleted_at_user IS NULL
            WHERE ${identity} AND n.status_note='open' AND n.origin_module_code_note IN (${sql.join(modules)})
            AND (n.author_user_id_note=actor.id_user OR EXISTS(SELECT 1 FROM crm_note_task t WHERE t.note_id_note_task=n.id_note AND t.assignee_user_id_note_task=actor.id_user))
            AND (n.author_user_id_note=actor.id_user OR (n.visibility_note='shared' AND EXISTS(SELECT 1 FROM crm_note_participant p WHERE p.note_id_note_participant=n.id_note AND p.user_id_note_participant=actor.id_user AND p.status_note_participant='active' AND p.revoked_at_note_participant IS NULL)))
            ORDER BY n.updated_at_note DESC,n.id_note DESC LIMIT ${query.limit}`.execute(tx)
        ).rows;
    }
    private async leadScope(tx: Tx, profile: IdentityProfile): Promise<RawBuilder<unknown> | undefined> {
        // Standalone leads follow the existing lead/Captacion resource grants. Formalizacion is handled separately below.
        const code = profile.permissions.some((p) => p.code === "lead.read") ? "lead.read" : "mercadeo.leads.read";
        const entries = profile.permissions.filter((p) => p.code === code);
        const scopes = entries.flatMap((p) => (p.effect === "allow" ? [p.scope] : []));
        if (!scopes.length || entries.some((p) => p.effect === "deny") || scopes.some((scope) => !knownScopes.includes(scope))) {
            if (canReadFormalizationOrder(profile)) return undefined;
            throw new ForbiddenException("Leads no autorizados.");
        }
        if (scopes.includes("all_areas")) return sql`TRUE`;
        const sellers = await this.visibleSellers(tx, profile, scopes);
        return sellers.size ? sql`u.public_id_user IN (${sql.join([...sellers])})` : sql`FALSE`;
    }
    /** Matches the established seller scope, reusing the existing cycle-safe descendant expansion. */
    private async visibleSellers(tx: Tx, profile: IdentityProfile, scopes: readonly string[]): Promise<ReadonlySet<string>> {
        const visible = new Set([profile.user.publicId]);
        if (!scopes.some((scope) => scope === "own_area" || scope === "own_area_and_children")) return visible;
        const units = await tx.selectFrom("sec_org_unit").select(["id_org_unit", "public_id_org_unit", "parent_org_unit_id_org_unit"]).where("status_org_unit", "=", "active").where("deleted_at_org_unit", "is", null).limit(1001).execute();
        if (units.length > 1000) throw new ForbiddenException("Alcance organizacional demasiado amplio.");
        const assigned = new Set(profile.orgUnits.filter((unit) => unit.status === "active").map((unit) => unit.publicId));
        const permitted = new Set(units.filter((unit) => assigned.has(unit.public_id_org_unit)).map((unit) => unit.id_org_unit));
        if (scopes.includes("own_area_and_children")) includeDescendants(units, permitted);
        if (!permitted.size) return visible;
        const members = await tx
            .selectFrom("sec_user_org_unit as m")
            .innerJoin("sec_user as u", "u.id_user", "m.user_id_user_org_unit")
            .select("u.public_id_user")
            .where("m.status_user_org_unit", "=", "active")
            .where("m.revoked_at_user_org_unit", "is", null)
            .where("m.org_unit_id_user_org_unit", "in", [...permitted])
            .limit(10001)
            .execute();
        if (members.length > 10000) throw new ForbiddenException("Alcance organizacional demasiado amplio.");
        for (const member of members) visible.add(member.public_id_user);
        return visible;
    }
    private async leads(tx: Tx, profile: IdentityProfile, source: "native" | "legacy", query: Selection): Promise<CalendarLookupItem[]> {
        const scope = await this.leadScope(tx, profile);
        if (source === "native") {
            const identity = query.id ? sql`l.public_id_lead=${query.id}` : sql`(LOCATE(${query.search},c.full_name_contact)>0 OR LOCATE(${query.search},c.email_contact)>0)`;
            const access = scope ?? sql`EXISTS(SELECT 1 FROM crm_sales_order o WHERE o.lead_id_sales_order=l.id_lead AND ${activeOrder})`;
            return (
                await sql<CalendarLookupItem>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ l.public_id_lead AS id,'native' AS source,c.full_name_contact AS label,c.email_contact AS secondary
                FROM crm_lead l JOIN crm_contact c ON c.id_contact=l.primary_contact_id_lead AND c.deleted_at_contact IS NULL LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead
                WHERE ${identity} AND l.deleted_at_lead IS NULL AND l.status_lead='active' AND ${access} ORDER BY c.full_name_contact,l.public_id_lead LIMIT ${query.limit}`.execute(tx)
            ).rows;
        }
        const identity = query.id ? sql`CAST(l.id_lead AS CHAR)=${query.id}` : sql`(LOCATE(${query.search},l.nombre_lead)>0 OR LOCATE(${query.search},l.email_lead)>0)`;
        const access =
            scope ??
            sql`NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=l.idinterno_lead AND sibling.id_lead<>l.id_lead)
            AND EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.ordenventa")} o WHERE o.id_ov_lead=l.idinterno_lead AND ${activeLegacyOrder}
                AND NOT EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)
                AND NOT EXISTS(SELECT 1 FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_sales_order_external_reference='active' AND x.external_id_sales_order_external_reference=CAST(o.id_ov AS CHAR)))`;
        return (
            await sql<CalendarLookupItem>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ CAST(l.id_lead AS CHAR) AS id,'legacy' AS source,l.nombre_lead AS label,l.email_lead AS secondary
            FROM ${sql.table("crmdatabase-api.leads")} l ${this.legacyOwner()}
            WHERE ${identity} AND ${access} AND NOT EXISTS(SELECT 1 FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference WHERE s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_lead_external_reference='active' AND x.external_id_lead_external_reference=CAST(l.id_lead AS CHAR))
            ORDER BY l.nombre_lead,l.id_lead LIMIT ${query.limit}`.execute(tx)
        ).rows;
    }
    /** Same ambiguity guards as the existing legacy order reader; unresolved owners never gain seller access. */
    private legacyOwner(): RawBuilder<unknown> {
        return sql`LEFT JOIN ${sql.table("crmdatabase-api.admins")} a ON a.idnetsuite_admin=l.id_empleado_lead
            AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.admins")} sibling WHERE sibling.idnetsuite_admin=a.idnetsuite_admin AND sibling.id_admin<>a.id_admin)
            LEFT JOIN sec_user u ON u.normalized_email_user COLLATE utf8mb4_bin=NULLIF(LOWER(TRIM(a.email_admin)),'') COLLATE utf8mb4_bin AND u.deleted_at_user IS NULL
            AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.admins")} sibling WHERE NULLIF(LOWER(TRIM(sibling.email_admin)),'') COLLATE utf8mb4_bin=NULLIF(LOWER(TRIM(a.email_admin)),'') COLLATE utf8mb4_bin AND sibling.id_admin<>a.id_admin)`;
    }
    private async orders(tx: Tx, profile: IdentityProfile, source: "native" | "legacy", query: Selection): Promise<CalendarLookupItem[]> {
        // The implemented detail policy covers all sellers for the two operational Formalizacion roles.
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("Órdenes no autorizadas.");
        if (source === "native") {
            const identity = query.id ? sql`o.public_id_sales_order=${query.id}` : sql`(LOCATE(${query.search},o.native_code_sales_order)>0 OR EXISTS(SELECT 1 FROM ${orderReferences} WHERE ${activeOrderReference} AND LOCATE(${query.search},x.transaction_number_sales_order_external_reference)>0))`;
            return (
                await sql<CalendarLookupItem>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ o.public_id_sales_order AS id,'native' AS source,${orderNumber} AS label,
                (SELECT NULLIF(CONCAT_WS(' · ',NULLIF(c.full_name_contact,''),NULLIF(p.name_project,'')),'') FROM crm_lead l LEFT JOIN crm_contact c ON c.id_contact=l.primary_contact_id_lead AND c.deleted_at_contact IS NULL LEFT JOIN crm_project p ON p.id_project=l.project_id_lead WHERE l.id_lead=o.lead_id_sales_order AND l.deleted_at_lead IS NULL) AS secondary
                FROM crm_sales_order o WHERE ${identity} AND ${activeOrder} ORDER BY o.native_code_sales_order,o.public_id_sales_order LIMIT ${query.limit}`.execute(tx)
            ).rows;
        }
        const identity = query.id ? sql`CAST(o.id_ov AS CHAR)=${query.id}` : sql`LOCATE(${query.search},o.id_ov_tranid)>0`;
        return (
            await sql<CalendarLookupItem>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ CAST(o.id_ov AS CHAR) AS id,'legacy' AS source,o.id_ov_tranid AS label,
                (SELECT CASE WHEN COUNT(*)=1 THEN MAX(NULLIF(CONCAT_WS(' · ',NULLIF(l.nombre_lead,''),NULLIF(l.proyecto_lead,'')),'')) ELSE NULL END FROM ${sql.table("crmdatabase-api.leads")} l WHERE l.idinterno_lead=o.id_ov_lead) AS secondary FROM ${sql.table("crmdatabase-api.ordenventa")} o
            WHERE ${identity} AND ${activeLegacyOrder} AND NOT EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)
            AND NOT EXISTS(SELECT 1 FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_sales_order_external_reference='active' AND x.external_id_sales_order_external_reference=CAST(o.id_ov AS CHAR))
            ORDER BY o.id_ov_tranid,o.id_ov LIMIT ${query.limit}`.execute(tx)
        ).rows;
    }
    private async assertUnmapped(tx: Tx, link: CalendarLink): Promise<void> {
        if (link.source !== "legacy") return;
        // These native mappings remain authoritative even when the optional legacy source is disabled.
        let rows: { id: string }[];
        if (link.entityType === "sales_order") rows = (await sql<{ id: string }>`SELECT DISTINCT o.public_id_sales_order AS id FROM crm_sales_order o WHERE o.id_old_produccion_sales_order=${link.id} OR EXISTS(SELECT 1 FROM ${orderReferences} WHERE ${activeOrderReference} AND s.code_external_system='legacy_crm' AND x.external_id_sales_order_external_reference=${link.id}) LIMIT 2`.execute(tx)).rows;
        else rows = (await sql<{ id: string }>`SELECT DISTINCT l.public_id_lead AS id FROM crm_lead l JOIN crm_lead_external_reference x ON x.lead_id_lead_external_reference=l.id_lead JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference WHERE s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_lead_external_reference='active' AND x.external_id_lead_external_reference=${link.id} LIMIT 2`.execute(tx)).rows;
        if (rows.length) throw new NotFoundException("Seleccione el vínculo nativo disponible.");
    }
}
