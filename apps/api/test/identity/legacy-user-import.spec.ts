import { describe, expect, it } from "vitest";

import { parseImportArgs, planLegacyUsers } from "../../scripts/import-legacy-users.js";

const source = { id: 52, name: "Nombre real", email: " User@Example.test ", status: 1 };
describe("email-only user creation", () => {
    it("copies only name and email, ignoring credentials and ERP information", () => {
        const row = { ...source, password_admin: "secret", netsuiteId: 123 };
        expect(planLegacyUsers([row], []).creates).toEqual([{ name: "Nombre real", email: "User@Example.test", normalizedEmail: "user@example.test", status: "pending" }]);
    });
    it("creates one user per normalized email", () => {
        expect(planLegacyUsers([source, { ...source, id: 79, email: "user@example.test" }], []).creates).toHaveLength(1);
    });
    it("skips existing accounts and is idempotent", () => {
        expect(planLegacyUsers([source], [{ email: "user@example.test", deleted: null }])).toMatchObject({ existing: 1, creates: [] });
    });
    it("preserves inactivity without granting access", () => {
        expect(planLegacyUsers([{ ...source, status: 0 }], []).creates[0]?.status).toBe("inactive");
    });
    it("rejects invalid profiles and deleted identity collisions", () => {
        for (const row of [
            { ...source, email: "invalid" },
            { ...source, name: "" },
            { ...source, status: 2 },
        ])
            expect(() => planLegacyUsers([row], [])).toThrow(/invalid/i);
        expect(() => planLegacyUsers([source], [{ email: "user@example.test", deleted: new Date() }])).toThrow(/deleted/i);
    });
    it("defaults to read only and refuses unconfirmed writes", () => {
        expect(parseImportArgs([]).apply).toBe(false);
        expect(() => parseImportArgs(["--apply"])).toThrow(/confirmation/i);
        expect(() => parseImportArgs(["--apply", "--confirm=crmdatabase-api"])).toThrow(/confirmation/i);
    });
});
