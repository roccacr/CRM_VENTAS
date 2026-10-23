import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import { runSelectedSchemaMigrations } from "../../scripts/run-schema-migrations.js";

/** Exercises the orchestration against a compiling in-memory driver, never mysql2. */
const createDatabase = (options: { applied?: boolean; lock?: number | null; fail?: string } = {}) => {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (options.fail && query.sql.includes(options.fail)) return Promise.reject(new Error("Injected runner query failure"));
                const rows = query.sql.includes("GET_LOCK") ? [{ lock_acquired: options.lock === undefined ? 1 : options.lock }] : query.sql.includes("COUNT(*)") ? [{ found_migration: options.applied ? 1 : 0 }] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const destroy = vi.spyOn(db, "destroy");
    return { db, queries, destroy };
};

describe("schema migration runner orchestration without a database", () => {
    it("waits for an asynchronously completing up before recording success or closing", async () => {
        const { db, queries, destroy } = createDatabase();
        let notifyStarted = (): void => undefined;
        let finishUp = (): void => undefined;
        const started = new Promise<void>((resolve) => {
            notifyStarted = resolve;
        });
        const finished = new Promise<void>((resolve) => {
            finishUp = resolve;
        });
        const up = vi.fn().mockImplementation(() => {
            notifyStarted();
            return finished;
        });
        const running = runSelectedSchemaMigrations(db, [{ name: "deferred", up }]);
        try {
            await started;
            await new Promise<void>((resolve) => setImmediate(resolve));
            expect(queries.some((query) => /INSERT INTO conf_schema_migration/.test(query.sql))).toBe(false);
            expect(destroy).not.toHaveBeenCalled();
        } finally {
            finishUp();
            await running;
        }
        expect(queries.filter((query) => /INSERT INTO conf_schema_migration/.test(query.sql))).toHaveLength(1);
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it("preserves the original migration failure if closing also fails", async () => {
        const { db, destroy } = createDatabase();
        const failure = new Error("Original migration failure");
        const warning = vi.spyOn(console, "error").mockImplementation(() => undefined);
        destroy.mockRejectedValueOnce(new Error("Injected cleanup failure"));
        try {
            await expect(runSelectedSchemaMigrations(db, [{ name: "failed", up: vi.fn().mockRejectedValue(failure) }])).rejects.toBe(failure);
            expect(warning).toHaveBeenCalledWith("Schema migration database cleanup failed; preserving the original error.");
        } finally {
            warning.mockRestore();
            destroy.mockRestore();
            await db.destroy();
        }
    });

    it("reports a close failure when the migration itself succeeded", async () => {
        const { db, destroy } = createDatabase();
        const cleanupFailure = new Error("Injected cleanup failure");
        destroy.mockRejectedValueOnce(cleanupFailure);
        try {
            await expect(runSelectedSchemaMigrations(db, [{ name: "selected", up: vi.fn().mockResolvedValue(undefined) }])).rejects.toBe(cleanupFailure);
        } finally {
            destroy.mockRestore();
            await db.destroy();
        }
    });

    it("records success only after up completes and always closes the database", async () => {
        const { db, queries, destroy } = createDatabase();
        let observedLedgerBeforeUp = false;
        const up = vi.fn().mockImplementation(() => {
            observedLedgerBeforeUp = queries.some((query) => /INSERT INTO conf_schema_migration/.test(query.sql));
            return Promise.resolve();
        });
        await runSelectedSchemaMigrations(db, [{ name: "selected", up }]);
        expect(up).toHaveBeenCalledWith(db);
        expect(observedLedgerBeforeUp).toBe(false);
        expect(queries.filter((query) => /INSERT INTO conf_schema_migration/.test(query.sql)).map((query) => query.parameters)).toEqual([["selected"]]);
        expect(queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it("does not ledger a failed up or run later migrations; releases and closes", async () => {
        const { db, queries, destroy } = createDatabase();
        const failure = new Error("Injected partial DDL failure");
        const later = vi.fn();
        await expect(
            runSelectedSchemaMigrations(db, [
                { name: "failed", up: vi.fn().mockRejectedValue(failure) },
                { name: "later", up: later },
            ]),
        ).rejects.toBe(failure);
        expect(later).not.toHaveBeenCalled();
        expect(queries.some((query) => /INSERT INTO conf_schema_migration/.test(query.sql))).toBe(false);
        expect(queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it("skips a ledgered migration without rerunning or rewriting its ledger", async () => {
        const { db, queries, destroy } = createDatabase({ applied: true });
        const up = vi.fn();
        await runSelectedSchemaMigrations(db, [{ name: "existing", up }]);
        expect(up).not.toHaveBeenCalled();
        expect(queries.some((query) => /INSERT INTO conf_schema_migration/.test(query.sql))).toBe(false);
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it.each([0, null])("does not start migrations without the advisory lock: %s", async (lock) => {
        const { db, queries, destroy } = createDatabase({ lock });
        const up = vi.fn();
        await expect(runSelectedSchemaMigrations(db, [{ name: "blocked", up }])).rejects.toThrow("lock de migracion");
        expect(up).not.toHaveBeenCalled();
        expect(queries.some((query) => /CREATE TABLE/.test(query.sql))).toBe(false);
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it.each(["GET_LOCK", "CREATE TABLE", "COUNT(*)", "INSERT INTO"])("propagates %s failure and still closes the database", async (fail) => {
        const { db, destroy } = createDatabase({ fail });
        const up = vi.fn().mockResolvedValue(undefined);
        await expect(runSelectedSchemaMigrations(db, [{ name: "selected", up }])).rejects.toThrow("Injected runner query failure");
        expect(up).toHaveBeenCalledTimes(fail === "INSERT INTO" ? 1 : 0);
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it("does not mask a migration failure if releasing the lock also fails", async () => {
        const { db, destroy } = createDatabase({ fail: "RELEASE_LOCK" });
        const failure = new Error("Original migration failure");
        await expect(runSelectedSchemaMigrations(db, [{ name: "failed", up: vi.fn().mockRejectedValue(failure) }])).rejects.toBe(failure);
        expect(destroy).toHaveBeenCalledTimes(1);
    });
});
