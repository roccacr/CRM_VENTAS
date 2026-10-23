import { describe, expect, it } from "vitest";

import { normalizePermissionModule, permissionModuleCodes, resolveModuleRoleAccess } from "../../src/modules/crm/identity/identity-module-policy.js";

const general = { code: "jefe_general", name: "Jefe General", status: "active", permissionInheritance: "selected_modules" as const };
const marketing = { code: "mercadeo", name: "Mercadeo", status: "active", permissionInheritance: "assigned" as const };
const chief = { code: "jefe_mercadeo", name: "Jefe de Mercadeo", status: "active", permissionInheritance: "assigned" as const };
const formalization = { code: "formalizacion", name: "Formalizacion", status: "active", permissionInheritance: "assigned" as const };
const mapping = (role: typeof marketing, moduleCode: string, status = "active") => ({ ...role, moduleCode, mappingStatus: status, moduleStatus: "active", moduleDeleted: null });
const generalMappings = ["mercadeo", "formalizacion", "ventas", "contabilidad"].map((moduleCode) => ({ ...general, moduleCode, mappingStatus: "active", moduleStatus: "active", moduleDeleted: null }));

describe("module-bound role resolution", () => {
    it("gives General only selected active module roles, never Owner", () => {
        const access = resolveModuleRoleAccess([general], [...generalMappings, mapping(marketing, "mercadeo"), mapping(chief, "mercadeo"), mapping(formalization, "formalizacion")], ["mercadeo"]);
        expect(access.roles.map((role) => role.code)).toEqual(["jefe_general", "mercadeo", "jefe_mercadeo"]);
        expect(access.moduleCodes).toEqual(["mercadeo"]);
        expect(access.permissionInheritance).toBe("selected_modules");
    });
    it("gives no operational roles or permissions without selected modules", () => {
        const access = resolveModuleRoleAccess([general], [...generalMappings, mapping(marketing, "mercadeo")], []);
        expect(access.roles.map((role) => role.code)).toEqual(["jefe_general"]);
        expect(access.moduleCodes).toEqual([]);
    });
    it("does not make General an administrator through a stale selected module", () => {
        expect(resolveModuleRoleAccess([general], generalMappings, ["administration", "mercadeo"]).moduleCodes).toEqual(["mercadeo"]);
    });
    it("intersects the editable General template with employee modules without dropping the direct role", () => {
        const mappings = [...generalMappings.map((entry) => ({ ...entry, mappingStatus: entry.moduleCode === "mercadeo" ? "active" : "inactive" })), mapping(formalization, "formalizacion")];
        const access = resolveModuleRoleAccess([general, formalization], mappings, ["mercadeo", "formalizacion"]);
        expect(access.moduleCodes).toEqual(["mercadeo"]);
        expect(access.roles.map((entry) => entry.code)).toEqual(["jefe_general"]);
    });
    it("fails closed if the General template has no available module mappings", () => {
        for (const mappings of [[], generalMappings.map((entry) => ({ ...entry, mappingStatus: "inactive" }))]) {
            const access = resolveModuleRoleAccess([general], mappings, ["mercadeo"]);
            expect(access.moduleCodes).toEqual([]);
            expect(access.roles.map((entry) => entry.code)).toEqual(["jefe_general"]);
        }
    });
    it("lets an area chief inherit only its base role and stays inside that area", () => {
        const access = resolveModuleRoleAccess([chief], [mapping(chief, "mercadeo"), mapping(marketing, "mercadeo"), mapping(formalization, "formalizacion")], ["mercadeo", "formalizacion"]);
        expect(access.moduleCodes).toEqual(["mercadeo"]);
        expect(access.roles.map((role) => role.code)).toEqual(["jefe_mercadeo", "mercadeo"]);
        expect(access.permissionInheritance).toBe("assigned");
    });
    it("does not promote a base role to a chief", () => {
        expect(resolveModuleRoleAccess([marketing], [mapping(marketing, "mercadeo"), mapping(chief, "mercadeo")], ["mercadeo"]).roles.map((role) => role.code)).toEqual(["mercadeo"]);
    });
    it("retains a closed ceiling after mapping revocation or module inactivation", () => {
        const revoked = resolveModuleRoleAccess([chief], [mapping(chief, "mercadeo", "inactive")], ["mercadeo"]);
        expect(revoked.moduleCodes).toEqual([]);
        expect(revoked.roles).toEqual([]);
        const inactive = resolveModuleRoleAccess([chief], [{ ...mapping(chief, "mercadeo"), moduleStatus: "inactive" }], ["mercadeo"]);
        expect(inactive.moduleCodes).toEqual([]);
    });
    it("does not leak a multi-module role through one selected module", () => {
        const crossRole = { ...marketing, code: "cross_role" };
        const access = resolveModuleRoleAccess([general], [...generalMappings, mapping(crossRole, "mercadeo"), mapping(crossRole, "formalizacion")], ["mercadeo"]);
        expect(access.roles.map((role) => role.code)).toEqual(["jefe_general"]);
    });
    it("uses a replacement mapping without reopening its revoked previous module", () => {
        const access = resolveModuleRoleAccess([chief], [mapping(chief, "mercadeo", "inactive"), mapping(chief, "formalizacion"), mapping(formalization, "formalizacion")], ["formalizacion"]);
        expect(access.roles.map((role) => role.code)).toEqual(["jefe_mercadeo", "formalizacion"]);
        expect(access.moduleCodes).toEqual(["formalizacion"]);
    });
    it("preserves legacy unscoped roles, without interpreting their name as access", () => {
        expect(resolveModuleRoleAccess([{ ...chief, code: "custom" }], [], ["mercadeo"]).moduleCodes).toBeNull();
    });
    it("normalizes administration aliases without mixing other modules", () => {
        expect(normalizePermissionModule("role")).toBe("administration");
        expect(normalizePermissionModule("formalizacion")).toBe("formalizacion");
        expect(permissionModuleCodes(["mercadeo", "administration"])).toEqual(["mercadeo", "administration", "user", "role", "org"]);
    });
});
