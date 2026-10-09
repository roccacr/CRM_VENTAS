import { ConfigService } from "@nestjs/config";
import { sql } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { syncProjects } from "../../scripts/sync-legacy-projects.js";
import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";

describe.skipIf(process.env.PROJECT_SYNC_MYSQL_TESTS !== "1")("project sync real MySQL rollback-only", () => {
    let database: DatabaseService;
    beforeAll(() => {
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    it("inserts, skips repeat imports, and updates without changing identity", async () => {
        const rollback = new Error("rollback fixtures");
        const externalId = `sync-test-${ulid()}`;
        const projects = [{ externalId, name: "Project sync test", status: "active" as const, legacyIds: [29, 35] }];
        await expect(
            database.db.transaction().execute(async (transaction) => {
                const audit = new SecurityAuditService(database);
                expect(await syncProjects(transaction, projects, "rzuniga@roccacr.com", audit)).toEqual({ inserted: 1, updated: 0, skipped: 0 });
                const first = await transaction.selectFrom("crm_catalog_item_external_reference").selectAll().where("external_id_catalog_item_external_reference", "=", externalId).executeTakeFirstOrThrow();
                const legacy = await transaction.selectFrom("int_external_system").select("id_external_system").where("code_external_system", "=", "legacy_crm").executeTakeFirstOrThrow();
                await transaction
                    .insertInto("crm_catalog_item_external_reference")
                    .values({
                        catalog_item_id_catalog_item_external_reference: first.catalog_item_id_catalog_item_external_reference,
                        catalog_code_catalog_item_external_reference: "projects",
                        external_system_id_catalog_item_external_reference: legacy.id_external_system,
                        external_id_catalog_item_external_reference: externalId,
                        status_catalog_item_external_reference: "active",
                        metadata_catalog_item_external_reference: null,
                        created_at_catalog_item_external_reference: new Date(),
                        updated_at_catalog_item_external_reference: new Date(),
                    })
                    .executeTakeFirstOrThrow();
                expect(await syncProjects(transaction, projects, "rzuniga@roccacr.com", audit)).toEqual({ inserted: 0, updated: 0, skipped: 1 });
                expect(await syncProjects(transaction, [{ externalId, legacyIds: [29, 35], name: "Updated project", status: "inactive" }], "rzuniga@roccacr.com", audit)).toEqual({ inserted: 0, updated: 1, skipped: 0 });
                const after = await transaction.selectFrom("crm_catalog_item_external_reference").selectAll().where("external_id_catalog_item_external_reference", "=", externalId).executeTakeFirstOrThrow();
                expect(after.id_catalog_item_external_reference).toBe(first.id_catalog_item_external_reference);
                expect(after.catalog_item_id_catalog_item_external_reference).toBe(first.catalog_item_id_catalog_item_external_reference);
                const item = await transaction.selectFrom("crm_catalog_item").selectAll().where("id_catalog_item", "=", after.catalog_item_id_catalog_item_external_reference).executeTakeFirstOrThrow();
                expect(item.name_catalog_item).toBe("Updated project");
                expect(item.status_catalog_item).toBe("inactive");
                expect(item.inactivated_at_catalog_item).not.toBeNull();
                const refs = await transaction.selectFrom("crm_catalog_item_external_reference").selectAll().where("catalog_item_id_catalog_item_external_reference", "=", item.id_catalog_item).execute();
                expect(refs).toHaveLength(2);
                const audits = await transaction
                    .selectFrom("audit_security_event")
                    .select("event_type_security_event")
                    .where(sql<string>`JSON_UNQUOTE(JSON_EXTRACT(metadata_security_event, '$.itemPublicId'))`, "=", item.public_id_catalog_item)
                    .execute();
                expect(audits.map((event) => event.event_type_security_event).sort()).toEqual(["catalog_item_created", "catalog_item_updated"]);
                await transaction.updateTable("crm_catalog_item_external_reference").set({ deleted_at_catalog_item_external_reference: new Date() }).where("id_catalog_item_external_reference", "=", first.id_catalog_item_external_reference).execute();
                await expect(syncProjects(transaction, projects, "rzuniga@roccacr.com", audit)).rejects.toThrow("Archived");
                throw rollback;
            }),
        ).rejects.toBe(rollback);
        expect(await database.db.selectFrom("crm_catalog_item_external_reference").selectAll().where("external_id_catalog_item_external_reference", "=", externalId).execute()).toEqual([]);
    });

    it("rolls back the complete batch when audit fails", async () => {
        const externalId = `sync-test-${ulid()}`;
        const audit = new SecurityAuditService(database);
        const failure = new Error("audit failure");
        const record = audit.record.bind(audit);
        vi.spyOn(audit, "record").mockImplementationOnce(record).mockRejectedValue(failure);
        await expect(
            database.db.transaction().execute((transaction) =>
                syncProjects(
                    transaction,
                    [
                        { externalId, name: "Rollback project", status: "active", legacyIds: [1] },
                        { externalId: `${externalId}-second`, name: "Rollback second project", status: "inactive", legacyIds: [2] },
                    ],
                    "rzuniga@roccacr.com",
                    audit,
                ),
            ),
        ).rejects.toBe(failure);
        expect(await database.db.selectFrom("crm_catalog_item_external_reference").selectAll().where("external_id_catalog_item_external_reference", "=", externalId).execute()).toEqual([]);
        expect(await database.db.selectFrom("crm_catalog_item").selectAll().where("name_catalog_item", "=", "Rollback project").execute()).toEqual([]);
        expect(await database.db.selectFrom("crm_catalog_item").selectAll().where("name_catalog_item", "=", "Rollback second project").execute()).toEqual([]);
        expect(
            await database.db
                .selectFrom("audit_security_event")
                .selectAll()
                .where(sql<string>`JSON_UNQUOTE(JSON_EXTRACT(metadata_security_event, '$.externalId'))`, "=", externalId)
                .execute(),
        ).toEqual([]);
    });
});
