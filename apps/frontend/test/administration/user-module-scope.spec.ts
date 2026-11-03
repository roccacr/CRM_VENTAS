import { expect, it } from "vitest";

import { getRoleModules } from "../../src/modules/administration/create-system-user.model";
import { canRoleGrantModule, getUserModuleScope, normalizeAccessModuleCode } from "../../src/modules/administration/user-module-scope";
import { parseIdentitySecurityCatalog } from "../../src/services/auth/identity-contracts";

const general = { code: "jefe_general", moduleCodes: ["ventas", "mercadeo", "formalizacion", "contabilidad"], permissionInheritance: "selected_modules" as const };
const marketing = { code: "jefe_mercadeo", moduleCodes: ["mercadeo"], permissionInheritance: "assigned" as const };
const formalization = { code: "jefe_formalizaciones", moduleCodes: ["formalizacion"], permissionInheritance: "assigned" as const };

it("retains optional role metadata and accepts old catalogs", () => {
    const catalog = { auditEvents: [], modules: [], rolePermissions: {}, roles: [{ ...general, name: "Jefe General", description: null, status: "active", locked: true, users: 0 }] };
    expect(parseIdentitySecurityCatalog(catalog).roles[0]).toMatchObject(general);
    expect(parseIdentitySecurityCatalog({ ...catalog, roles: [{ code: "legacy", name: "Legacy", description: null, status: "active", locked: false, users: 0 }] }).roles[0]).not.toHaveProperty("moduleCodes");
});
it.each([true, false])("preserves the moduleScoped marker: %s", (moduleScoped) => {
    const catalog = { auditEvents: [], modules: [], rolePermissions: {}, roles: [{ code: "scoped", name: "Scoped", description: null, status: "active", locked: false, users: 0, moduleScoped, moduleCodes: [] }] };
    expect(parseIdentitySecurityCatalog(catalog).roles[0]).toHaveProperty("moduleScoped", moduleScoped);
});
it("keeps revoked last mappings closed without restricting explicitly unscoped roles", () => {
    const revoked = { code: "revoked", moduleScoped: true };
    expect(getUserModuleScope([revoked.code], [revoked], ["ventas"])).toEqual(new Set());
    expect(canRoleGrantModule(revoked.code, [revoked], "ventas")).toBe(false);
    expect(getUserModuleScope(["legacy"], [{ code: "legacy", moduleScoped: false, moduleCodes: [] }], ["ventas"])).toBeNull();
});
it("rejects a malformed moduleScoped marker", () => {
    expect(() => parseIdentitySecurityCatalog({ auditEvents: [], modules: [], rolePermissions: {}, roles: [{ code: "bad", name: "Bad", description: null, status: "active", locked: false, users: 0, moduleScoped: "true" }] })).toThrow();
});
it.each([{ moduleCodes: "ventas" }, { moduleCodes: [1] }, { permissionInheritance: "everything" }])("rejects malformed optional scope %j", (metadata) => {
    expect(() => parseIdentitySecurityCatalog({ auditEvents: [], modules: [], rolePermissions: {}, roles: [{ ...general, name: "Jefe General", description: null, status: "active", locked: true, users: 0, ...metadata }] })).toThrow();
});
it("gives selected_modules no access until modules are explicitly selected", () => {
    expect([...(getUserModuleScope([general.code], [general], []) ?? [])]).toEqual([]);
    expect([...(getUserModuleScope([general.code], [general], ["mercadeo", "user", "role", "org", "administration", "empresa"]) ?? [])]).toEqual(["mercadeo"]);
});
it("unions ordinary role maps and intersects selected modules", () => {
    expect([...(getUserModuleScope([marketing.code, formalization.code], [marketing, formalization], ["ventas", "mercadeo", "formalizacion"]) ?? [])]).toEqual(["mercadeo", "formalizacion"]);
});
it("normalizes administration aliases without widening operational scope", () => {
    for (const code of ["user", "role", "org", "administration"]) expect(normalizeAccessModuleCode(code)).toBe("administration");
    expect([...(getUserModuleScope(["admin"], [{ code: "admin", moduleCodes: ["role"] }], ["administration"]) ?? [])]).toEqual(["administration"]);
});
it("keeps Owner and unrelated roles outside the new ceiling", () => {
    expect(getUserModuleScope(["owner", general.code], [general], [])).toBeNull();
    expect(getUserModuleScope(["legacy"], [{ code: "legacy" }], [])).toBeNull();
});

it("filters every General contribution to the four operational modules", () => {
    expect([...(getUserModuleScope([general.code], [general], ["ventas", "audit", "integrations", "user", "role", "org", "empresa"]) ?? [])]).toEqual(["ventas"]);
    expect(canRoleGrantModule(general.code, [general], "administration")).toBe(false);
});

it("applies each grant's own role ceiling before union", () => {
    expect(canRoleGrantModule(marketing.code, [marketing, general], "ventas")).toBe(false);
    const modules = [{ code: "ventas", name: "Ventas", views: [{ code: "home", name: "Inicio", permissions: [{ code: "ventas.home.read", name: "Leer ventas", sensitive: false }] }] }];
    const selected = { roles: [marketing, general], selectedModules: ["ventas"] };
    expect(getRoleModules([marketing.code, general.code], { jefe_mercadeo: ["ventas.home.read"], jefe_general: [] }, modules, selected)).toEqual([]);
});

it("requires every mapped module before a multimodule role contributes grants", () => {
    const role = { code: "multi", moduleCodes: ["mercadeo", "formalizacion"], moduleScoped: true, permissionInheritance: "assigned" as const };
    expect(canRoleGrantModule(role.code, [role], "mercadeo", ["mercadeo"])).toBe(false);
    expect(canRoleGrantModule(role.code, [role], "mercadeo", ["mercadeo", "formalizacion"])).toBe(true);
    const modules = [{ code: "mercadeo", name: "Mercadeo", views: [{ code: "home", name: "Inicio", permissions: [{ code: "mercadeo.home.read", name: "Leer", sensitive: false }] }] }];
    expect(getRoleModules([role.code], { multi: ["mercadeo.home.read"] }, modules, { roles: [role], selectedModules: ["mercadeo"] })).toEqual([]);
    expect(getRoleModules([role.code], { multi: ["mercadeo.home.read"] }, modules, { roles: [role], selectedModules: ["mercadeo", "formalizacion"] })).toEqual(modules);
});

it("intersects General's enabled template modules with employee selection", () => {
    const restricted = { ...general, moduleCodes: ["mercadeo"] };
    expect(getUserModuleScope([restricted.code], [restricted], ["mercadeo", "formalizacion", "administration"])).toEqual(new Set(["mercadeo"]));
    expect(canRoleGrantModule(restricted.code, [restricted], "formalizacion", ["formalizacion"])).toBe(false);
    expect(getUserModuleScope([restricted.code], [{ ...restricted, moduleCodes: [] }], ["mercadeo"])).toEqual(new Set());
});

it("el perfil global no exige módulo Lead, pero conserva la efectividad del rol", () => {
    const role = { code: "formalizacion", moduleCodes: ["formalizacion"], moduleScoped: true, permissionInheritance: "assigned" as const };
    expect(canRoleGrantModule(role.code, [role], "lead", ["formalizacion"])).toBe(true);
    expect(canRoleGrantModule(role.code, [role], "lead", [])).toBe(false);
    expect(canRoleGrantModule(general.code, [general], "lead", [])).toBe(true);
});
