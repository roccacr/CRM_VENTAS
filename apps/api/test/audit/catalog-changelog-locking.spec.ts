import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { AuditChangeSet } from "../../src/modules/crm/audit/audit-change-set.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { BrokersRepository } from "../../src/modules/crm/brokers/brokers.repository.js";
import { CampaignsRepository } from "../../src/modules/crm/campaigns/campaigns.repository.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import { ClassesRepository } from "../../src/modules/crm/classes/classes.repository.js";
import { LocationsRepository } from "../../src/modules/crm/locations/locations.repository.js";
import { ProjectsRepository } from "../../src/modules/crm/projects/projects.repository.js";
import { SubsidiariesRepository } from "../../src/modules/crm/subsidiaries/subsidiaries.repository.js";

const catalogs = [
    ["projects", ProjectsRepository],
    ["campaigns", CampaignsRepository],
    ["classes", ClassesRepository],
    ["locations", LocationsRepository],
    ["subsidiaries", SubsidiariesRepository],
    ["brokers", BrokersRepository],
    ["files", CatalogsRepository],
] as const;

describe("mutation snapshots use current relation reads, not repeatable-read snapshots", () => {
    it.each(catalogs)("%s audits the latest committed reference", async (catalogCode, Repository) => {
        const queries: string[] = [];
        let referencesArchived = false;
        class RecordingDriver extends DummyDriver {
            override async acquireConnection() {
                const connection = await super.acquireConnection();
                connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                    queries.push(query.sql);
                    if (/^update .*external_reference/i.test(query.sql)) referencesArchived = true;
                    let rows: unknown[] = [{ id: 1, id_user: 1, publicId: "canonical-id", nativeCode: "native", name: "Original", detail: null, status: "active", updatedAt: "2026-10-13T12:00:00Z", legacyId: null }];
                    if (/^select[\s\S]*external_reference[\s\S]*join/i.test(query.sql)) {
                        rows = referencesArchived ? [] : [{ projectId: 1, campaignId: 1, classId: 1, locationId: 1, subsidiaryId: 1, brokerId: 1, catalogItemId: 1, externalId: /for update/i.test(query.sql) ? "LATEST" : "STALE", systemCode: "provider", systemName: "Provider", status: "active" }];
                    }
                    return Promise.resolve({ rows: rows as R[] });
                };
                return connection;
            }
        }
        const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new RecordingDriver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
        const service = { db } as DatabaseService;
        const audit = new SecurityAuditService(service);
        const record = vi.spyOn(audit, "record").mockResolvedValue(undefined);
        try {
            await new Repository(service, audit).updateCatalogItem("canonical-id", { actorPublicId: "actor", catalogCode, name: "Updated", reason: "Regression", externalReferences: [] });
            const changeSet = record.mock.calls[0]?.[0].metadata?.changeSet as AuditChangeSet | undefined;
            expect(changeSet?.before?.externalReferences).toEqual([{ externalId: "LATEST", systemCode: "provider", status: "active" }]);
            expect(changeSet?.after?.externalReferences).toEqual([]);
            expect(queries.filter((query) => /^select[\s\S]*external_reference[\s\S]*join/i.test(query)).every((query) => /for update/i.test(query))).toBe(true);
        } finally {
            await db.destroy();
        }
    });
});
