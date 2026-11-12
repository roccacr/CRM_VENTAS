import { createHash } from "node:crypto";

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import { RecordAuditService } from "../../audit/record-audit.service.js";
import { outsideFiniquito } from "./finiquito-exclusion.query.js";
import { type AddendumChange, type AddendumIdentity, type AddendumManualMark, type AddendumOrder, type AddendumStatus, type FutureAddendum, SALES_ORDER_ADDENDUM_LEGACY, type SalesOrderAddendumLegacy } from "./sales-order-addendum.port.js";

const snapshot = (order: AddendumOrder) => ({ addendumStatus: order.status, addendumVersion: order.version, addendumChangedAt: order.changedAt, addendumNote: order.note });
const sourceOf = (order: AddendumOrder) => ({ schema: order.source === "native" ? ("CRM_THINK_V2" as const) : ("crmdatabase-api" as const), table: order.source === "native" ? "crm_sales_order" : "ordenventa", entity: "sales_order", id: order.internalId });

/** La orden, el evento y sus bitácoras participan en una sola transacción InnoDB. */
@Injectable()
export class SalesOrderAddendumRepository {
    /**
     *
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
        @Inject(SALES_ORDER_ADDENDUM_LEGACY) private readonly legacy: SalesOrderAddendumLegacy,
    ) {}

    /**
     *
     */
    read(identity: AddendumIdentity) {
        return this.database.db
            .transaction()
            .setAccessMode("read only")
            .execute((tx) => this.resolve(tx, identity, false, true));
    }

    /** Conteo independiente de etapas/aprobaciones, en la misma instantánea para ambas fuentes. */
    summary() {
        return this.database.db
            .transaction()
            .setIsolationLevel("repeatable read")
            .setAccessMode("read only")
            .execute(async (tx) => {
                const row = (await sql<{ total: string | number }>`SELECT COUNT(*) AS total FROM crm_sales_order o WHERE status_sales_order='active' AND cancelled_sales_order='no' AND deleted_at_sales_order IS NULL AND addendum_status_sales_order='pending' AND ${outsideFiniquito("native", sql`o.id_sales_order`)}`.execute(tx)).rows[0];
                const total = Number(row?.total) + (await this.legacy.countPending(tx));
                if (!Number.isSafeInteger(total) || total < 0) throw new ServiceUnavailableException("No fue posible contar los adéndums pendientes.");
                return { total };
            });
    }

    /**
     *
     */
    async future(identity: AddendumIdentity, access: { actorPublicId: string; broad: boolean; excludeEventId?: string }) {
        return this.database.db
            .transaction()
            .setAccessMode("read only")
            .execute(async (tx) => {
                const order = await this.resolve(tx, identity, false);
                const existing = await this.futureEvent(tx, order, access, false);
                return { schemaVersion: 1 as const, source: order.source, id: order.id, blocked: Boolean(existing), existing: this.visibleFuture(existing, access) };
            });
    }

    /** Solo un evento nuevo o convertido refresca la marca; la edición normal conserva versión y motivo. */
    async prepareEvent(tx: Transaction<CrmDatabase>, command: { order: AddendumIdentity; lead: AddendumIdentity; actorPublicId: string; operationId: string; markPending: boolean; reason?: string | null | undefined; broad: boolean; revealExisting?: boolean; excludeEventId?: string }): Promise<void> {
        this.assertAudit();
        await this.actor(tx, command.actorPublicId);
        const order = await this.resolve(tx, command.order, true);
        if (!order.lead || order.lead.source !== command.lead.source || order.lead.id !== command.lead.id) throw new ConflictException("El cliente de la orden cambió o no es inequívoco; vuelve a seleccionar la orden.");
        // Lectura actual bajo el bloqueo de la orden: dos creaciones concurrentes no comparten una instantánea obsoleta.
        const existing = await this.futureEvent(tx, order, command, true);
        if (existing) throw new ConflictException({ code: "EXISTING_FUTURE_ADDENDUM", message: "Ya existe un Adéndum futuro para esta orden.", existing: command.revealExisting === false ? null : this.visibleFuture(existing, command) });
        if (!command.markPending) return;
        const reason = this.requiredReason(command.reason);
        const operation = this.operation("event", command.actorPublicId, command.operationId);
        if (await this.replay(tx, order, operation)) return;
        await this.persist(tx, order, { status: "pending", note: reason, actorPublicId: command.actorPublicId, operation, correlationId: command.operationId, reason: "Nuevo evento de Adéndum vinculado a la orden." });
    }

    private visibleFuture(event: FutureAddendum | undefined, access: { actorPublicId: string; broad: boolean }) {
        return event && (access.broad || event.ownerPublicId === access.actorPublicId || event.invited === 1) ? { id: event.id, start: event.start } : null;
    }

    private async futureEvent(tx: Transaction<CrmDatabase>, order: AddendumOrder, access: { actorPublicId: string; excludeEventId?: string }, lock: boolean): Promise<FutureAddendum | undefined> {
        const identity =
            order.source === "legacy"
                ? sql`l.source_calendar_event_link='legacy' AND l.entity_public_id_calendar_event_link=${order.id}`
                : sql`((l.source_calendar_event_link='native' AND l.entity_public_id_calendar_event_link=${order.id}) OR (l.source_calendar_event_link='legacy' AND EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_sales_order=${Number(order.internalId)} AND (CAST(n.id_old_produccion_sales_order AS CHAR)=l.entity_public_id_calendar_event_link OR EXISTS(SELECT 1 FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE x.sales_order_id_sales_order_external_reference=n.id_sales_order AND x.external_id_sales_order_external_reference=l.entity_public_id_calendar_event_link AND s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_sales_order_external_reference='active')))))`;
        const excluded = access.excludeEventId ? sql`AND e.public_id_calendar_event<>${access.excludeEventId}` : sql``;
        const ending = lock ? sql`FOR UPDATE` : sql``;
        return (
            await sql<FutureAddendum>`SELECT e.public_id_calendar_event AS id,DATE_FORMAT(e.starts_at_calendar_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS start,(SELECT public_id_user FROM sec_user WHERE id_user=e.organizer_user_id_calendar_event) AS ownerPublicId,EXISTS(SELECT 1 FROM crm_calendar_participant p JOIN sec_user u ON u.id_user=p.user_id_calendar_participant WHERE p.event_id_calendar_participant=e.id_calendar_event AND p.status_calendar_participant='active' AND p.revoked_at_calendar_participant IS NULL AND u.public_id_user=${access.actorPublicId}) AS invited FROM crm_calendar_event e JOIN crm_calendar_event_link l ON l.event_id_calendar_event_link=e.id_calendar_event AND l.deleted_at_calendar_event_link IS NULL AND l.entity_type_calendar_event_link='sales_order' WHERE ${identity} AND e.deleted_at_calendar_event IS NULL AND e.status_calendar_event='scheduled' AND e.starts_at_calendar_event>UTC_TIMESTAMP(3) AND EXISTS(SELECT 1 FROM conf_calendar_event_type t JOIN sec_org_unit o ON o.id_org_unit=e.origin_module_id_calendar_event WHERE t.id_calendar_event_type=e.type_id_calendar_event AND t.module_id_calendar_event_type=o.id_org_unit AND t.code_calendar_event_type='adendum' AND o.code_org_unit='formalizacion' AND o.status_org_unit='active' AND o.deleted_at_org_unit IS NULL) ${excluded} ORDER BY e.starts_at_calendar_event,e.id_calendar_event LIMIT 1 ${ending}`.execute(
                tx,
            )
        ).rows[0];
    }

    /**
     *
     */
    change(command: AddendumChange) {
        return this.transition(command);
    }

    /** Marca pendiente sin crear eventos ni consultar el calendario. */
    async markManually(command: AddendumManualMark) {
        const note = this.requiredReason(command.note);
        return this.transition({ ...command, note, status: "pending" });
    }

    private async transition(command: AddendumChange | (AddendumManualMark & { status: "pending" })) {
        this.assertAudit();
        const operation = this.operation(command.status === "pending" ? "mark_pending" : "manual", command.actorPublicId, command.operationId);
        return this.database.db.transaction().execute(async (tx) => {
            // Mismo orden de bloqueo que calendario: actor, orden y bitácora.
            await this.actor(tx, command.actorPublicId);
            const order = await this.resolve(tx, command, true);
            const previous = await this.replay(tx, order, operation);
            if (previous) {
                if (previous.addendumStatus !== command.status || previous.addendumVersion !== command.expectedVersion + 1) throw new ConflictException("La operación se reutilizó con datos distintos.");
                if (command.status === "pending" && previous.addendumNote !== command.note) throw new ConflictException("La operación se reutilizó con una nota distinta.");
                return { ...this.result(order), replayed: true };
            }
            if (order.version !== command.expectedVersion) throw new ConflictException("El adéndum cambió; recarga la orden antes de continuar.");
            this.assertTarget(order, command.status);
            const note = command.status === "pending" ? command.note : order.note;
            const reasons = { sent: "Adéndum registrado como enviado desde la orden.", pending: "Adéndum marcado pendiente manualmente desde la orden.", completed: "Adéndum completado desde la orden.", cancelled: "Adéndum cancelado desde la orden." };
            const after = await this.persist(tx, order, { status: command.status, note, actorPublicId: command.actorPublicId, operation, correlationId: command.operationId, reason: reasons[command.status] });
            return { ...this.result(after), replayed: false };
        });
    }

    /**
     *
     */
    result(order: AddendumOrder) {
        return { schemaVersion: 1 as const, source: order.source, id: order.id, status: order.status, version: order.version, changedAt: order.changedAt, note: order.note };
    }

    private requiredReason(value: string | null | undefined): string {
        const reason = value?.trim();
        if (!reason || reason.length < 3 || reason.length > 2000) throw new BadRequestException("El motivo del adéndum debe tener entre 3 y 2000 caracteres.");
        return reason;
    }

    private assertTarget(order: AddendumOrder, status: AddendumStatus): void {
        if (status === "pending") {
            if (order.status === "pending") throw new ConflictException("La orden ya tiene un adéndum pendiente.");
            return;
        }
        if (status === "sent" && order.status !== "pending") throw new ConflictException("Solo se puede enviar un adéndum pendiente.");
        if (status !== "sent" && order.status !== "pending" && order.status !== "sent") throw new ConflictException("Solo se puede completar o cancelar un adéndum pendiente o enviado.");
    }

    private assertAudit(): void {
        if (!this.audit.enabled) throw new ServiceUnavailableException("La gestión de adéndum requiere bitácora habilitada.");
    }

    private operation(origin: string, actor: string, operationId: string): string {
        return `addendum:${createHash("sha256")
            .update(JSON.stringify([origin, actor, operationId]))
            .digest("hex")}`;
    }

    private async actor(tx: Transaction<CrmDatabase>, publicId: string) {
        const actor = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", publicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).forUpdate().executeTakeFirst();
        if (!actor) throw new ForbiddenException("Usuario no disponible.");
        return actor;
    }

    private async native(tx: Transaction<CrmDatabase>, identity: AddendumIdentity, lock: boolean): Promise<AddendumOrder | undefined> {
        const filter =
            identity.source === "native"
                ? sql`o.public_id_sales_order=${identity.id}`
                : sql`(o.id_old_produccion_sales_order=${Number(identity.id)} OR EXISTS(SELECT 1 FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE x.sales_order_id_sales_order_external_reference=o.id_sales_order AND s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_sales_order_external_reference='active' AND x.external_id_sales_order_external_reference=${identity.id}))`;
        const ending = lock ? sql`FOR UPDATE` : sql``;
        const rows = (
            await sql<
                Omit<AddendumOrder, "source" | "lead"> & { leadId: number | null }
            >`SELECT CAST(o.id_sales_order AS CHAR) AS internalId,o.public_id_sales_order AS id,(o.deleted_at_sales_order IS NOT NULL) AS deleted,(o.status_sales_order='active' AND o.cancelled_sales_order='no' AND o.deleted_at_sales_order IS NULL) AS active,o.addendum_status_sales_order AS status,o.addendum_version_sales_order AS version,DATE_FORMAT(o.addendum_changed_at_sales_order,'%Y-%m-%dT%H:%i:%s.%fZ') AS changedAt,o.addendum_note_sales_order AS note,o.lead_id_sales_order AS leadId FROM crm_sales_order o WHERE ${filter} LIMIT 2 ${ending}`.execute(
                tx,
            )
        ).rows;
        if (rows.length > 1) throw new ConflictException("La identidad de la orden es ambigua.");
        const row = rows[0];
        if (!row) return undefined;
        const leads = row.leadId === null ? [] : (await sql<{ id: string }>`SELECT public_id_lead AS id FROM crm_lead WHERE id_lead=${row.leadId} AND deleted_at_lead IS NULL ${ending}`.execute(tx)).rows;
        return { ...row, active: Number(row.active) === 1, deleted: Number(row.deleted) === 1, source: "native", lead: leads.length === 1 && leads[0] ? { source: "native", id: leads[0].id } : null };
    }

    // eslint-disable-next-line complexity -- La autoridad nativa separa las lecturas históricas de las mutaciones exclusivas de activas.
    private async resolve(tx: Transaction<CrmDatabase>, identity: AddendumIdentity, lock: boolean, includeInactive = false): Promise<AddendumOrder> {
        let order = await this.native(tx, identity, false);
        if (order) order = lock ? await this.native(tx, identity, true) : order;
        else if (identity.source === "legacy") {
            const legacy = await this.legacy.read(tx, identity.id, lock);
            // La promoción debe bloquear primero la orden antigua; la relectura actual evita escribir una copia retirada.
            order = lock ? ((await this.native(tx, identity, true)) ?? legacy) : legacy;
        }
        if (!order || order.deleted || (!includeInactive && !order.active)) throw new NotFoundException("Orden disponible no encontrada.");
        return order;
    }

    private async replay(tx: Transaction<CrmDatabase>, order: AddendumOrder, operation: string): Promise<Record<string, unknown> | null> {
        const source = sourceOf(order);
        const row = (await sql<{ after: unknown }>`SELECT e.after_record_event AS \`after\` FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE r.source_schema_record=${source.schema} AND r.source_table_record=${source.table} AND r.source_id_record=${source.id} AND r.entity_type_record='sales_order' AND e.operation_id_record_event=${operation} LIMIT 1 FOR UPDATE`.execute(tx)).rows[0];
        if (!row) return null;
        const value: unknown = typeof row.after === "string" ? JSON.parse(row.after) : row.after;
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConflictException("La evidencia del adéndum no es válida.");
        return value as Record<string, unknown>;
    }

    private async persist(tx: Transaction<CrmDatabase>, order: AddendumOrder, command: { status: AddendumStatus; note: string | null; actorPublicId: string; operation: string; correlationId: string; reason: string }): Promise<AddendumOrder> {
        if (order.version >= 4294967295) throw new ConflictException("El adéndum alcanzó el límite de versión.");
        const actor = await this.actor(tx, command.actorPublicId);
        const captured = await this.audit.captureActor(tx, actor.id_user);
        const next = { status: command.status, version: order.version + 1, changedAt: new Date().toISOString(), note: command.note };
        if (order.source === "native")
            await tx
                .updateTable("crm_sales_order")
                .set({ addendum_status_sales_order: next.status, addendum_version_sales_order: next.version, addendum_changed_at_sales_order: next.changedAt.slice(0, 23).replace("T", " "), addendum_note_sales_order: next.note, updated_by_user_id_sales_order: actor.id_user, updated_at_sales_order: sql`UTC_TIMESTAMP(3)` })
                .where("id_sales_order", "=", Number(order.internalId))
                .execute();
        else await this.legacy.write(tx, order, next);
        const after = { ...order, ...next };
        await this.audit.append(tx, { source: sourceOf(order), actor: captured, action: "state_change", module: "formalizacion", before: snapshot(order), after: snapshot(after), allowedFields: ["addendumStatus", "addendumVersion", "addendumChangedAt", "addendumNote"], operationId: command.operation, correlationId: command.correlationId, reason: command.reason, snapshotScope: "partial" });
        return after;
    }
}
