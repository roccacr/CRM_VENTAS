import { setTimeout as delay } from "node:timers/promises";

import { type CompiledQuery, type Driver, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { LegacyHomeSummaryReader } from "../../src/integrations/legacy-crm/legacy-home-summary.reader.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { HomeSummaryRepository } from "../../src/modules/crm/sales/sales-orders/home-summary.repository.js";
import { HomeSummaryService } from "../../src/modules/crm/sales/sales-orders/home-summary.service.js";
import type { StageAggregateRow } from "../../src/modules/crm/sales/sales-orders/home-summary.types.js";
import type { evaluateSynthetic, StageCounts } from "./home-summary-synthetic.js";

/** Real service/repositories, fake identity and SQL results. Driver never opens a socket. */
export function createSummaryDouble(expected: ReturnType<typeof evaluateSynthetic>, delayMs = 0) {
    // Counts queries per schema (legacy SQL names the legacy database) to assert the 1+1 query budget.
    const metrics = { native: 0, legacy: 0, transactions: 0 };
    // Simulated connection pool: tracks peak concurrency and queueing without opening sockets.
    const pool = { limit: 10, activeConnections: 0, maxActiveConnections: 0, peakQueue: 0 };
    const waiters: (() => void)[] = [];
    const queries: CompiledQuery[] = [];
    const settings: unknown[] = [];
    const driver: Driver = new DummyDriver();
    driver.beginTransaction = (_connection, configuration) => {
        metrics.transactions++;
        if (settings.length < 1) settings.push(configuration);
        return Promise.resolve();
    };
    // Maps expected counts to the raw aggregate row shape the real SQL would return.
    const row = (counts: StageCounts): StageAggregateRow => ({ ...counts, toSend: counts.contracts.toSend, pendingSignature: counts.contracts.pendingSignature, duplicatesExcluded: expected.duplicatesExcluded });
    // FIFO handoff reserves the released slot for the oldest waiter across the entire transaction.
    driver.releaseConnection = () => {
        const resume = waiters.shift();
        if (resume) resume();
        else pool.activeConnections--;
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        if (pool.activeConnections >= pool.limit) {
            await new Promise<void>((resolve) => {
                waiters.push(resolve);
                pool.peakQueue = Math.max(pool.peakQueue, waiters.length);
            });
        } else pool.activeConnections++;
        pool.maxActiveConnections = Math.max(pool.maxActiveConnections, pool.activeConnections);
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = async <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            const legacy = query.sql.includes("crmdatabase-api");
            metrics[legacy ? "legacy" : "native"]++;
            if (queries.length < 2) queries.push(query);
            if (delayMs) await delay(delayMs);
            return { rows: [row(legacy ? expected.legacy : expected.native) as R] };
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const repository = new HomeSummaryRepository({ db } as DatabaseService);
    const legacy = new LegacyHomeSummaryReader({ isConfigured: () => true } as LegacyCrmDatabaseService);
    const identity = { getCurrentUser: () => Promise.resolve({ roles: [{ code: "formalizacion", status: "active" }], permissions: [{ code: "formalizacion.home.stages.read", effect: "allow" }] }) } as unknown as IdentityService;
    return { service: new HomeSummaryService(identity, repository, legacy), db, metrics, pool, queries, settings };
}
