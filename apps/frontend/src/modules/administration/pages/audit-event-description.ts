import type { AuditEvent } from "./security-audit.api";

type EventDescription = Pick<AuditEvent, "action" | "eventType" | "actionLabel" | "catalogCode" | "record">;
const catalogs = new Map(Object.entries({ projects: "el proyecto", campaigns: "la campaña", classes: "la clase", locations: "la ubicación", subsidiaries: "la subsidiaria", brokers: "el corredor", files: "el expediente de unidad" }));
const verbs = new Map(Object.entries({ create: "Se creó", update: "Se actualizó", deactivate: "Se desactivó", reactivate: "Se reactivó", delete: "Se eliminó" }));
const historicalActions = new Map(Object.entries({ catalog_item_created: "create", catalog_item_updated: "update", user_created: "create", user_updated: "update", role_updated: "update", role_deleted: "delete" }));

/** Presentation only: internal summaries/codes remain unchanged in the audit API and database. */
export function auditEventDescription(event: EventDescription): string {
    const name = event.record.name ? ` "${event.record.name}"` : "";
    if (event.eventType === "user_access_replaced") return `Se actualizaron los accesos del usuario${name}`;
    if (event.eventType === "role_permissions_replaced") return `Se actualizaron los permisos del rol${name}`;
    const subject = auditSubject(event);
    const verb = verbs.get(event.action) ?? verbs.get(historicalActions.get(event.eventType) ?? "");
    if (verb) return `${verb} ${subject}${name}`;
    if (["catalog_item_status_changed", "user_status_updated"].includes(event.eventType)) return `Se cambió el estado ${subject.replace(/^el /, "del ").replace(/^la /, "de la ")}${name}`;
    return event.actionLabel.replace(/^Acción no registrada$/, "Actividad registrada");
}

function auditSubject(event: EventDescription): string {
    if (event.record.entity === "user" || event.eventType.startsWith("user_")) return "el usuario";
    if (event.record.entity === "role" || event.eventType.startsWith("role_")) return "el rol";
    return catalogs.get(event.catalogCode ?? "") ?? "el registro";
}
