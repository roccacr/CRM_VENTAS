import { describe, expect, it } from "vitest";

import { hasGlobalMarketingRead } from "../../src/modules/crm/marketing/marketing-read.policy.js";

const perm = (code: string, effect: "allow" | "deny") => ({ code, effect }) as never;
const profile = (...permissions: unknown[]) => ({ permissions }) as never;
const CODE = "mercadeo.reports.read_all";

describe("hasGlobalMarketingRead", () => {
    it("grants only with an explicit allow", () => {
        expect(hasGlobalMarketingRead(profile(perm(CODE, "allow")))).toBe(true);
    });

    it("denies with no permissions at all", () => {
        expect(hasGlobalMarketingRead(profile())).toBe(false);
    });

    it("denies when only a deny exists", () => {
        expect(hasGlobalMarketingRead(profile(perm(CODE, "deny")))).toBe(false);
    });

    it.each([
        ["allow then deny", [perm(CODE, "allow"), perm(CODE, "deny")]],
        ["deny then allow", [perm(CODE, "deny"), perm(CODE, "allow")]],
        ["many allows and one deny", [perm(CODE, "allow"), perm(CODE, "allow"), perm(CODE, "deny")]],
    ])("deny always wins regardless of order: %s", (_name, permissions) => {
        expect(hasGlobalMarketingRead(profile(...permissions))).toBe(false);
    });

    it.each(["mercadeo.reports.read", "mercadeo.reports.read_all.extra", "MERCADEO.REPORTS.READ_ALL", " mercadeo.reports.read_all", "formalizacion.orders.read", ""])("does not accept a look-alike code: %j", (code) => {
        expect(hasGlobalMarketingRead(profile(perm(code, "allow")))).toBe(false);
    });

    it("ignores a deny on an unrelated code", () => {
        expect(hasGlobalMarketingRead(profile(perm(CODE, "allow"), perm("otro.permiso", "deny")))).toBe(true);
    });
});
