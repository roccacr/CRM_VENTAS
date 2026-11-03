import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyBanksWriter } from "../../src/integrations/legacy-crm/legacy-banks.writer.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { BanksRepository } from "../../src/modules/crm/banks/banks.repository.js";
import type { Bank, BankAuditContext } from "../../src/modules/crm/banks/banks.types.js";

// Instancia exclusiva del coordinador; no carga .env ni acepta host/puerto del entorno.
// Usa SecurityAuditService real. RecordAudit comercial queda desactivado en esta fixture mínima.
describe.skipIf(process.env.RUN_BANKS_MYSQL_QA !== "3311")("Bancos: persistencia, mirror y auditoría SQL aislada", () => {
    let db: Kysely<CrmDatabase>;
    let repository: BanksRepository;
    let audit: SecurityAuditService;
    const createdIds = new Set<string>();
    function remember<T extends { publicId: string }>(record: T): T {
        createdIds.add(record.publicId);
        return record;
    }
    const context: BankAuditContext = { actorPublicId: "01K8M000000000000000000001", moduleCode: "formalizacion", reason: "Verificación QA aislada" };
    beforeAll(async () => {
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3311, user: "root", database: "CRM_THINK_V2", connectionLimit: 5, timezone: "Z" }) }) });
        const dir = (await sql<{ dir: string }>`SELECT @@datadir AS dir`.execute(db)).rows[0]?.dir;
        if (!dir?.includes("crm-banks-qa-20261103-3311")) throw new Error("Requiere datadir exclusivo Bancos QA");
        await sql`ALTER TABLE audit_security_event ADD COLUMN IF NOT EXISTS target_user_id_security_event BIGINT NULL,ADD COLUMN IF NOT EXISTS ip_address_security_event VARCHAR(80) NULL,ADD COLUMN IF NOT EXISTS user_agent_security_event VARCHAR(500) NULL,MODIFY COLUMN summary_security_event VARCHAR(255),MODIFY COLUMN reason_security_event VARCHAR(255)`.execute(db);
        // PK locales distintas demuestran que el espejo resuelve el banco por publicId.
        await sql`ALTER TABLE \`crmdatabase-api\`.crm_bank AUTO_INCREMENT=1000`.execute(db);
        const database = { db } as DatabaseService;
        audit = new SecurityAuditService(database, new RecordAuditService(database, new ConfigService({ ENABLE_RECORD_AUDIT: false })));
        repository = new BanksRepository(database, audit, new LegacyBanksWriter(new ConfigService({ ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true, LEGACY_CRM_DB_NAME: "crmdatabase-api" })));
    });
    afterAll(async () => {
        try {
            if (createdIds.size)
                await db.transaction().execute(async (tx) => {
                    const ids = [...createdIds];
                    await sql`DELETE FROM \`crmdatabase-api\`.crm_bank_advisor WHERE public_id_bank_advisor IN (${sql.join(ids)})`.execute(tx);
                    await sql`DELETE FROM crm_bank_advisor WHERE public_id_bank_advisor IN (${sql.join(ids)})`.execute(tx);
                    await sql`DELETE FROM \`crmdatabase-api\`.crm_bank WHERE public_id_bank IN (${sql.join(ids)})`.execute(tx);
                    await sql`DELETE FROM crm_bank WHERE public_id_bank IN (${sql.join(ids)})`.execute(tx);
                    await sql`DELETE FROM audit_security_event WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata_security_event,'$.changeSet.recordId')) IN (${sql.join(ids)})`.execute(tx);
                });
        } finally {
            await db.destroy();
        }
    });
    const bank = (label = "Banco QA") => repository.mutateBank(undefined, { kind: "create", name: `${label} ${randomUUID()}` }, context).then(remember);
    const advisor = (parent: Bank, email = `${randomUUID()}@example.invalid`) => repository.mutateAdvisor({ bankId: parent.publicId }, { kind: "create", name: "Ejecutivo QA", email, phone: "+506 8888 8888", area: "Crédito hipotecario" }, context).then(remember);
    async function mirror(publicId: string) {
        return (await sql<{ publicId: string; name: string; status: string; version: number }>`SELECT public_id_bank AS publicId,name_bank AS name,status_bank AS status,version_bank AS version FROM \`crmdatabase-api\`.crm_bank WHERE public_id_bank=${publicId}`.execute(db)).rows[0];
    }
    async function auditCount() {
        return Number((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM audit_security_event`.execute(db)).rows[0]?.total);
    }
    it("crea banco en ambas BD y audita actor/antes/después en nativo", async () => {
        const created = await bank();
        expect(await mirror(created.publicId)).toEqual({ publicId: created.publicId, name: created.name, status: "active", version: 1 });
        const row = (await sql<{ metadata: unknown }>`SELECT metadata_security_event AS metadata FROM audit_security_event WHERE event_type_security_event='catalog_bank_create' ORDER BY id_security_event DESC LIMIT 1`.execute(db)).rows[0];
        const metadata: unknown = typeof row?.metadata === "string" ? JSON.parse(row.metadata) : row?.metadata;
        expect(metadata).toMatchObject({ catalogCode: "banks", sectionCode: "catalogs", actor: { publicId: context.actorPublicId }, changeSet: { before: null, after: { name: created.name } } });
    });
    it("mantiene varios ejecutivos y FK locales correctas en ambas BD", async () => {
        const created = await bank();
        const first = await advisor(created);
        await advisor(created);
        expect((await repository.listAdvisors(created.publicId, { moduleCode: "formalizacion" })).total).toBe(2);
        const legacy = (await sql<{ bank: string; id: number }>`SELECT b.public_id_bank AS bank,a.bank_id_bank_advisor AS id FROM \`crmdatabase-api\`.crm_bank_advisor a JOIN \`crmdatabase-api\`.crm_bank b ON b.id_bank=a.bank_id_bank_advisor WHERE a.public_id_bank_advisor=${first.publicId}`.execute(db)).rows[0];
        expect(legacy?.bank).toBe(created.publicId);
        expect(Number(legacy?.id)).toBeGreaterThanOrEqual(1000);
    });
    it("edita los cuatro datos de contacto y conserva padre/versión/auditoría", async () => {
        const parent = await bank();
        const created = await advisor(parent);
        const changed = await repository.mutateAdvisor({ bankId: parent.publicId, advisorId: created.publicId }, { kind: "update", expectedVersion: 1, name: "Nombre actualizado", email: "actualizado@example.invalid", phone: "2222-3333", area: "Formalización" }, context);
        expect(changed).toMatchObject({ version: 2, bankPublicId: parent.publicId, name: "Nombre actualizado", email: "actualizado@example.invalid", phone: "2222-3333", area: "Formalización" });
        const legacy = (await sql<{ name: string; email: string; phone: string; area: string; version: number }>`SELECT name_bank_advisor AS name,email_bank_advisor AS email,phone_bank_advisor AS phone,area_bank_advisor AS area,version_bank_advisor AS version FROM \`crmdatabase-api\`.crm_bank_advisor WHERE public_id_bank_advisor=${created.publicId}`.execute(db)).rows[0];
        expect(legacy).toMatchObject({ name: changed.name, email: changed.email, phone: changed.phone, area: changed.area, version: 2 });
    });
    it("activa e inactiva ejecutivo sin borrar el registro", async () => {
        const parent = await bank();
        const created = await advisor(parent);
        const inactive = await repository.mutateAdvisor({ bankId: parent.publicId, advisorId: created.publicId }, { kind: "status", status: "inactive", expectedVersion: 1 }, context);
        expect(inactive).toMatchObject({ status: "inactive", version: 2 });
        const active = await repository.mutateAdvisor({ bankId: parent.publicId, advisorId: created.publicId }, { kind: "status", status: "active", expectedVersion: 2 }, context);
        expect(active).toMatchObject({ status: "active", version: 3 });
        expect((await sql<{ status: string; version: number }>`SELECT status_bank_advisor AS status,version_bank_advisor AS version FROM \`crmdatabase-api\`.crm_bank_advisor WHERE public_id_bank_advisor=${created.publicId}`.execute(db)).rows[0]).toEqual({ status: "active", version: 3 });
    });
    it("banco inactivo conserva ejecutivos y bloquea altas nuevas", async () => {
        const parent = await bank();
        const created = await advisor(parent);
        await repository.mutateBank(parent.publicId, { kind: "status", expectedVersion: 1, status: "inactive" }, context);
        await expect(advisor(parent)).rejects.toMatchObject({ status: 409 });
        expect((await repository.listAdvisors(parent.publicId, { moduleCode: "formalizacion" })).items[0]?.publicId).toBe(created.publicId);
        expect(await mirror(parent.publicId)).toMatchObject({ status: "inactive", version: 2 });
    });
    it("impide editar ejecutivo con identidad de otro banco", async () => {
        const parent = await bank();
        const other = await bank();
        const created = await advisor(parent);
        const count = await auditCount();
        await expect(repository.mutateAdvisor({ bankId: other.publicId, advisorId: created.publicId }, { kind: "status", expectedVersion: 1, status: "inactive" }, context)).rejects.toMatchObject({ status: 404 });
        expect(await auditCount()).toBe(count);
    });
    it("rechaza versión vieja sin sobrescribir datos ni duplicar auditoría", async () => {
        const created = await bank();
        await repository.mutateBank(created.publicId, { kind: "status", status: "inactive", expectedVersion: 1 }, context);
        const count = await auditCount();
        await expect(repository.mutateBank(created.publicId, { kind: "update", name: "Sobrescritura", expectedVersion: 1 }, context)).rejects.toMatchObject({ status: 409 });
        expect(await mirror(created.publicId)).toMatchObject({ name: created.name, status: "inactive", version: 2 });
        expect(await auditCount()).toBe(count);
    });
    it("rollback de ambas BD incluso cuando el auditor ya insertó y falla después", async () => {
        const created = await bank();
        const count = await auditCount();
        const original = audit.record.bind(audit);
        const spy = vi.spyOn(audit, "record").mockImplementationOnce(async (...args) => {
            await original(...args);
            throw new Error("Injected audit failure");
        });
        try {
            await expect(repository.mutateBank(created.publicId, { kind: "update", name: "No debe persistir", expectedVersion: 1 }, context)).rejects.toThrow("Injected audit failure");
        } finally {
            spy.mockRestore();
        }
        expect(await repository.getBank(created.publicId)).toMatchObject({ name: created.name, version: 1 });
        expect(await mirror(created.publicId)).toMatchObject({ name: created.name, version: 1 });
        expect(await auditCount()).toBe(count);
    });
    it("conflicto del espejo revierte el cambio nativo", async () => {
        const created = await bank();
        await sql`UPDATE \`crmdatabase-api\`.crm_bank SET version_bank=9 WHERE public_id_bank=${created.publicId}`.execute(db);
        const count = await auditCount();
        await expect(repository.mutateBank(created.publicId, { kind: "update", name: "No se aplica", expectedVersion: 1 }, context)).rejects.toMatchObject({ status: 409 });
        expect(await repository.getBank(created.publicId)).toMatchObject({ name: created.name, version: 1 });
        expect(await mirror(created.publicId)).toMatchObject({ name: created.name, version: 9 });
        expect(await auditCount()).toBe(count);
    });
    it("dos ediciones simultáneas solo aceptan una versión", async () => {
        const created = await bank();
        const count = await auditCount();
        const outcomes = await Promise.allSettled(["Uno", "Dos"].map((suffix) => repository.mutateBank(created.publicId, { kind: "update", name: `${created.name} ${suffix}`, expectedVersion: 1 }, context)));
        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
        expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
        const current = await repository.getBank(created.publicId);
        expect(current.version).toBe(2);
        expect(await mirror(created.publicId)).toMatchObject({ name: current.name, version: 2 });
        expect(await auditCount()).toBe(count + 1);
    });
    it("duplicados CI fallan pero correo puede pertenecer a otro banco", async () => {
        const parent = await bank();
        await expect(repository.mutateBank(undefined, { kind: "create", name: parent.name.toLowerCase() }, context)).rejects.toMatchObject({ status: 409 });
        await advisor(parent, "duplicado@example.invalid");
        await expect(advisor(parent, "DUPLICADO@example.invalid")).rejects.toMatchObject({ status: 409 });
        await expect(advisor(await bank(), "duplicado@example.invalid")).resolves.toMatchObject({ email: "duplicado@example.invalid" });
    });
    it("lista la colección completa mediante total, búsqueda y offset del servidor", async () => {
        const prefix = randomUUID();
        const names = ["A", "B", "C"].map((letter) => `${prefix} ${letter}`);
        for (const name of names) await repository.mutateBank(undefined, { kind: "create", name }, context).then(remember);
        const page = await repository.listBanks({ moduleCode: "formalizacion", search: prefix, limit: 1, offset: 1 });
        expect(page.total).toBe(3);
        expect(page.items.map(({ name }) => name)).toEqual([names[1]]);
    });
});
