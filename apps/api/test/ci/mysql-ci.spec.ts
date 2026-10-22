import { describe, expect, it } from "vitest";

import { assertIsolatedMysqlConfig, assertMysqlReport } from "../../scripts/run-mysql-ci.js";

describe("MySQL CI fail-closed policy", () => {
    const environment = {
        CI: "true",
        GITHUB_ACTIONS: "true",
        CRM_MYSQL_TESTS_READY: "true",
        MYSQL_TEST_CONFIRM: "ISOLATED_TEST_DATABASE",
        MYSQL_TEST_SERVER_UUID: "test-server",
        MYSQL_TEST_DATASET: "synthetic-v1",
        DB_NAME: "CRM_THINK_V2",
        LEGACY_CRM_DB_NAME: "",
        ENABLE_LEGACY_FALLBACK: "false",
        DB_HOST: "test.invalid",
        DB_USER: "ci_test",
        DB_PASSWORD: "dedicated-test-secret",
        DB_SSL: "true",
    };
    it("blocks unconfigured infrastructure before connecting", () => {
        expect(() => {
            assertIsolatedMysqlConfig({});
        }).toThrow("BLOQUEADO");
    });
    it("requires explicit isolation, CI and a dedicated server identity", () => {
        expect(() => {
            assertIsolatedMysqlConfig(environment);
        }).not.toThrow();
        for (const key of ["CI", "GITHUB_ACTIONS", "MYSQL_TEST_CONFIRM", "MYSQL_TEST_SERVER_UUID", "MYSQL_TEST_DATASET", "DB_HOST", "DB_USER", "DB_PASSWORD"]) {
            expect(() => {
                assertIsolatedMysqlConfig({ ...environment, [key]: "" });
            }).toThrow();
        }
        expect(() => {
            assertIsolatedMysqlConfig({ ...environment, ENABLE_LEGACY_FALLBACK: "true", LEGACY_CRM_DB_NAME: "crmdatabase-api" });
        }).toThrow();
    });
    const passed = { success: true, numTotalTests: 2, numPassedTests: 2, numPendingTests: 0, numTodoTests: 0, numFailedTests: 0, testResults: [{ name: "/repo/test/example.mysql.spec.ts", status: "passed", assertionResults: [{ status: "passed" }, { status: "passed" }] }] };
    it("accepts only executed and passing tests for every discovered MySQL file", () => {
        expect(() => {
            assertMysqlReport(passed, ["test/example.mysql.spec.ts"]);
        }).not.toThrow();
    });
    it("rejects missing files, zero tests, failed tests and partial skips", () => {
        for (const report of [
            { ...passed, success: false },
            { ...passed, numTotalTests: 0 },
            { ...passed, numPendingTests: 1 },
            { ...passed, numTodoTests: 1 },
            { ...passed, numFailedTests: 1 },
            { ...passed, testResults: [] },
        ]) {
            expect(() => {
                assertMysqlReport(report, ["test/example.mysql.spec.ts"]);
            }).toThrow();
        }
        expect(() => {
            assertMysqlReport(passed, ["test/other.mysql.spec.ts"]);
        }).toThrow();
        expect(() => {
            assertMysqlReport(passed, []);
        }).toThrow();
    });
});
