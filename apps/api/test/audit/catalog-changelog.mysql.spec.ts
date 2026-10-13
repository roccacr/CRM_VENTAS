import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { AuditReadRepository } from "../../src/modules/crm/audit/audit-read.repository.js";
import { AuditReadService } from "../../src/modules/crm/audit/audit-read.service.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { BrokersRepository } from "../../src/modules/crm/brokers/brokers.repository.js";
import { CampaignsRepository } from "../../src/modules/crm/campaigns/campaigns.repository.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import { ClassesRepository } from "../../src/modules/crm/classes/classes.repository.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { LocationsRepository } from "../../src/modules/crm/locations/locations.repository.js";
import { ProjectsRepository } from "../../src/modules/crm/projects/projects.repository.js";
import { SubsidiariesRepository } from "../../src/modules/crm/subsidiaries/subsidiaries.repository.js";

describe.skipIf(process.env.AUDIT_MYSQL_TESTS !== "1")("transactional catalog changelog on CRM_THINK_V2 only", () => {
    let database: DatabaseService;
    beforeAll(() => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    const withRollback = async (run: (service: DatabaseService, actorPublicId: string, systemCode: string) => Promise<void>) => {
        const rollback = new Error("Rollback audit fixtures");
        try {
            await database.db.transaction().execute(async (transaction) => {
                const currentDatabase = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(transaction);
                expect(currentDatabase.rows[0]?.name).toBe("CRM_THINK_V2");
                const scoped: Transaction<CrmDatabase> = new Proxy(transaction, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (executor: Transaction<CrmDatabase>) => Promise<unknown>) => {
                                    await sql`SAVEPOINT audit_operation`.execute(transaction);
                                    try {
                                        const result = await operation(scoped);
                                        await sql`RELEASE SAVEPOINT audit_operation`.execute(transaction);
                                        return result;
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT audit_operation`.execute(transaction);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                const actorPublicId = ulid();
                const email = `${actorPublicId}@example.invalid`;
                await sql`INSERT INTO sec_user (public_id_user,email_user,normalized_email_user,display_name_user) VALUES (${actorPublicId},${email},${email},'Audit rollback actor')`.execute(transaction);
                const systemCode = `audit-${ulid()}`;
                await sql`INSERT INTO int_external_system (code_external_system,name_external_system,status_external_system) VALUES (${systemCode},'Audit rollback provider','active')`.execute(transaction);
                await run({ db: scoped, onModuleDestroy: async () => {} }, actorPublicId, systemCode);
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    };

    const catalogs = [
        ["projects", ProjectsRepository],
        ["campaigns", CampaignsRepository],
        ["classes", ClassesRepository],
        ["locations", LocationsRepository],
        ["subsidiaries", SubsidiariesRepository],
        ["brokers", BrokersRepository],
        ["files", CatalogsRepository],
    ] as const;

    it.each(catalogs)(
        "%s stores creation, exact edits, references, deactivate/reactivate and rolls back if audit fails",
        async (catalogCode, Repository) => {
            await withRollback(async (service, actorPublicId, systemCode) => {
                const audit = new SecurityAuditService(service);
                const repository = new Repository(service, audit);
                const externalId = ulid();
                const input = { actorPublicId, catalogCode, moduleCode: "administration" as const, name: "Original", reason: "Audit regression", externalReferences: [{ systemCode, externalId }] };
                const item = await repository.createCatalogItem(input);
                await repository.updateCatalogItem(item.publicId.toLowerCase(), { ...input, name: "Updated", detail: "New detail", externalReferences: [] });
                await repository.updateCatalogItemStatus({ actorPublicId, catalogCode, moduleCode: input.moduleCode, itemPublicId: item.publicId, reason: input.reason, status: "inactive" });
                await repository.updateCatalogItemStatus({ actorPublicId, catalogCode, moduleCode: input.moduleCode, itemPublicId: item.publicId, reason: input.reason, status: "active" });
                const rows = await service.db
                    .selectFrom("audit_security_event")
                    .select(["metadata_security_event as metadata", "event_type_security_event as eventType"])
                    .where("actor_user_id_security_event", "=", sql<number>`(SELECT id_user FROM sec_user WHERE public_id_user=${actorPublicId})`)
                    .orderBy("id_security_event")
                    .execute();
                const events = rows.map((row) => (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) as { changeSet: { recordId: string; action: string; before: unknown; after: unknown; changes: unknown[] } });
                expect(events).toHaveLength(4);
                expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ catalogCode, moduleCode: "administration", sectionCode: "catalogs" })]));
                expect(events[0]?.changeSet).toMatchObject({ recordId: item.publicId, action: "create", before: null, after: { name: "Original", status: "active", externalReferences: [{ systemCode, externalId, status: "active" }] } });
                expect(events[1]?.changeSet.changes).toContainEqual({ field: "name", before: "Original", after: "Updated" });
                expect(events.map((event) => event.changeSet.recordId)).toEqual([item.publicId, item.publicId, item.publicId, item.publicId]);
                expect(events[1]?.changeSet.changes).toContainEqual({ field: "externalReferences", before: [{ systemCode, externalId, status: "active" }], after: [] });
                expect(events[2]?.changeSet).toMatchObject({ action: "deactivate", changes: [{ field: "status", before: "active", after: "inactive" }] });
                expect(events[3]?.changeSet).toMatchObject({ action: "reactivate", changes: [{ field: "status", before: "inactive", after: "active" }] });
                const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] }) } as unknown as IdentityService;
                const reader = new AuditReadService(identity, new AuditReadRepository(service));
                const page = await reader.list("fixture", { moduleCode: "administration", sectionCode: "catalogs", catalogCode, limit: 10 });
                const event = page.items.find((entry) => entry.record.id === item.publicId && entry.eventType === "catalog_item_updated");
                if (!event) throw new Error("Persisted audit reference not readable");
                expect(event).toMatchObject({ actorName: "Audit rollback actor", actorRoles: [], moduleName: "Administración", sectionName: "Catálogos", record: { id: item.publicId, entity: "catalog", name: "Updated" }, action: "update" });
                expect(event).not.toHaveProperty("changeSet");
                const detail = await reader.detail("fixture", event.publicId);
                expect(detail.record).toEqual(event.record);
                expect(detail.changeSet?.changes).toContainEqual({ field: "name", before: "Original", after: "Updated" });
                vi.spyOn(audit, "record").mockRejectedValue(new Error("Audit unavailable"));
                await expect(repository.updateCatalogItem(item.publicId, { ...input, name: "Must roll back", externalReferences: [] })).rejects.toThrow("Audit unavailable");
                const result = await repository.listCatalogItems({ catalogCode, search: "Updated" });
                expect(result.items.find((record) => record.publicId === item.publicId)).toMatchObject({ name: "Updated" });
                const logs = await service.db
                    .selectFrom("audit_security_event")
                    .select("id_security_event")
                    .where("actor_user_id_security_event", "=", sql<number>`(SELECT id_user FROM sec_user WHERE public_id_user=${actorPublicId})`)
                    .execute();
                expect(logs).toHaveLength(4);
            });
        },
        30_000,
    );
});
