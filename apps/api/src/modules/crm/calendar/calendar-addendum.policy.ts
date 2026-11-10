import { ConflictException } from "@nestjs/common";
import { z } from "zod";

import { type CalendarInput, type CalendarLink, calendarLink, type CalendarRow } from "./calendar.contract.js";

const frozenRelations = z.strictObject({ order: calendarLink.refine((link) => link.entityType === "sales_order"), lead: calendarLink.refine((link) => link.entityType === "lead") });
export type CalendarAddendumRelations = z.infer<typeof frozenRelations>;

/** Metadatos exclusivos del servidor: nunca se aceptan dentro del DTO de detalles editable. */
export function readCalendarAddendumLock(details: unknown): CalendarAddendumRelations | null {
    const value: unknown = typeof details === "string" ? JSON.parse(details) : details;
    if (!value || typeof value !== "object" || !("addendumRelations" in value)) return null;
    const parsed = frozenRelations.safeParse(value.addendumRelations);
    if (!parsed.success) throw new ConflictException("La relación histórica del adéndum requiere revisión.");
    return parsed.data;
}

function requiredRelations(links: readonly CalendarLink[]): CalendarAddendumRelations {
    const orders = links.filter((link) => link.entityType === "sales_order");
    const leads = links.filter((link) => link.entityType === "lead");
    if (orders.length !== 1 || leads.length !== 1 || !orders[0] || !leads[0]) throw new ConflictException("Un Adéndum requiere exactamente una orden de venta y su cliente vinculado.");
    return { order: orders[0], lead: leads[0] };
}
const same = (left: CalendarLink, right: CalendarLink) => left.source === right.source && left.id === right.id && left.entityType === right.entityType;

/** El candado guardado, o un adéndum de Formalización, impide mover la orden y el cliente. */
export function calendarOrderLinksLocked(row: CalendarRow): boolean {
    if (readCalendarAddendumLock(row.details)) return true;
    return row.originModule === "formalizacion" && row.typeCode === "adendum";
}

function historicalRelations(before: CalendarRow | null): CalendarAddendumRelations | null {
    if (!before) return null;
    const stored = readCalendarAddendumLock(before.details);
    if (stored) return stored;
    if (calendarOrderLinksLocked(before)) return requiredRelations(before.links ?? []);
    return null;
}

/** Si el cuerpo no trae vínculos, se conservan los de la fila. Omitirlos no los borra. */
export function effectiveCalendarLinks(input: CalendarInput, before: CalendarRow | null): readonly CalendarLink[] {
    if (input.links !== undefined) return input.links;
    return before?.links ?? [];
}

/** El bloqueo sobrevive a cambios de tipo: convertir el evento a Tarea no permite reasignar su historia. */
export function calendarAddendumRelations(input: CalendarInput, before: CalendarRow | null, typeCode: string): CalendarAddendumRelations | null {
    const previous = historicalRelations(before);
    if (!previous && !(input.moduleCode === "formalizacion" && typeCode === "adendum")) return null;
    const selected = requiredRelations(effectiveCalendarLinks(input, before));
    if (previous && (!same(previous.order, selected.order) || !same(previous.lead, selected.lead))) throw new ConflictException("La orden y el cliente del Adéndum no pueden cambiarse después de crearlo.");
    return previous ?? selected;
}
