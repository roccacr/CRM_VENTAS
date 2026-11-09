import { describe, expect, it } from "vitest";

import { hasRoutePermission } from "../../src/common/security/route-permission.js";
import { assertFormalizationOrderReadable } from "../../src/modules/crm/sales/sales-orders/formalization-read.policy.js";
const profile = (code: string, effect = "allow", status = "active") => ({ roles: [{ code: "formalizacion", status }], permissions: [{ code, effect, scope: "self" }] }) as never;
const order = { id: "1", publicId: "1", active: true, pendingApproval: false, ownerId: "other", approved: 0, rawStage: "unclassified", contractSigned: 0, completedThisYear: 0 };
describe("independent order detail authorization", () => {
    it("allows detail alone for an active unclassified order without banner visibility", () => {
        const p = profile("formalizacion.orders.read");
        expect(() => {
            assertFormalizationOrderReadable(p, order);
        }).not.toThrow();
        expect(hasRoutePermission(p, { kind: "formalization-order-read" }, {} as never)).toBe(true);
        expect(hasRoutePermission(p, { kind: "formalization-read" }, {} as never)).toBe(false);
    });
    it.each(["formalizacion.home.contracts.read", "formalizacion.home.approvals.read", "formalizacion.home.stages.read"])("denies banner-only %s", (code) => {
        expect(() => {
            assertFormalizationOrderReadable(profile(code), { ...order, approved: 1, pendingApproval: true, rawStage: "contract_pending_send" });
        }).toThrow("No tiene permiso para consultar esta orden.");
    });
    it("denies explicit deny, an inactive role with no effective grant, and an inactive order", () => {
        for (const p of [profile("formalizacion.orders.read", "deny"), { roles: [{ code: "formalizacion", status: "inactive" }], permissions: [] } as never])
            expect(() => {
                assertFormalizationOrderReadable(p, order);
            }).toThrow("No tiene permiso para consultar esta orden.");
        expect(() => {
            assertFormalizationOrderReadable(profile("formalizacion.orders.read"), { ...order, active: false });
        }).toThrow("Orden disponible no encontrada.");
    });
    it("honors the effective personal grant and lets explicit deny override it", () => {
        const grant = { code: "formalizacion.orders.read", effect: "allow", scope: "self", source: "override" };
        for (const roles of [[], [{ code: "owner", status: "active" }], [{ code: "formalizacion", status: "inactive" }]]) {
            const requirement = { kind: "formalization-order-read" } as const;
            expect(hasRoutePermission({ roles, permissions: [grant] } as never, requirement, {} as never)).toBe(true);
            expect(hasRoutePermission({ roles, permissions: [grant, { ...grant, effect: "deny" }] } as never, requirement, {} as never)).toBe(false);
        }
    });
});
