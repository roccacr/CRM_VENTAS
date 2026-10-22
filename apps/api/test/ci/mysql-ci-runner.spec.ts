import { spawnSync } from "node:child_process";
import type * as NodeFs from "node:fs";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

import { createConnection } from "mysql2/promise";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMysqlCi, verifyDestination } from "../../scripts/run-mysql-ci.js";

vi.mock("mysql2/promise", () => ({ createConnection: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
vi.mock("node:fs", async (importOriginal) => ({ ...(await importOriginal<typeof NodeFs>()), existsSync: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), readdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() }));

const environment = {
    CI: "true",
    GITHUB_ACTIONS: "true",
    CRM_MYSQL_TESTS_READY: "true",
    MYSQL_TEST_CONFIRM: "ISOLATED_TEST_DATABASE",
    MYSQL_TEST_SERVER_UUID: "test-server",
    MYSQL_TEST_DATASET: "synthetic-v1",
    DB_HOST: "test.invalid",
    DB_PORT: "3306",
    DB_USER: "ci_test",
    DB_PASSWORD: "test-only",
    DB_NAME: "CRM_THINK_V2",
    DB_SSL: "true",
    LEGACY_CRM_DB_NAME: "",
    ENABLE_LEGACY_FALLBACK: "false",
    NODE_ENV: "test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    COOKIE_SECRET: "cookie-secret-test-only-32-characters",
    AUTH_TOKEN_HASH_SECRET: "auth-secret-test-only-32-characters",
    AUDIT_HASH_SECRET: "audit-secret-test-only-32-characters",
};
const files = ["test/sales-orders/sales-order-lifecycle.mysql.spec.ts", "test/identity/identity-access-management.mysql.spec.ts", "test/identity/identity-local-session.http.mysql.spec.ts", "test/audit/identity-changelog.mysql.spec.ts", "test/audit/catalog-changelog.mysql.spec.ts"];
const query = vi.fn();
const end = vi.fn();
const previousExitCode = process.exitCode;

beforeEach(() => {
    vi.resetAllMocks();
    process.exitCode = undefined;
    vi.mocked(createConnection).mockResolvedValue({ query, end } as never);
    query.mockResolvedValueOnce([[{ server_uuid: "test-server" }]]).mockResolvedValue([[{ dataset_id: "synthetic-v1" }]]);
    end.mockResolvedValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdir).mockResolvedValue(files.map((file) => file.slice(5)) as never);
    const report = { success: true, numTotalTests: 5, numPassedTests: 5, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0, testResults: files.map((name) => ({ name: "/repo/" + name, status: "passed", assertionResults: [{ status: "passed" }] })) };
    vi.mocked(readFile).mockImplementation((path) => Promise.resolve(typeof path === "string" && path.endsWith(".json") ? JSON.stringify(report) : "process.env.AUDIT_MYSQL_TESTS"));
    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as never);
});
afterEach(() => {
    process.exitCode = previousExitCode;
});

describe("MySQL CI preflight and orchestration without a real database", () => {
    it("rejects invalid runtime configuration before connecting", async () => {
        await expect(verifyDestination({ ...environment, DB_SSL: "false" })).rejects.toThrow("DB_SSL");
        expect(createConnection).not.toHaveBeenCalled();
    });
    it("stops before spawning tests when connection fails", async () => {
        vi.mocked(createConnection).mockRejectedValue(new Error("offline"));
        await expect(runMysqlCi(environment)).rejects.toThrow("offline");
        expect(spawnSync).not.toHaveBeenCalled();
        expect(end).not.toHaveBeenCalled();
    });
    it("closes the connection and stops on UUID mismatch", async () => {
        query.mockReset().mockResolvedValue([[{ server_uuid: "wrong" }]]);
        await expect(runMysqlCi(environment)).rejects.toThrow("Servidor");
        expect(query).toHaveBeenCalledOnce();
        expect(end).toHaveBeenCalledOnce();
        expect(spawnSync).not.toHaveBeenCalled();
    });
    it.each([{ rows: [] }, { rows: [{ dataset_id: "wrong" }] }])("rejects a missing or incorrect marker", async ({ rows }) => {
        query
            .mockReset()
            .mockResolvedValueOnce([[{ server_uuid: "test-server" }]])
            .mockResolvedValue([rows]);
        await expect(runMysqlCi(environment)).rejects.toThrow("Dataset");
        expect(end).toHaveBeenCalledOnce();
        expect(spawnSync).not.toHaveBeenCalled();
    });
    it("closes the connection when the marker query fails", async () => {
        query
            .mockReset()
            .mockResolvedValueOnce([[{ server_uuid: "test-server" }]])
            .mockRejectedValue(new Error("marker unavailable"));
        await expect(runMysqlCi(environment)).rejects.toThrow("marker unavailable");
        expect(end).toHaveBeenCalledOnce();
        expect(spawnSync).not.toHaveBeenCalled();
    });
    it("rejects local dotenv before any database or child process", async () => {
        vi.mocked(existsSync).mockReturnValue(true);
        await expect(runMysqlCi(environment)).rejects.toThrow(".env");
        expect(createConnection).not.toHaveBeenCalled();
        expect(spawnSync).not.toHaveBeenCalled();
    });
    it("closes the preflight connection before running tests and writes the summary", async () => {
        await runMysqlCi(environment);
        expect(end.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(spawnSync).mock.invocationCallOrder[0] ?? 0);
        expect(query).toHaveBeenNthCalledWith(1, "SELECT @@server_uuid AS server_uuid");
        expect(query).toHaveBeenNthCalledWith(2, "SELECT dataset_id FROM crm_ci_test_environment WHERE purpose = 'isolated-tests'");
        expect(mkdir).toHaveBeenCalledOnce();
        expect(writeFile).toHaveBeenCalledWith("coverage/mysql-ci-summary.json", expect.stringContaining('"status":"passed"'));
        expect(process.exitCode).toBeUndefined();
    });
    it("does not publish success when the child process fails", async () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 1 } as never);
        await expect(runMysqlCi(environment)).rejects.toThrow("ejecucion");
        expect(writeFile).not.toHaveBeenCalled();
    });
    it("keeps unreviewed suites visible and returns failure for the complete gate", async () => {
        vi.mocked(readdir).mockResolvedValue([...files.map((file) => file.slice(5)), "integrations/legacy.mysql.spec.ts"] as never);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            await runMysqlCi(environment);
            expect(writeFile).toHaveBeenCalledWith("coverage/mysql-ci-summary.json", expect.stringContaining('"status":"partial"'));
            expect(process.exitCode).toBe(1);
        } finally {
            log.mockRestore();
        }
    });
});
