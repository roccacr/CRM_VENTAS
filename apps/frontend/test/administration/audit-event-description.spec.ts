import { describe, expect, it } from "vitest";

import { auditEventDescription } from "../../src/modules/administration/pages/audit-event-description";

describe("audit descriptions for end users", () => {
    const event = { action: "catalog_item_updated", eventType: "catalog_item_updated", actionLabel: "Edición de registro", catalogCode: "campaigns", record: { id: "record", entity: "catalog", name: null } };
    it("translates legacy catalog messages without requiring a historical name", () => {
        expect(auditEventDescription(event)).toBe("Se actualizó la campaña");
        expect(auditEventDescription({ ...event, record: { ...event.record, name: "Referidos" } })).toBe('Se actualizó la campaña "Referidos"');
    });
    it.each([
        ["create", "Se creó"],
        ["update", "Se actualizó"],
        ["deactivate", "Se desactivó"],
        ["reactivate", "Se reactivó"],
        ["delete", "Se eliminó"],
    ])("explains %s with a readable entity", (action, verb) => {
        expect(auditEventDescription({ ...event, action, catalogCode: "projects" })).toBe(`${verb} el proyecto`);
    });
    it("describes access, permission and unknown events without exposing event codes", () => {
        expect(auditEventDescription({ ...event, action: "update", eventType: "user_access_replaced", record: { ...event.record, entity: "user" } })).toBe("Se actualizaron los accesos del usuario");
        expect(auditEventDescription({ ...event, eventType: "role_permissions_replaced", record: { ...event.record, entity: "role" } })).toBe("Se actualizaron los permisos del rol");
        expect(auditEventDescription({ ...event, action: "new_internal_event", eventType: "new_internal_event", actionLabel: "Acción no registrada" })).toBe("Actividad registrada");
    });
});
