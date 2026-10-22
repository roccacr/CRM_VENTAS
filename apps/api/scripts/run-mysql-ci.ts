import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { createConnection, type RowDataPacket } from "mysql2/promise";
import { z } from "zod";

import { validateEnv } from "../src/config/env.validation.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";

// Reviewed rollback-only suites: no legacy connections and no schema migrations.
const NATIVE_MYSQL_FILES = ["test/sales-orders/sales-order-lifecycle.mysql.spec.ts", "test/identity/identity-access-management.mysql.spec.ts", "test/identity/identity-local-session.http.mysql.spec.ts", "test/audit/identity-changelog.mysql.spec.ts", "test/audit/catalog-changelog.mysql.spec.ts"];

/** No dotenv fallback: the dedicated CI environment must supply the destination. */
export function assertIsolatedMysqlConfig(env: Record<string, string | undefined>): void {
    const required = ["MYSQL_TEST_SERVER_UUID", "MYSQL_TEST_DATASET", "DB_HOST", "DB_USER", "DB_PASSWORD"];
    if (!required.every((key) => Boolean(env[key]))) throw new Error("BLOQUEADO POR INFRAESTRUCTURA: configuracion de pruebas incompleta.");
    const expected = { CI: "true", GITHUB_ACTIONS: "true", CRM_MYSQL_TESTS_READY: "true", MYSQL_TEST_CONFIRM: "ISOLATED_TEST_DATABASE", DB_NAME: "CRM_THINK_V2", LEGACY_CRM_DB_NAME: "", ENABLE_LEGACY_FALLBACK: "false" };
    if (!Object.entries(expected).every(([key, value]) => env[key] === value)) throw new Error("Destino MySQL no autorizado para CI.");
}

const mysqlReportSchema = z.object({
    success: z.literal(true),
    numTotalTests: z.number().int().positive(),
    numPassedTests: z.number().int().positive(),
    numFailedTests: z.literal(0),
    numPendingTests: z.literal(0),
    numTodoTests: z.literal(0),
    testResults: z
        .array(
            z.object({
                name: z.string(),
                status: z.literal("passed"),
                assertionResults: z.array(z.object({ status: z.literal("passed") })).nonempty(),
            }),
        )
        .nonempty(),
});

/** Zero tests, skipped assertions and missing suites cannot satisfy persistence CI. */
export function assertMysqlReport(value: unknown, files: string[]): void {
    const report = mysqlReportSchema.parse(value);
    if (files.length === 0 || report.numTotalTests !== report.numPassedTests) throw new Error("Pruebas MySQL incompletas.");
    for (const file of files) {
        const normalized = file.replaceAll("\\", "/");
        if (!report.testResults.some((suite) => suite.name.replaceAll("\\", "/").endsWith("/" + normalized))) {
            throw new Error("Falta una suite MySQL requerida.");
        }
    }
}

/** SELECT-only identity check before any suite is permitted to write fixtures. */
export async function verifyDestination(env: Record<string, string | undefined>): Promise<void> {
    const config = validateEnv(env);
    const connection = await createConnection({
        ...buildMysqlPoolOptions({
            host: config.DB_HOST,
            port: config.DB_PORT,
            user: config.DB_USER,
            password: config.DB_PASSWORD,
            database: config.DB_NAME,
            ssl: config.DB_SSL,
            connectionLimit: 1,
            ...(config.DB_SSL_CA ? { sslCaPath: config.DB_SSL_CA } : {}),
        }),
        connectTimeout: 10000,
    });
    try {
        const [server] = await connection.query<RowDataPacket[]>("SELECT @@server_uuid AS server_uuid");
        if (server[0]?.server_uuid !== env.MYSQL_TEST_SERVER_UUID) throw new Error("Servidor de pruebas no coincide.");
        const [marker] = await connection.query<RowDataPacket[]>("SELECT dataset_id FROM crm_ci_test_environment WHERE purpose = 'isolated-tests'");
        if (marker.length !== 1 || marker[0]?.dataset_id !== env.MYSQL_TEST_DATASET) throw new Error("Dataset aislado no confirmado.");
    } finally {
        await connection.end();
    }
}

/** Activates only reviewed native suites; unknown or legacy files remain unverified. */
async function discoverMysqlTests(env: NodeJS.ProcessEnv): Promise<string[]> {
    const files = (await readdir("test", { recursive: true }))
        .filter((file) => file.endsWith(".mysql.spec.ts"))
        .map((file) => "test/" + file.replaceAll("\\", "/"))
        .sort();
    if (files.length === 0) throw new Error("No hay suites MySQL.");
    for (const file of NATIVE_MYSQL_FILES) {
        if (!files.includes(file)) throw new Error("Falta una suite nativa requerida.");
        const source = await readFile(file, "utf8");
        for (const match of source.matchAll(/process\.env\.([A-Z_]+MYSQL_TESTS)/g)) {
            const flag = match[1];
            if (flag) env[flag] = "1";
        }
    }
    return files;
}

/** Runs only against an explicitly approved, prepared and isolated test server. */
export async function runMysqlCi(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
    assertIsolatedMysqlConfig(environment);
    if (existsSync(".env")) throw new Error("CI MySQL no permite un .env local.");
    const env: NodeJS.ProcessEnv = { ...environment, NODE_ENV: "test", FRONTEND_ORIGIN: "http://localhost:5173", COOKIE_SECRET: randomBytes(32).toString("hex"), AUDIT_HASH_SECRET: randomBytes(32).toString("hex"), AUTH_TOKEN_HASH_SECRET: randomBytes(32).toString("hex") };
    await verifyDestination(env);
    const files = await discoverMysqlTests(env);
    await mkdir("coverage", { recursive: true });
    const reportPath = "coverage/mysql-results.json";
    const result = spawnSync("pnpm", ["exec", "vitest", "run", ...NATIVE_MYSQL_FILES, "--maxWorkers=1", "--testTimeout=30000", "--reporter=default", "--reporter=json", "--outputFile=" + reportPath], { env, stdio: "inherit", shell: false });
    if (result.error || result.status !== 0) throw new Error("Fallo la ejecucion MySQL.");
    const report: unknown = JSON.parse(await readFile(reportPath, "utf8"));
    assertMysqlReport(report, NATIVE_MYSQL_FILES);
    const parsed = mysqlReportSchema.parse(report);
    const unverified = files.filter((file) => !NATIVE_MYSQL_FILES.includes(file));
    await writeFile("coverage/mysql-ci-summary.json", JSON.stringify({ status: unverified.length ? "partial" : "passed", files: NATIVE_MYSQL_FILES.length, passed: parsed.numPassedTests, skipped: 0, unverifiedSuites: unverified.length, dataset: env.MYSQL_TEST_DATASET }) + "\n");
    if (unverified.length) {
        console.error("BLOQUEADO POR ALCANCE: suites MySQL fuera del grupo nativo autorizado; no se declara persistencia completa.");
        process.exitCode = 1;
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    void runMysqlCi().catch(() => {
        // Driver errors can include SQL and credentials; never print raw exceptions.
        console.error("MySQL CI no aprobado: infraestructura, aislamiento o pruebas pendientes. Revise el runbook.");
        process.exitCode = 1;
    });
}
