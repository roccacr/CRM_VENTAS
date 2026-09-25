import { describe, expect, it } from "vitest";

import { DEFAULT_DIRECT_OVERRIDE_SCOPE, EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";
import { resolveHighestPermissionScope } from "../../src/modules/crm/permissions/permission-scope.js";

describe("EffectivePermissionService", () => {
    const service = new EffectivePermissionService();

    it("mantiene permisos de rol cuando no existe deny personal", () => {
        const result = service.calculate({
            rolePermissions: [{ code: "user.view_self", scope: "self" }],
            overrides: [],
        });

        expect(result.permissions).toEqual([
            {
                code: "user.view_self",
                effect: "allow",
                scope: "self",
                source: "role",
            },
        ]);
        expect(result.can("user.view_self")).toBe(true);
    });

    it("permite que un deny directo gane sobre un allow de rol", () => {
        const result = service.calculate({
            rolePermissions: [{ code: "user.update", scope: "own_area" }],
            overrides: [{ code: "user.update", effect: "deny", scope: "own_area" }],
        });

        expect(result.permissions).toEqual([
            {
                code: "user.update",
                effect: "deny",
                scope: null,
                source: "override",
            },
        ]);
        expect(result.can("user.update")).toBe(false);
    });

    it("agrega permisos allow directos sin cambiar el rol base", () => {
        const result = service.calculate({
            rolePermissions: [{ code: "user.view_self", scope: "self" }],
            overrides: [{ code: "audit.security.view", effect: "allow", scope: "own_area" }],
        });

        expect(result.permissions).toContainEqual({
            code: "audit.security.view",
            effect: "allow",
            scope: "own_area",
            source: "override",
        });
        expect(result.can("audit.security.view")).toBe(true);
    });

    it("mantiene deny directo aunque el allow venga despues en los overrides", () => {
        const result = service.calculate({
            rolePermissions: [{ code: "user.update", scope: "own_area" }],
            overrides: [
                { code: "user.update", effect: "deny", scope: "own_area" },
                { code: "user.update", effect: "allow", scope: "all_areas" },
            ],
        });

        expect(result.permissions).toEqual([
            {
                code: "user.update",
                effect: "deny",
                scope: null,
                source: "override",
            },
        ]);
        expect(result.can("user.update")).toBe(false);
    });

    it("mantiene deny directo aunque el allow venga antes en los overrides", () => {
        const result = service.calculate({
            rolePermissions: [{ code: "user.update", scope: "own_area" }],
            overrides: [
                { code: "user.update", effect: "allow", scope: "all_areas" },
                { code: "user.update", effect: "deny", scope: "own_area" },
            ],
        });

        expect(result.permissions).toEqual([
            {
                code: "user.update",
                effect: "deny",
                scope: null,
                source: "override",
            },
        ]);
        expect(result.can("user.update")).toBe(false);
    });

    it("no reduce un scope amplio de rol cuando el allow directo usa scope minimo", () => {
        const result = service.calculate({
            rolePermissions: [{ code: "lead.view", scope: "all_areas" }],
            overrides: [{ code: "lead.view", effect: "allow", scope: DEFAULT_DIRECT_OVERRIDE_SCOPE }],
        });

        expect(result.permissions).toEqual([
            {
                code: "lead.view",
                effect: "allow",
                scope: "all_areas",
                source: "override",
            },
        ]);
    });

    it("resuelve el scope organizacional mas alto para permisos de rol", () => {
        expect(resolveHighestPermissionScope(["self", "own_area", "all_areas"])).toBe("all_areas");
        expect(resolveHighestPermissionScope(["assigned", "own_area"])).toBe("own_area");
        expect(resolveHighestPermissionScope([])).toBe("self");
    });
});
