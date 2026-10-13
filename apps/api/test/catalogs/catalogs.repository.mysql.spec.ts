import { Session } from "node:inspector/promises";

import { BadRequestException, ConflictException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import { CatalogsService } from "../../src/modules/crm/catalogs/catalogs.service.js";
import type { CatalogMutationInput } from "../../src/modules/crm/catalogs/catalogs.types.js";
import { CreateCatalogItemDto, UpdateCatalogItemDto } from "../../src/modules/crm/catalogs/dto/catalog-items.dto.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";

// Explicit opt-in: these tests use .env, never migrate, and always roll back.
describe.skipIf(process.env.CATALOG_MYSQL_TESTS !== "1")("CatalogsRepository MySQL", () => {
    let database: DatabaseService;
    let initialized = false;
    const coverage = new Session();
    let coverageStarted = false;
    let actorPublicId: string;
    let systemCode: string;
    const rollback = new Error("rollback test fixtures");
    const fixturePrefix = `catalog-test-${ulid()}`;

    beforeAll(async () => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
        initialized = true;
        const actor = await database.db.selectFrom("sec_user").select("public_id_user").where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
        const system = await database.db.selectFrom("int_external_system").select("code_external_system").where("status_external_system", "=", "active").executeTakeFirstOrThrow();
        actorPublicId = actor.public_id_user;
        systemCode = system.code_external_system;
        const engines = await sql<{ ENGINE: string }>`SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('crm_catalog_item','crm_catalog_item_external_reference','audit_security_event')`.execute(database.db);
        expect(engines.rows).toHaveLength(3);
        expect(engines.rows.every((row) => row.ENGINE === "InnoDB")).toBe(true);
        const indexes = await sql<{ COLUMN_NAME: string }>`SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_catalog_item_external_reference' AND INDEX_NAME='uq_crm_catalog_item_external_reference' AND NON_UNIQUE=0 ORDER BY SEQ_IN_INDEX`.execute(database.db);
        expect(indexes.rows.map((row) => row.COLUMN_NAME)).toEqual(["catalog_code_catalog_item_external_reference", "external_system_id_catalog_item_external_reference", "external_id_catalog_item_external_reference"]);
        if (process.env.CATALOG_MYSQL_COVERAGE === "1") {
            coverage.connect();
            await coverage.post("Profiler.enable");
            await coverage.post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
            coverageStarted = true;
        }
    }, 30_000);

    afterAll(async () => {
        if (coverageStarted) {
            const result = await coverage.post("Profiler.takePreciseCoverage");
            const methods = result.result
                .filter((script) => script.url.endsWith("catalogs.repository.ts"))
                .flatMap((script) => script.functions)
                .filter((method) => ["listCatalogItems", "replaceExternalReferences", "insertExternalReferences", "assertExternalReferencesAreAvailable"].includes(method.functionName));
            expect(methods).toHaveLength(4);
            process.stdout.write(`Catalog persistence V8 block coverage: ${JSON.stringify(methods.map((method) => ({ method: method.functionName, coveredRanges: method.ranges.filter((range) => range.count > 0).length, totalRanges: method.ranges.length })))}\n`);
            await coverage.post("Profiler.stopPreciseCoverage");
            coverage.disconnect();
        }
        if (initialized) {
            const remaining = await database.db.selectFrom("crm_catalog_item").select("id_catalog_item").where("name_catalog_item", "like", `${fixturePrefix}%`).execute();
            expect(remaining).toEqual([]);
            await database.onModuleDestroy();
        }
    });

    const input = (suffix = ulid()): CatalogMutationInput => ({
        actorPublicId,
        catalogCode: "files",
        externalReferences: [{ systemCode, externalId: `${fixturePrefix}-${suffix}` }],
        name: `${fixturePrefix}-${suffix}`,
        reason: "Catalog reference integration regression",
    });

    const references = (transaction: Transaction<CrmDatabase>, publicId: string) => transaction.selectFrom("crm_catalog_item_external_reference as reference").innerJoin("crm_catalog_item as item", "item.id_catalog_item", "reference.catalog_item_id_catalog_item_external_reference").selectAll("reference").where("item.public_id_catalog_item", "=", publicId).orderBy("reference.id_catalog_item_external_reference").execute();

    const events = (transaction: Transaction<CrmDatabase>, publicId: string) =>
        transaction
            .selectFrom("audit_security_event")
            .selectAll()
            .where("event_type_security_event", "=", "catalog_item_updated")
            .where(sql<string>`JSON_UNQUOTE(JSON_EXTRACT(metadata_security_event, '$.itemPublicId'))`, "=", publicId)
            .execute();

    const withRollback = async (run: (repository: CatalogsRepository, transaction: Transaction<CrmDatabase>) => Promise<void>, hooks: { beforeReferenceInsert?: (transaction: Transaction<CrmDatabase>) => Promise<void> } = {}): Promise<void> => {
        try {
            await database.db.transaction().execute(async (transaction) => {
                // Savepoints preserve repository atomicity inside the rollback-only outer transaction.
                const scoped = new Proxy(transaction, {
                    get(target, property) {
                        if (property === "transaction") {
                            return () => ({
                                execute: async (operation: (executor: Transaction<CrmDatabase>) => Promise<unknown>) => {
                                    await sql`SAVEPOINT catalog_operation`.execute(transaction);
                                    try {
                                        const result = await operation(scoped);
                                        await sql`RELEASE SAVEPOINT catalog_operation`.execute(transaction);
                                        return result;
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT catalog_operation`.execute(transaction);
                                        throw error;
                                    }
                                },
                            });
                        }
                        if (property === "insertInto") {
                            return (table: string) => {
                                if (table !== "crm_catalog_item_external_reference") {
                                    return target.insertInto(table as "audit_security_event");
                                }
                                return {
                                    values: (values: Parameters<ReturnType<typeof target.insertInto<"crm_catalog_item_external_reference">>["values"]>[0]) => {
                                        const query = target.insertInto("crm_catalog_item_external_reference").values(values);
                                        return {
                                            executeTakeFirstOrThrow: async () => {
                                                await hooks.beforeReferenceInsert?.(transaction);
                                                return query.executeTakeFirstOrThrow();
                                            },
                                        };
                                    },
                                };
                            };
                        }
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                const service: DatabaseService = { db: scoped, onModuleDestroy: async () => {} };
                await run(new CatalogsRepository(service, new SecurityAuditService(service)), transaction);
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) {
                throw error;
            }
        }
    };

    it("pages a catalog with an authoritative total and stable order", async () => {
        await withRollback(async (repository) => {
            const first = await repository.createCatalogItem(input("page-a"));
            const second = await repository.createCatalogItem(input("page-b"));
            const query = { catalogCode: "files" as const, search: `${fixturePrefix}-page-`, limit: 1 };
            const page1 = await repository.listCatalogItems(query);
            const page2 = await repository.listCatalogItems({ ...query, offset: 1 });
            const end = await repository.listCatalogItems({ ...query, offset: 2 });
            expect(page1).toMatchObject({ total: 2, items: [{ publicId: first.publicId }] });
            expect(page2).toMatchObject({ total: 2, items: [{ publicId: second.publicId }] });
            expect(end).toMatchObject({ total: 2, items: [] });
            expect(await repository.listCatalogItems({ catalogCode: "files", search: query.search, status: "inactive" })).toMatchObject({ total: 0, items: [] });
            await expect(repository.listCatalogItems({ ...query, limit: 0 })).rejects.toBeInstanceOf(BadRequestException);
            await expect(repository.listCatalogItems({ ...query, catalogCode: "invalid" as "files" })).rejects.toBeInstanceOf(BadRequestException);
            await expect(repository.listCatalogItems({ ...query, offset: -1 })).rejects.toBeInstanceOf(BadRequestException);
        });
    }, 30_000);

    it("persists create and edits with unassigned Odoo, while enforcing configuration for real identifiers", async () => {
        await withRollback(async (repository, transaction) => {
            const identity = { getCurrentUser: () => Promise.resolve({ roles: [{ code: "owner", status: "active" }], user: { publicId: actorPublicId } }) } as unknown as IdentityService;
            const service = new CatalogsService(identity, repository);
            const pipe = new ValidationPipe({ transform: true, whitelist: true });
            const mutation = input();
            const create = (await pipe.transform({ ...mutation, moduleCode: "administration", externalReferences: [...mutation.externalReferences, { systemCode: "odoo", externalId: null }] }, { type: "body", metatype: CreateCatalogItemDto })) as CreateCatalogItemDto;
            const item = await service.createCatalogItem("test-session", "files", create);
            const original = await references(transaction, item.publicId);
            for (const externalId of [undefined, null, "", "   "]) {
                const update = (await pipe.transform({ moduleCode: "administration", name: `${mutation.name}-edited`, detail: "Changed project details", reason: mutation.reason, externalReferences: [...mutation.externalReferences, { systemCode: "odoo", externalId }] }, { type: "body", metatype: UpdateCatalogItemDto })) as UpdateCatalogItemDto;
                await expect(service.updateCatalogItem("test-session", "files", item.publicId, update)).resolves.toMatchObject({ name: `${mutation.name}-edited`, detail: "Changed project details", externalReferences: mutation.externalReferences });
                expect(await references(transaction, item.publicId)).toEqual(original);
            }
            expect(await events(transaction, item.publicId)).toHaveLength(4);
            await expect(repository.updateCatalogItem(item.publicId, { ...mutation, externalReferences: [{ systemCode: `${fixturePrefix}-unconfigured`, externalId: "123" }] })).rejects.toBeInstanceOf(BadRequestException);
            expect(await references(transaction, item.publicId)).toEqual(original);
            expect(await events(transaction, item.publicId)).toHaveLength(4);
        });
    }, 30_000);

    it("preserves reference identity across name changes and repeated edits, with audit", async () => {
        await withRollback(async (repository, transaction) => {
            const mutation = input();
            const item = await repository.createCatalogItem(mutation);
            const original = await references(transaction, item.publicId);
            for (const name of [`${mutation.name}-edited`, `${mutation.name}-again`]) {
                const updated = await repository.updateCatalogItem(item.publicId, { ...mutation, name });
                expect(updated?.name).toBe(name);
                expect(await references(transaction, item.publicId)).toEqual(original);
            }
            const audit = await events(transaction, item.publicId);
            expect(audit).toHaveLength(2);
            expect(audit.every((event) => event.reason_security_event === mutation.reason && event.actor_user_id_security_event !== null)).toBe(true);
        });
    }, 30_000);

    it("adds, removes, and restores references without replacing their rows", async () => {
        await withRollback(async (repository, transaction) => {
            const mutation = input();
            const item = await repository.createCatalogItem(mutation);
            const original = (await references(transaction, item.publicId))[0];
            if (!original) {
                throw new Error("Missing fixture reference");
            }
            const extra = { systemCode, externalId: `${fixturePrefix}-${ulid()}` };
            await repository.updateCatalogItem(item.publicId, { ...mutation, externalReferences: [...mutation.externalReferences, extra] });
            expect(await references(transaction, item.publicId)).toHaveLength(2);
            const removed = await repository.updateCatalogItem(item.publicId, { ...mutation, externalReferences: [extra] });
            expect(removed).toMatchObject({ externalReferences: [{ externalId: extra.externalId }] });
            expect((await references(transaction, item.publicId))[0]?.deleted_at_catalog_item_external_reference).not.toBeNull();
            const restored = await repository.updateCatalogItem(item.publicId, mutation);
            expect(restored).toMatchObject({ externalReferences: mutation.externalReferences });
            const rows = await references(transaction, item.publicId);
            expect(rows).toHaveLength(2);
            expect(rows[0]?.id_catalog_item_external_reference).toBe(original.id_catalog_item_external_reference);
            expect(rows[0]?.deleted_at_catalog_item_external_reference).toBeNull();
            expect(rows[0]?.status_catalog_item_external_reference).toBe("active");
            expect(rows[1]?.deleted_at_catalog_item_external_reference).not.toBeNull();
        });
    }, 30_000);

    it("rejects active and removed references owned by another item without partial changes", async () => {
        await withRollback(async (repository, transaction) => {
            const ownerInput = input();
            const owner = await repository.createCatalogItem(ownerInput);
            await expect(repository.createCatalogItem({ ...ownerInput, name: `${ownerInput.name}-duplicate` })).rejects.toMatchObject({ status: 409 });
            expect(await transaction.selectFrom("crm_catalog_item").select("id_catalog_item").where("name_catalog_item", "=", `${ownerInput.name}-duplicate`).execute()).toEqual([]);
            const targetInput = input();
            const target = await repository.createCatalogItem(targetInput);
            for (const removed of [false, true]) {
                if (removed) {
                    await repository.updateCatalogItem(owner.publicId, { ...ownerInput, externalReferences: [] });
                }
                await expect(repository.updateCatalogItem(target.publicId, { ...targetInput, name: `${targetInput.name}-changed`, externalReferences: ownerInput.externalReferences })).rejects.toBeInstanceOf(ConflictException);
                const persisted = await transaction.selectFrom("crm_catalog_item").select("name_catalog_item").where("public_id_catalog_item", "=", target.publicId).executeTakeFirstOrThrow();
                expect(persisted.name_catalog_item).toBe(targetInput.name);
                expect(await events(transaction, target.publicId)).toEqual([]);
                expect(await references(transaction, owner.publicId)).toHaveLength(1);
            }
        });
    }, 30_000);

    it("rolls back item and references when the real audit insert fails", async () => {
        await withRollback(async (repository, transaction) => {
            await sql`SET SESSION sql_mode = 'STRICT_TRANS_TABLES'`.execute(transaction);
            const mutation = input();
            const item = await repository.createCatalogItem(mutation);
            const original = await references(transaction, item.publicId);
            await expect(repository.updateCatalogItem(item.publicId, { ...mutation, name: `${mutation.name}-changed`, externalReferences: [], reason: "x".repeat(10_000) })).rejects.toMatchObject({ code: "ER_DATA_TOO_LONG" });
            expect(await references(transaction, item.publicId)).toEqual(original);
            expect(await events(transaction, item.publicId)).toEqual([]);
            const persisted = await transaction.selectFrom("crm_catalog_item").select("name_catalog_item").where("public_id_catalog_item", "=", item.publicId).executeTakeFirstOrThrow();
            expect(persisted.name_catalog_item).toBe(mutation.name);
        });
    }, 30_000);

    it("translates a database uniqueness race to conflict and rolls back the mutation", async () => {
        const hooks: { beforeReferenceInsert?: (transaction: Transaction<CrmDatabase>) => Promise<void> } = {};
        await withRollback(async (repository, transaction) => {
            const owner = await repository.createCatalogItem(input());
            const ownerRows = await references(transaction, owner.publicId);
            const ownerReference = ownerRows[0];
            if (!ownerReference) {
                throw new Error("Missing fixture reference");
            }
            const targetInput = { ...input(), externalReferences: [] };
            const target = await repository.createCatalogItem(targetInput);
            const candidate = `${fixturePrefix}-${ulid()}`;
            // Insert a competing claim after the lookup, forcing the actual MySQL unique constraint.
            hooks.beforeReferenceInsert = async (executor) => {
                const { id_catalog_item_external_reference: _id, ...claim } = ownerReference;
                await executor
                    .insertInto("crm_catalog_item_external_reference")
                    .values({ ...claim, external_id_catalog_item_external_reference: candidate })
                    .execute();
            };
            await expect(repository.updateCatalogItem(target.publicId, { ...targetInput, name: `${targetInput.name}-changed`, externalReferences: [{ systemCode, externalId: candidate }] })).rejects.toBeInstanceOf(ConflictException);
            expect(await references(transaction, owner.publicId)).toEqual(ownerRows);
            expect(await references(transaction, target.publicId)).toEqual([]);
            expect(await events(transaction, target.publicId)).toEqual([]);
            const persisted = await transaction.selectFrom("crm_catalog_item").select("name_catalog_item").where("public_id_catalog_item", "=", target.publicId).executeTakeFirstOrThrow();
            expect(persisted.name_catalog_item).toBe(targetInput.name);
        }, hooks);
    }, 30_000);
});
