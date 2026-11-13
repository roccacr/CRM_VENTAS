import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { resolveRouteState } from "../../src/routes/auth-state";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";

const contexts = [
    { module: "administration", workspace: "administration" },
    { module: "mercadeo", workspace: "marketing" },
    { module: "formalizacion", workspace: "formalization" },
] as const;
function profile(module: string, role: string, status = "active", denied = false): IdentityProfile {
    return {
        auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
        orgUnits: [{ code: module, membership: "member", name: module, publicId: module, scope: "self", status: "active" }],
        permissions: [{ code: `${module}.catalog_bank.read`, effect: "allow", scope: null, source: "override" }, ...(denied ? [{ code: `${module}.catalog_bank.read`, effect: "deny" as const, scope: null, source: "override" as const }] : [])],
        roles: role ? [{ code: role, name: role, status }] : [],
        session: { expiresAt: "2099-01-01T00:00:00Z", expiresInSeconds: 60, permissionVersion: 1, publicId: "session", status: "active" },
        user: { displayName: "QA", email: "qa@example.test", permissionVersion: 1, profileImageUrl: null, publicId: "user", status: "active" },
    };
}
describe("Bancos: permisos y rol en URL directa", () => {
    it.each(contexts)("acepta permiso personal sin rol privilegiado en $workspace", ({ module, workspace }) => {
        expect(resolveRouteState(profile(module, "formalizacion"), `/home/${workspace}/catalogs/banks`).status).toBe("authenticated");
    });
    it.each(contexts)("acepta Owner y General activos en $workspace", ({ module, workspace }) => {
        for (const role of ["owner", "jefe_general"]) expect(resolveRouteState(profile(module, role), `/home/${workspace}/catalogs/banks`).status).toBe("authenticated");
    });
    it.each(contexts)("deny y rol inactivo bloquean $workspace", ({ module, workspace }) => {
        expect(resolveRouteState(profile(module, "owner", "active", true), `/home/${workspace}/catalogs/banks`).status).toBe("forbidden");
        expect(resolveRouteState({ ...profile(module, "owner", "inactive"), permissions: [] }, `/home/${workspace}/catalogs/banks`).status).toBe("forbidden");
        expect(resolveRouteState({ ...profile(module, ""), permissions: [] }, `/home/${workspace}/catalogs/banks`).status).toBe("forbidden");
    });
});

it.each(["sales", "accounting"])("rechaza la ruta retirada de bancos de %s incluso con grants históricos", (workspace) => {
    expect(resolveRouteState(profile(workspace === "sales" ? "ventas" : "contabilidad", "owner"), `/home/${workspace}/catalogs/banks`).status).toBe("forbidden");
});

it("propiedad: roles, grants históricos y parámetros arbitrarios no reabren secciones retiradas", () => {
    fc.assert(
        fc.property(
            fc.record({
                workspace: fc.constantFrom("sales", "accounting"),
                role: fc.constantFrom("owner", "jefe_general", "formalizacion", "ventas"),
                denied: fc.boolean(),
                section: fc.constantFrom("calendar", "catalogs/banks", "catalogs/projects"),
                query: fc.string({ maxLength: 120 }),
            }),
            ({ workspace, role, denied, section, query }) => {
                const current = profile(workspace === "sales" ? "ventas" : "contabilidad", role, "active", denied);
                const before = JSON.stringify(current);
                expect(resolveRouteState(current, `/home/${workspace}/${section}?search=${encodeURIComponent(query)}`).status).toBe("forbidden");
                expect(JSON.stringify(current)).toBe(before);
            },
        ),
        { seed: 20261113, numRuns: 150 },
    );
});
