import { describe, expect, it } from "vitest";

import { calendarAccess } from "../../src/modules/crm/calendar/calendar-access.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";

function profile(role: string): IdentityProfile {
    return {
        user: { publicId: "formalization-reader" },
        roles: [{ code: role, name: role, status: "active" }],
        orgUnits: [{ code: "formalizacion", status: "active" }],
        permissions: ["read", "create", "update"].map((action) => ({ code: `formalizacion.calendar.${action}`, effect: "allow", scope: "self", source: "role" })),
    } as IdentityProfile;
}

describe("Formalization calendar role population", () => {
    it.each(["formalizacion", "jefe_formalizaciones"])("lets active %s consult all module events without widening writing", (role) => {
        const current = profile(role);
        expect(calendarAccess(current, "formalizacion", "read")).toEqual({ allowed: true, ownOnly: false });
        expect(calendarAccess(current, "formalizacion", "create")).toEqual({ allowed: true, ownOnly: true });
        expect(calendarAccess(current, "formalizacion", "update")).toEqual({ allowed: true, ownOnly: true });
        expect(calendarAccess(current, "mercadeo", "read").allowed).toBe(false);
    });
    it.each(["absent", "denied", "no_membership"])("does not substitute the role for %s ordinary access", (state) => {
        const current = profile("formalizacion");
        if (state === "absent") current.permissions = [];
        if (state === "denied") current.permissions.push({ code: "formalizacion.calendar.read", effect: "deny", scope: null, source: "override" });
        if (state === "no_membership") current.orgUnits = [];
        expect(calendarAccess(current, "formalizacion", "read").allowed).toBe(false);
    });
    it("does not give the same population to unrelated or inactive roles", () => {
        const current = profile("ventas");
        expect(calendarAccess(current, "formalizacion", "read")).toEqual({ allowed: true, ownOnly: true });
        current.roles = [{ code: "formalizacion", name: "Formalización", status: "inactive" }];
        expect(calendarAccess(current, "formalizacion", "read")).toEqual({ allowed: true, ownOnly: true });
    });
});
