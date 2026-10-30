import { describe, expect, it } from "vitest";

import { canReadFormalizationStages, formalizationReadAccess } from "../../src/common/security/route-permission.js";
const profile = (permissions: unknown[]) => ({ roles: [{ code: "formalizacion", status: "active" }], permissions }) as never;
describe("banner read authorization", () => {
    it("accepts contracts self scope as a module-wide read without banking", () => {
        const p = profile([{ code: "formalizacion.home.contracts.read", effect: "allow", scope: "self" }]);
        expect(canReadFormalizationStages(p)).toBe(true);
        expect(formalizationReadAccess(p)).toMatchObject({ contracts: true, bank: false, approvals: false });
    });
    it("does not revive umbrella when a granular deny exists", () => {
        const p = profile([
            { code: "formalizacion.home.stages.read", effect: "allow", scope: "self" },
            { code: "formalizacion.home.contracts.read", effect: "deny", scope: "self" },
        ]);
        expect(canReadFormalizationStages(p)).toBe(false);
    });
    it("allows approvals independently", () => {
        expect(canReadFormalizationStages(profile([{ code: "formalizacion.home.approvals.read", effect: "allow", scope: "self" }]))).toBe(true);
    });
});
