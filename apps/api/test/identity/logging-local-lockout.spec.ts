import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import pino from "pino";
import { describe, expect, it } from "vitest";

import { APP_LOG_REDACT_PATHS, APP_LOG_REQUEST_SERIALIZER } from "../../src/config/app-logging.constants.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityLocalRepository } from "../../src/modules/crm/identity/identity-local.repository.js";

describe("OIDC logging and local lockout regressions", () => {
    it.each(["code=secret-code&state=secret-state&access_token=secret-token", "CODE=secret-code&STATE=secret-state&TOKEN=secret-token", "%63ode=secret-code&%73tate=secret-state&token=secret-token"])("removes URL/query/raw secrets and keeps context: %s", (queryString) => {
        const lines: string[] = [];
        const logger = pino({ serializers: { req: APP_LOG_REQUEST_SERIALIZER }, redact: { paths: APP_LOG_REDACT_PATHS, censor: "[REDACTED]" } }, { write: (line: string) => lines.push(line) });
        const request = { id: "safe-id", method: "GET", url: `/identity/microsoft/callback?${queryString}`, query: { code: "secret-code", state: "secret-state", nested: { token: "secret-token" } }, headers: { authorization: "secret-auth", cookie: "secret-cookie", "x-crm-csrf-token": "secret-csrf" }, raw: { url: `/identity/microsoft/callback?${queryString}`, query: { token: "secret-raw" } } };
        logger.info({ req: request });
        const output = lines.join("");
        for (const secret of ["secret-code", "secret-state", "secret-token", "secret-auth", "secret-cookie", "secret-csrf", "secret-raw"]) expect(output).not.toContain(secret);
        const entry = JSON.parse(output) as { req: Record<string, unknown> };
        expect(entry.req).not.toHaveProperty("raw");
        expect(request.url).toContain(queryString);
        expect(request.raw.query.token).toBe("secret-raw");
        expect(request.headers.authorization).toBe("secret-auth");
        expect(output).toContain("/identity/microsoft/callback");
        expect(output).toContain("safe-id");
        expect(output).toContain("GET");
        expect(output).toContain("[REDACTED]");
    });

    it.each([3, 4, 5])("uses the incremented SQL counter exactly once from %i failures", async (initialCount) => {
        const queries: CompiledQuery[] = [];
        const driver = new DummyDriver();
        const lockUntil = new Date("2026-10-23T12:30:00Z");
        let failedLoginCount = initialCount;
        let lockedUntil: Date | null = null;
        driver.acquireConnection = async () => {
            const connection = await DummyDriver.prototype.acquireConnection.call(driver);
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                // Simulate MySQL SET ordering using the actual compiled CASE expression.
                if (query.sql.startsWith("update")) {
                    failedLoginCount++;
                    const doubleIncrement = query.sql.includes("CASE WHEN failed_login_count_auth_identity + 1");
                    if (failedLoginCount + Number(doubleIncrement) >= 5) lockedUntil = lockUntil;
                }
                const rows = query.sql.startsWith("select") ? [{ failedLoginCount, lockedUntil }] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        };
        const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
        try {
            const repository = new IdentityLocalRepository({ db } as DatabaseService, {} as SecurityAuditService);
            const result = await repository.recordFailedLocalLogin(10, 5, lockUntil);
            const update = queries[0];
            expect(update?.sql).toContain("`failed_login_count_auth_identity` = failed_login_count_auth_identity + 1");
            expect(update?.sql).toContain("CASE WHEN failed_login_count_auth_identity >= ?");
            expect(update?.sql.indexOf("`failed_login_count_auth_identity` =")).toBeLessThan(update?.sql.indexOf("CASE WHEN") ?? 0);
            expect(update?.parameters).toContain(5);
            expect(result).toEqual({ failedLoginCount: initialCount + 1, lockedUntil: initialCount + 1 >= 5 ? lockUntil : null });
        } finally {
            await db.destroy();
        }
    });
});
