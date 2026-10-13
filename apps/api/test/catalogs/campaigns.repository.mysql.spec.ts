import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { campaignsDomainMigration } from "../../migrations/schema-only/202610120010_campaigns_domain.js";
import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyCampaignsWriter } from "../../src/integrations/legacy-crm/campaigns/legacy-campaigns.writer.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { CampaignsRepository } from "../../src/modules/crm/campaigns/campaigns.repository.js";
import type { CampaignsLegacyAccess } from "../../src/modules/crm/campaigns/campaigns-legacy.port.js";

describe.skipIf(process.env.CAMPAIGN_MYSQL_TESTS !== "1")("independent campaign MySQL persistence", () => {
    let database: DatabaseService;
    const rollback = new Error("rollback fixtures");
    beforeAll(() => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    const withRollback = async (run: (repository: CampaignsRepository, transaction: Transaction<CrmDatabase>, input: { actorPublicId: string; catalogCode: "campaigns"; name: string; reason: string; externalReferences: { systemCode: string; externalId: string }[] }, service: DatabaseService) => Promise<void>): Promise<void> => {
        try {
            await database.db.transaction().execute(async (transaction) => {
                const scoped = new Proxy(transaction, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (executor: Transaction<CrmDatabase>) => Promise<unknown>) => {
                                    await sql`SAVEPOINT campaign_operation`.execute(transaction);
                                    try {
                                        const result = await operation(scoped);
                                        await sql`RELEASE SAVEPOINT campaign_operation`.execute(transaction);
                                        return result;
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT campaign_operation`.execute(transaction);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                const actorPublicId = ulid();
                const name = `campaign-test-${ulid()}`;
                const email = `${name}@example.invalid`;
                await sql`INSERT INTO sec_user (public_id_user,email_user,normalized_email_user,display_name_user) VALUES (${actorPublicId},${email},${email},'Rollback test actor')`.execute(transaction);
                const systemCode = `test-${ulid()}`;
                await sql`INSERT INTO int_external_system (code_external_system,name_external_system,status_external_system) VALUES (${systemCode},'Rollback provider','active')`.execute(transaction);
                const service: DatabaseService = { db: scoped, onModuleDestroy: async () => {} };
                const input = { actorPublicId, catalogCode: "campaigns" as const, name, reason: "Dedicated campaign regression", externalReferences: [{ systemCode, externalId: "-5" }] };
                await run(new CampaignsRepository(service, new SecurityAuditService(service)), transaction, input, service);
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    };

    it("creates, filters, updates and deactivates only dedicated campaigns, retaining provider ownership", async () => {
        await withRollback(async (repository, transaction, input) => {
            const item = await repository.createCatalogItem(input);
            expect(item.externalReferences[0]?.externalId).toBe("-5");
            const original = await sql<{ id: number }>`SELECT id_campaign_external_reference AS id FROM crm_campaign_external_reference WHERE external_id_campaign_external_reference='-5'`.execute(transaction);
            const query = { catalogCode: "campaigns" as const, search: input.name };
            expect(await repository.listCatalogItems(query)).toMatchObject({ total: 1, items: [{ publicId: item.publicId }] });
            expect(await repository.listCatalogItems({ ...query, offset: 1 })).toMatchObject({ total: 1, items: [] });
            await expect(repository.listCatalogItems({ ...query, limit: 0 })).rejects.toThrow();
            await expect(repository.createCatalogItem({ ...input, name: `${input.name}-duplicate` })).rejects.toThrow("belongs to another campaign");
            await repository.updateCatalogItem(item.publicId, { ...input, externalReferences: [] });
            await repository.updateCatalogItem(item.publicId, input);
            const restored = await sql<{ id: number }>`SELECT id_campaign_external_reference AS id FROM crm_campaign_external_reference WHERE external_id_campaign_external_reference='-5' AND deleted_at_campaign_external_reference IS NULL`.execute(transaction);
            expect(restored.rows).toEqual(original.rows);
            expect(await repository.updateCatalogItemStatus({ actorPublicId: input.actorPublicId, catalogCode: "campaigns", itemPublicId: item.publicId, reason: input.reason, status: "inactive" })).toMatchObject({ status: "inactive" });
            expect(await repository.listCatalogItems({ ...query, status: "active" })).toMatchObject({ total: 0 });
            const shared = await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_catalog_item WHERE catalog_code_catalog_item='campaigns'`.execute(transaction);
            expect(Number(shared.rows[0]?.total)).toBe(0);
        });
    }, 30_000);

    it("rolls back campaign creation and provider mappings when audit fails", async () => {
        await withRollback(async (_repository, transaction, input, service) => {
            const audit = new SecurityAuditService(service);
            vi.spyOn(audit, "record").mockRejectedValue(new Error("Audit unavailable"));
            const repository = new CampaignsRepository(service, audit);
            await expect(repository.createCatalogItem(input)).rejects.toThrow("Audit unavailable");
            const rows = await sql`SELECT id_campaign FROM crm_campaign WHERE name_campaign=${input.name}`.execute(transaction);
            expect(rows.rows).toEqual([]);
            const references = await sql`SELECT id_campaign_external_reference FROM crm_campaign_external_reference WHERE external_id_campaign_external_reference='-5'`.execute(transaction);
            expect(references.rows).toEqual([]);
        });
    }, 30_000);

    it("promotes a legacy campaign once and synchronizes edits/status on the same native transaction", async () => {
        await withRollback(async (_repository, transaction, input, service) => {
            const legacyId = 2147000000;
            const legacy = {
                enabled: () => true,
                find: vi.fn().mockResolvedValue({ publicId: `legacy:campaigns:${String(legacyId)}`, nativeCode: "legacy", name: input.name, detail: null, status: "inactive", updatedAt: "", externalReferences: input.externalReferences }),
                create: vi.fn(),
                update: vi.fn().mockResolvedValue(undefined),
            } satisfies CampaignsLegacyAccess;
            const repository = new CampaignsRepository(service, new SecurityAuditService(service), legacy);
            const item = await repository.updateCatalogItem(`legacy:campaigns:${String(legacyId)}`, input);
            expect(item).toMatchObject({ id_old_produccion: legacyId, status: "inactive", name: input.name });
            expect(item?.publicId).not.toContain("legacy:");
            expect(legacy.update).toHaveBeenCalledWith(service.db, legacyId, expect.objectContaining({ name: input.name, status: "inactive" }));
            const next = await repository.updateCatalogItem(`legacy:campaigns:${String(legacyId)}`, { ...input, detail: "Second edit" });
            expect(next?.publicId).toBe(item?.publicId);
            expect(legacy.find).toHaveBeenCalledOnce();
            expect(await repository.updateCatalogItemStatus({ ...input, itemPublicId: item?.publicId ?? "", status: "active" })).toMatchObject({ status: "active" });
            expect(legacy.update).toHaveBeenLastCalledWith(service.db, legacyId, expect.objectContaining({ status: "active" }));
            const rows = await sql`SELECT id_campaign FROM crm_campaign WHERE id_old_produccion_campaign=${legacyId}`.execute(transaction);
            expect(rows.rows).toHaveLength(1);
        });
    }, 30_000);

    it("persists the generated legacy ID on create and makes zero legacy calls after disabling", async () => {
        await withRollback(async (_repository, _transaction, input, service) => {
            let enabled = true;
            const legacy = { enabled: () => enabled, find: vi.fn(), create: vi.fn().mockResolvedValue(2147000000), update: vi.fn() } satisfies CampaignsLegacyAccess;
            const repository = new CampaignsRepository(service, new SecurityAuditService(service), legacy);
            const item = await repository.createCatalogItem(input);
            expect(item.id_old_produccion).toBe(2147000000);
            expect(legacy.create).toHaveBeenCalledWith(service.db, expect.objectContaining({ name: input.name }));
            enabled = false;
            expect(await repository.updateCatalogItem(item.publicId, input)).toMatchObject({ publicId: item.publicId });
            expect(legacy.update).not.toHaveBeenCalled();
            expect(legacy.find).not.toHaveBeenCalled();
            expect(await repository.updateCatalogItem("legacy:campaigns:2147000001", input)).toBeNull();
            expect(legacy.find).not.toHaveBeenCalled();
        });
    }, 30_000);

    it("rolls back promotion and provider mappings if legacy synchronization fails", async () => {
        await withRollback(async (_repository, transaction, input, service) => {
            const legacy = {
                enabled: () => true,
                find: vi.fn().mockResolvedValue({ name: input.name, detail: null, status: "active", externalReferences: input.externalReferences }),
                create: vi.fn(),
                update: vi.fn().mockRejectedValue(new Error("Legacy write failed")),
            } satisfies CampaignsLegacyAccess;
            const repository = new CampaignsRepository(service, new SecurityAuditService(service), legacy);
            await expect(repository.updateCatalogItem("legacy:campaigns:2147000000", input)).rejects.toThrow("Legacy write failed");
            expect((await sql`SELECT id_campaign FROM crm_campaign WHERE id_old_produccion_campaign=2147000000`.execute(transaction)).rows).toEqual([]);
            expect((await sql`SELECT id_campaign_external_reference FROM crm_campaign_external_reference WHERE external_id_campaign_external_reference='-5'`.execute(transaction)).rows).toEqual([]);
        });
    }, 30_000);

    it("rejects campaign inserts into the retired shared storage", async () => {
        await withRollback(async (_repository, transaction) => {
            await expect(sql`INSERT INTO crm_catalog_item (public_id_catalog_item,catalog_code_catalog_item,native_code_catalog_item,name_catalog_item) VALUES (${ulid()},'campaigns',${ulid()},'Must reject')`.execute(transaction)).rejects.toThrow();
        });
    }, 30_000);

    it("can rerun the campaign migration without seeding or changing domain data", async () => {
        const before = await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_campaign`.execute(database.db);
        await campaignsDomainMigration.up(database.db);
        const rows = await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_campaign`.execute(database.db);
        expect(rows.rows).toEqual(before.rows);
    }, 30_000);

    it.skipIf(process.env.CAMPAIGN_LEGACY_MYSQL_TESTS !== "1")(
        "creates, promotes and synchronizes both actual schemas with rollback-only fixtures",
        async () => {
            let fixtureName = "";
            await withRollback(async (_repository, transaction, input, service) => {
                const engines = await sql<{ ENGINE: string }>`SELECT ENGINE FROM information_schema.TABLES WHERE (TABLE_SCHEMA='CRM_THINK_V2' AND TABLE_NAME='crm_campaign') OR (TABLE_SCHEMA='crmdatabase-api' AND TABLE_NAME='campanas')`.execute(transaction);
                expect(engines.rows).toHaveLength(2);
                expect(engines.rows.every((row) => row.ENGINE === "InnoDB")).toBe(true);
                const writer = new LegacyCampaignsWriter(new ConfigService({ ENABLE_LEGACY_FALLBACK: true }));
                const repository = new CampaignsRepository(service, new SecurityAuditService(service), writer);
                fixtureName = input.name;
                // The legacy column is nullable: creation must not require a provider ID.
                const payload = { ...input, externalReferences: [] };
                const created = await repository.createCatalogItem(payload);
                expect(created.id_old_produccion).toBeGreaterThan(0);
                await repository.updateCatalogItemStatus({ ...payload, itemPublicId: created.publicId, status: "inactive" });
                const legacy = await writer.find(transaction, created.id_old_produccion ?? 0);
                expect(legacy).toMatchObject({ name: fixtureName, status: "inactive" });
                const oldId = await writer.create(transaction, { name: fixtureName + "-legacy", status: "active", externalReferences: [] });
                const promoted = await repository.updateCatalogItem(`legacy:campaigns:${String(oldId)}`, { ...payload, name: fixtureName + "-promoted" });
                expect(promoted).toMatchObject({ id_old_produccion: oldId, name: fixtureName + "-promoted" });
                expect(promoted?.publicId).not.toContain("legacy:");
                expect(await writer.find(transaction, oldId ?? 0)).toMatchObject({ name: fixtureName + "-promoted" });
            });
            expect((await sql`SELECT id_campaign FROM crm_campaign WHERE name_campaign LIKE ${fixtureName + "%"}`.execute(database.db)).rows).toEqual([]);
            expect((await sql`SELECT id_Campana FROM \`crmdatabase-api\`.campanas WHERE Nombre_Campana LIKE ${fixtureName + "%"}`.execute(database.db)).rows).toEqual([]);
        },
        30_000,
    );
});
