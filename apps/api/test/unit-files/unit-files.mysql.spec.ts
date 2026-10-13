import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { createLegacyCrmDatabase } from "../../src/integrations/legacy-crm/legacy-crm.config.js";
import { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { LegacyUnitFilesReader } from "../../src/integrations/legacy-crm/unit-files/legacy-unit-files.reader.js";
import { UNIT_COLUMNS } from "../../src/modules/crm/unit-files/unit-files.columns.js";
import { UNIT_FIELDS, type UnitFilter } from "../../src/modules/crm/unit-files/unit-files.contract.js";
import { UnitFilesRepository } from "../../src/modules/crm/unit-files/unit-files.repository.js";

describe.skipIf(process.env.UNIT_FILES_MYSQL_TESTS !== "1")("Unit Files live read-only source and rollback-native verification", () => {
    let native: DatabaseService;
    let legacy: LegacyCrmDatabaseService;
    let settings: ConfigService;
    beforeAll(() => {
        config({ quiet: true });
        settings = new ConfigService({ ...validateEnv(process.env), LEGACY_CRM_DB_NAME: "crmdatabase-api", ENABLE_LEGACY_FALLBACK: true });
        native = new DatabaseService(settings);
        legacy = new LegacyCrmDatabaseService(createLegacyCrmDatabase(settings));
    });
    afterAll(async () => {
        await native.onModuleDestroy();
        await legacy.onModuleDestroy();
    });

    it("queries bounded source rows through the native CRM project and retains all fields in detail", async () => {
        const columns = await sql<{ name: string; type: string; nullable: string }>`SELECT COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_unit_file'`.execute(native.db);
        for (const [key, column] of Object.entries(UNIT_COLUMNS)) {
            const field = UNIT_FIELDS[key as keyof typeof UNIT_FIELDS];
            expect(columns.rows.find((item) => item.name === column)).toMatchObject({ type: field.length === "TEXT" ? "text" : `varchar(${String(field.length)})`, nullable: "YES" });
        }
        const projects = await new UnitFilesRepository(native).projects();
        const project = projects.find((item) => item.name === "Amara");
        expect(project).toBeDefined();
        if (!project) throw new Error("Verified Amara mapping is required");
        const filter: UnitFilter = { projectIds: [project.id], moduleCode: "administration", limit: 50 };
        const reader = new LegacyUnitFilesReader(settings, legacy);
        const first = await reader.list(filter, [project], 0, 51);
        expect(first).toHaveLength(51);
        expect(first.every((row) => row.item.project.id === project.id)).toBe(true);
        expect(first.map((row) => Object.keys(row.item))).toContainEqual(expect.arrayContaining(["estimatedDelivery", "totalArea", "lotArea", "approximateParkingArea"]));
        const last = first[49];
        if (!last) throw new Error("Missing source page");
        const next = await reader.list(filter, [project], last.position, 51);
        expect(next.every((row) => row.position > last.position)).toBe(true);
        const detail = await reader.detail(last.position);
        expect(Object.keys(detail?.values ?? {})).toHaveLength(27);
        expect(detail?.project.id).toBe(project.id);
        await legacy.db.transaction().execute(async (transaction) => {
            const result = await sql<{ readOnly: number }>`SELECT @@transaction_read_only AS readOnly`.execute(transaction);
            expect(result.rows[0]?.readOnly).toBe(1);
        });
    }, 30_000);

    it("seeks distinct project-scoped source choices without downloading unit records", async () => {
        const project = (await new UnitFilesRepository(native).projects()).find((item) => item.name === "Amara");
        if (!project) throw new Error("Verified Amara mapping is required");
        const filter = { projectIds: [project.id], moduleCode: "administration", limit: 50 };
        const reader = new LegacyUnitFilesReader(settings, legacy);
        const choices = await reader.options({ ...filter, kind: "code" }, 3);
        expect(choices).toHaveLength(3);
        const after = choices[2];
        if (!after) throw new Error("Missing option continuation");
        const next = await reader.options({ ...filter, kind: "code", after }, 3);
        expect(next.every((value) => !choices.includes(value))).toBe(true);
        expect(await reader.options({ ...filter, kind: "housingType" }, 51)).toEqual(["A", "B", "C"]);
    }, 30_000);

    it("persists full native values and independent providers with mandatory project FK, then rolls back", async () => {
        const rollback = new Error("rollback-only unit fixture");
        const publicId = ulid();
        try {
            await native.db.transaction().execute(async (transaction) => {
                const identity = await sql<{ db: string }>`SELECT DATABASE() AS db`.execute(transaction);
                expect(identity.rows[0]?.db).toBe("CRM_THINK_V2");
                const project = (await sql<{ id: number; publicId: string }>`SELECT id_project AS id,public_id_project AS publicId FROM crm_project WHERE deleted_at_project IS NULL LIMIT 1`.execute(transaction)).rows[0];
                if (!project) throw new Error("Native project required");
                const fields = Object.values(UNIT_COLUMNS);
                await sql`INSERT INTO crm_unit_file (public_id_unit_file,native_code_unit_file,project_id_unit_file,${sql.join(fields.map((field) => sql.id(field)))}) VALUES (${publicId},${`unit_files_${publicId.toLowerCase()}`},${project.id},${sql.join(fields.map(() => "--"))})`.execute(transaction);
                const systems = await sql<{ id: number }>`SELECT id_external_system AS id FROM int_external_system WHERE status_external_system='active' LIMIT 2`.execute(transaction);
                for (const system of systems.rows) await sql`INSERT INTO crm_unit_file_external_reference(unit_file_id_unit_file_external_reference,external_system_id_unit_file_external_reference,external_id_unit_file_external_reference) SELECT id_unit_file,${system.id},${publicId} FROM crm_unit_file WHERE public_id_unit_file=${publicId}`.execute(transaction);
                const scoped = { db: transaction, onModuleDestroy: async () => {} } as DatabaseService;
                const repository = new UnitFilesRepository(scoped);
                const detail = await repository.detail(publicId);
                expect(Object.keys(detail?.values ?? {})).toHaveLength(27);
                expect(detail?.values.minimumSalePrice).toBe("--");
                expect(detail?.externalReferences).toHaveLength(2);
                expect(await repository.options({ projectIds: [project.publicId], moduleCode: "administration", limit: 50, kind: "code" }, 51)).toContain("--");
                expect((await repository.list({ projectIds: [project.publicId], moduleCode: "administration", limit: 50, code: "--" }, 0, 51)).some((row) => row.item.id === publicId)).toBe(true);
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
        expect((await sql`SELECT id_unit_file FROM crm_unit_file WHERE public_id_unit_file=${publicId}`.execute(native.db)).rows).toHaveLength(0);
    }, 30_000);

    it("turns the adapter off without taking any connection", async () => {
        settings.set("ENABLE_LEGACY_FALLBACK", false);
        const connection = vi.spyOn(legacy, "db", "get");
        const reader = new LegacyUnitFilesReader(settings, legacy);
        expect(await reader.detail(1)).toBeNull();
        expect(await reader.options({ projectIds: [], moduleCode: "administration", limit: 50, kind: "code" }, 51)).toEqual([]);
        expect(await reader.list({ projectIds: [], moduleCode: "administration", limit: 50 }, [], 0, 51)).toEqual([]);
        expect(connection).not.toHaveBeenCalled();
        connection.mockRestore();
    });
    it("executes the legacy anti-join against a native replacement without committing fixtures", async () => {
        settings.set("ENABLE_LEGACY_FALLBACK", true);
        const rollback = new Error("rollback anti-join fixture");
        try {
            await native.db.transaction().execute(async (transaction) => {
                const repository = new UnitFilesRepository({ db: transaction, onModuleDestroy: async () => {} });
                const project = (await repository.projects()).find((item) => item.name === "Amara");
                if (!project) throw new Error("Verified project required");
                // Same transaction sees the uncommitted native fixture; all legacy statements remain SELECT.
                const scoped = new Proxy(transaction, {
                    get(target, property) {
                        if (property === "transaction") return () => ({ execute: async (operation: (executor: unknown) => Promise<unknown>) => operation(transaction) });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                const reader = new LegacyUnitFilesReader(settings, new LegacyCrmDatabaseService(scoped as unknown as Kysely<unknown>));
                const filter = { projectIds: [project.id], moduleCode: "administration", limit: 50 };
                const first = (await reader.list(filter, [project], 0, 2))[0];
                if (!first) throw new Error("Legacy unit required");
                const publicId = ulid();
                await sql`INSERT INTO crm_unit_file(public_id_unit_file,native_code_unit_file,project_id_unit_file,id_old_produccion_unit_file) SELECT ${publicId},${`unit_files_${publicId.toLowerCase()}`},id_project,${first.position} FROM crm_project WHERE public_id_project=${project.id}`.execute(transaction);
                const remaining = await reader.list(filter, [project], 0, 2);
                expect(remaining).toHaveLength(2);
                expect(remaining.some((row) => row.position === first.position)).toBe(false);
                expect(await repository.findPromotedId(first.position)).toBe(publicId);
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    }, 30_000);
});
