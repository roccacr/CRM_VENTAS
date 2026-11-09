import { describe, expect, it } from "vitest";

import { assertCleanupTarget, assertPreservedDependencies, buildCleanupPlan, qualifiedTable, validateCleanupCounts } from "../../scripts/clear-native-business-data.js";

describe("native-only data cleanup safeguards", () => {
    it("rejects any database other than the exact approved native schema", () => {
        expect(() => {
            assertCleanupTarget("CRM_THINK_V2", []);
        }).not.toThrow();
        for (const name of ["crmdatabase-api", "crm_think_v2", "CRM_THINK_V2 ", undefined])
            expect(() => {
                assertCleanupTarget(name, []);
            }).toThrow("Cleanup is restricted to the exact CRM_THINK_V2 schema");
    });
    it("rejects cross-schema foreign keys before truncating anything", () => {
        expect(() => {
            assertCleanupTarget("CRM_THINK_V2", [{ tableSchema: "crmdatabase-api", referencedSchema: "CRM_THINK_V2" }]);
        }).toThrow("Cross-schema foreign keys forbid native cleanup");
        expect(() => {
            assertCleanupTarget("CRM_THINK_V2", [{ tableSchema: "CRM_THINK_V2", referencedSchema: "crmdatabase-api" }]);
        }).toThrow("Cross-schema foreign keys forbid native cleanup");
    });
    it("preserves every user, authentication identity, role and access assignment", () => {
        const preserved = ["sec_user", "sec_auth_identity", "sec_role", "sec_permission", "sec_role_permission", "sec_role_module", "sec_org_unit", "sec_user_org_unit", "sec_user_role", "sec_user_permission_override", "sec_user_profile_image", "sec_microsoft_account", "int_user_external_identity", "int_external_system", "conf_schema_migration"];
        const plan = buildCleanupPlan([...preserved, "crm_project", "crm_campaign", "audit_record_event", "audit_record", "audit_security_event", "sec_auth_session", "sec_refresh_token", "sec_local_password_reset_token"]);
        expect(plan.preserve).toEqual([...preserved].sort());
        expect(plan.clear).toEqual(["audit_record", "audit_record_event", "audit_security_event", "crm_campaign", "crm_project", "sec_auth_session", "sec_local_password_reset_token", "sec_refresh_token"]);
    });
    it("does not implicitly delete a new unreviewed security table", () => {
        expect(() => buildCleanupPlan(["sec_user", "sec_new_identity_configuration"])).toThrow("Unreviewed native table blocks cleanup");
        expect(() => buildCleanupPlan(["crm_new_configuration"])).toThrow("Unreviewed native table blocks cleanup");
    });
    it("rejects a preservation dependency before any irreversible cleanup", () => {
        const plan = buildCleanupPlan(["sec_user", "crm_project"]);
        expect(() => {
            assertPreservedDependencies(plan, [{ tableName: "sec_user", referencedTable: "crm_project" }]);
        }).toThrow("Preserved configuration depends on a table scheduled for clearing");
    });
    it("qualifies every identifier to the native schema and rejects identifier injection", () => {
        expect(qualifiedTable("crm_project")).toBe("`CRM_THINK_V2`.`crm_project`");
        for (const name of ["crmdatabase-api.admins", "crm_project;DROP DATABASE x", "`crm_project`", "CRM_PROJECT"]) expect(() => qualifiedTable(name)).toThrow("Unexpected SQL identifier");
    });
    it("fails verification if any preserved count changes or any cleared table is nonempty", () => {
        const plan = buildCleanupPlan(["sec_user", "crm_project"]);
        const before = { sec_user: 46, crm_project: 23 };
        expect(() => {
            validateCleanupCounts(plan, before, { sec_user: 46, crm_project: 0 });
        }).not.toThrow();
        expect(() => {
            validateCleanupCounts(plan, before, { sec_user: 45, crm_project: 0 });
        }).toThrow("Preserved table count changed");
        expect(() => {
            validateCleanupCounts(plan, before, { sec_user: 46, crm_project: 1 });
        }).toThrow("A cleared table is not empty");
    });
});
