import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { sql } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { LegacyCatalogReader } from "../../src/integrations/legacy-crm/legacy-catalog.reader.js";
import { createLegacyCrmDatabase } from "../../src/integrations/legacy-crm/legacy-crm.config.js";
import { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { BrokersRepository } from "../../src/modules/crm/brokers/brokers.repository.js";
import { readCatalogWithFallback } from "../../src/modules/crm/catalogs/catalog-fallback.js";

describe.skipIf(process.env.LEGACY_BROKERS_MYSQL_TESTS !== "1")("shared-credential legacy reads with rollback-only native fixtures", () => {
    let native: DatabaseService;
    let legacy: LegacyCrmDatabaseService;
    let reader: LegacyCatalogReader;
    const audit = {} as SecurityAuditService;
    beforeAll(() => {
        config({ quiet: true });
        const configuration = new ConfigService(validateEnv({ ...process.env, ENABLE_LEGACY_FALLBACK: "true" }));
        native = new DatabaseService(configuration);
        legacy = new LegacyCrmDatabaseService(createLegacyCrmDatabase(configuration));
        reader = new LegacyCatalogReader(configuration, legacy);
    });
    afterAll(async () => {
        await legacy.onModuleDestroy();
        await native.onModuleDestroy();
    });

    it("connects to legacy with read-only transactions and canonical Brokers", { timeout: 30000 }, async () => {
        await legacy.db.transaction().execute(async (transaction) => {
            const session = await sql<{ databaseName: string; readOnly: number }>`SELECT DATABASE() AS databaseName, @@transaction_read_only AS readOnly`.execute(transaction);
            expect(session.rows[0]).toEqual({ databaseName: "crmdatabase-api", readOnly: 1 });
        });
        const result = await reader.list({ catalogCode: "brokers", limit: 100 });
        expect(result.total).toBeGreaterThan(0);
        expect(result.items[0]?.publicId).toMatch(/^legacy:brokers:/);
        expect(typeof result.items[0]?.id_old_produccion).toBe("number");
    });

    it("merges a migrated native row once and excludes its legacy counterpart even when filtered out", { timeout: 30000 }, async () => {
        const baseline = await reader.list({ catalogCode: "brokers", limit: 100 });
        const source = baseline.items[0];
        if (!source?.id_old_produccion) throw new Error("Legacy fixture unavailable");
        const rollback = new Error("rollback native fixture");
        await expect(
            native.db.transaction().execute(async (transaction) => {
                const publicId = ulid();
                await sql`INSERT INTO crm_broker (public_id_broker,native_code_broker,id_old_produccion_broker,name_broker,status_broker) VALUES (${publicId},${`brokers_${publicId.toLowerCase()}`},${source.id_old_produccion},'Migrated rollback fixture','inactive')`.execute(transaction);
                const repository = new BrokersRepository({ db: transaction, onModuleDestroy: async () => {} }, audit);
                const merged = await readCatalogWithFallback(repository, { catalogCode: "brokers", limit: 100 }, reader);
                expect(merged.items.some((item) => item.publicId === publicId)).toBe(true);
                expect(merged.items.some((item) => item.publicId === source.publicId)).toBe(false);
                const filtered = await readCatalogWithFallback(repository, { catalogCode: "brokers", search: source.name, limit: 100 }, reader);
                expect(filtered.items.some((item) => item.id_old_produccion === source.id_old_produccion)).toBe(false);
                throw rollback;
            }),
        ).rejects.toBe(rollback);
    });

    it("kill switch never invokes legacy or the migration identity reader", { timeout: 30000 }, async () => {
        const repository = new BrokersRepository(native, audit);
        const disabled = { enabled: () => false, list: vi.fn() };
        const identities = vi.spyOn(repository, "listMigratedBrokerIds");
        await readCatalogWithFallback(repository, { catalogCode: "brokers" }, disabled);
        expect(disabled.list).not.toHaveBeenCalled();
        expect(identities).not.toHaveBeenCalled();
    });
});
