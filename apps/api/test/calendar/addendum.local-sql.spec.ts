import { randomUUID } from "node:crypto";

import { Kysely, MysqlDialect, sql, type Transaction } from "kysely";
import { createPool } from "mysql2";
import { ulid } from "ulid";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { RecordAuditInput, RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import type { CalendarInput, CalendarUpdate } from "../../src/modules/crm/calendar/calendar.contract.js";
import { CalendarRepository } from "../../src/modules/crm/calendar/calendar.repository.js";
import { CalendarService } from "../../src/modules/crm/calendar/calendar.service.js";
import type { AddendumIdentity, AddendumOrder, SalesOrderAddendumLegacy } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.port.js";
import { SalesOrderAddendumRepository } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.repository.js";

const orderId = ulid();
const leadId = ulid();
const typeId = ulid();
const nativeTables = ["crm_calendar_event_link", "crm_calendar_participant", "crm_calendar_event", "audit_record_event", "audit_record", "crm_sales_order", "crm_lead"];
const statements = [
    "CREATE TABLE sec_user (id_user INT PRIMARY KEY,public_id_user VARCHAR(26) UNIQUE,status_user VARCHAR(16),deleted_at_user DATETIME NULL) ENGINE=InnoDB",
    "CREATE TABLE sec_org_unit (id_org_unit INT PRIMARY KEY,code_org_unit VARCHAR(32),status_org_unit VARCHAR(16),deleted_at_org_unit DATETIME NULL) ENGINE=InnoDB",
    "CREATE TABLE conf_calendar_event_type (id_calendar_event_type INT PRIMARY KEY,public_id_calendar_event_type VARCHAR(26),module_id_calendar_event_type INT,code_calendar_event_type VARCHAR(32),status_calendar_event_type VARCHAR(16),form_key_calendar_event_type VARCHAR(80)) ENGINE=InnoDB",
    "CREATE TABLE crm_lead (id_lead INT PRIMARY KEY,public_id_lead VARCHAR(26),deleted_at_lead DATETIME NULL) ENGINE=InnoDB",
    "CREATE TABLE crm_sales_order (id_sales_order INT PRIMARY KEY,public_id_sales_order VARCHAR(26) UNIQUE,id_old_produccion_sales_order INT NULL,lead_id_sales_order INT,status_sales_order VARCHAR(16),cancelled_sales_order VARCHAR(8),deleted_at_sales_order DATETIME NULL,addendum_status_sales_order ENUM('pending','completed','cancelled') NULL,addendum_version_sales_order INT UNSIGNED NOT NULL DEFAULT 0,addendum_changed_at_sales_order DATETIME(3) NULL,addendum_note_sales_order TEXT NULL,updated_by_user_id_sales_order INT NULL,updated_at_sales_order DATETIME(3) NULL) ENGINE=InnoDB",
    "CREATE TABLE int_external_system (id_external_system INT PRIMARY KEY,code_external_system VARCHAR(32),status_external_system VARCHAR(16)) ENGINE=InnoDB",
    "CREATE TABLE crm_sales_order_external_reference (sales_order_id_sales_order_external_reference INT,external_system_id_sales_order_external_reference INT,external_id_sales_order_external_reference VARCHAR(32),status_sales_order_external_reference VARCHAR(16)) ENGINE=InnoDB",
    "CREATE TABLE crm_calendar_event (id_calendar_event INT AUTO_INCREMENT PRIMARY KEY,public_id_calendar_event VARCHAR(26) UNIQUE,type_id_calendar_event INT,origin_module_id_calendar_event INT,organizer_user_id_calendar_event INT,title_calendar_event VARCHAR(250),description_calendar_event TEXT NULL,location_calendar_event VARCHAR(250) NULL,starts_at_calendar_event DATETIME(3),ends_at_calendar_event DATETIME(3),all_day_calendar_event INT,status_calendar_event VARCHAR(16) DEFAULT 'scheduled',version_calendar_event INT DEFAULT 1,invitation_version_calendar_event INT DEFAULT 1,details_calendar_event JSON,timezone_calendar_event VARCHAR(80),legacy_calendar_id_calendar_event INT NULL,color_override_calendar_event VARCHAR(32) NULL,cancellation_reason_calendar_event TEXT NULL,created_by_user_id_calendar_event INT,updated_by_user_id_calendar_event INT,deleted_at_calendar_event DATETIME NULL) ENGINE=InnoDB",
    "CREATE TABLE crm_calendar_event_link (id_calendar_event_link INT AUTO_INCREMENT PRIMARY KEY,event_id_calendar_event_link INT,entity_type_calendar_event_link VARCHAR(32),source_calendar_event_link VARCHAR(16),entity_public_id_calendar_event_link VARCHAR(32),created_by_user_id_calendar_event_link INT,deleted_at_calendar_event_link DATETIME(3) NULL,UNIQUE KEY uq_link(event_id_calendar_event_link,entity_type_calendar_event_link,source_calendar_event_link,entity_public_id_calendar_event_link),KEY ix_entity(entity_type_calendar_event_link,entity_public_id_calendar_event_link,deleted_at_calendar_event_link,event_id_calendar_event_link)) ENGINE=InnoDB",
    "CREATE TABLE crm_calendar_participant (id_calendar_participant INT AUTO_INCREMENT PRIMARY KEY,event_id_calendar_participant INT,user_id_calendar_participant INT NULL,external_email_calendar_participant VARCHAR(250) NULL,status_calendar_participant VARCHAR(16),revoked_at_calendar_participant DATETIME NULL) ENGINE=InnoDB",
    "CREATE TABLE audit_record (id_record INT AUTO_INCREMENT PRIMARY KEY,entity_type_record VARCHAR(32),source_schema_record VARCHAR(80),source_table_record VARCHAR(80),source_id_record VARCHAR(32),UNIQUE KEY uq_record(entity_type_record,source_schema_record,source_table_record,source_id_record)) ENGINE=InnoDB",
    "CREATE TABLE audit_record_event (id_record_event INT AUTO_INCREMENT PRIMARY KEY,record_id_record_event INT,actor_reference_record_event VARCHAR(26),operation_id_record_event VARCHAR(100),after_record_event JSON,UNIQUE KEY uq_operation(record_id_record_event,operation_id_record_event)) ENGINE=InnoDB",
];

/** Repositorios reales sobre InnoDB. Auditor y puerto legacy de fixture: no prueban ACL ni el esquema productivo. */
describe.skipIf(process.env.ADDENDUM_LOCAL_SQL_TESTS !== "1")("Adéndum atómico en dos esquemas QA propios, MariaDB local", () => {
    const created = new Set<string>();
    const nonce = `${String(process.pid)}_${String(Date.now())}`;
    const nativeSchema = `codex_addendum_qa_${nonce}_native`;
    const legacySchema = `codex_addendum_qa_${nonce}_legacy`;
    let admin: Kysely<unknown>;
    let db: Kysely<CrmDatabase>;
    let calendar: CalendarRepository;
    let service: CalendarService;
    let addendum: SalesOrderAddendumRepository;
    let failCalendarAudit = false;
    let failOrderAudit = false;

    beforeAll(async () => {
        admin = new Kysely({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3309, user: "root", connectionLimit: 1 }) }) });
        const server = (await sql<{ path: string; port: number }>`SELECT @@datadir AS path,@@port AS port`.execute(admin)).rows[0];
        if (server?.port !== 3309 || !server.path.replaceAll("\\", "/").includes("/netsuite-events-mariadb-20261102/")) throw new Error("Requires dedicated disposable local SQL instance");
        for (const name of [nativeSchema, legacySchema]) {
            if (!/^codex_addendum_qa_\d+_\d+_(native|legacy)$/.test(name)) throw new Error("Unsafe QA schema");
            // CREATE sin IF NOT EXISTS: un esquema ajeno nunca pasa a formar parte del cleanup.
            await sql`CREATE DATABASE ${sql.id(name)}`.execute(admin);
            created.add(name);
        }
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3309, user: "root", database: nativeSchema, connectionLimit: 5 }) }) });
        for (const statement of statements) await sql.raw(statement).execute(db);
        await sql`CREATE TABLE ${sql.table(`${legacySchema}.ordenventa`)} (id_ov INT PRIMARY KEY,id_lead INT,estado_adendum_ov ENUM('pending','completed','cancelled') NULL,version_adendum_ov INT UNSIGNED DEFAULT 0,fecha_adendum_ov DATETIME(3) NULL,nota_adendum_ov TEXT NULL) ENGINE=InnoDB`.execute(db);
        await sql`INSERT INTO sec_user VALUES (1,'actor-one','active',NULL),(2,'actor-two','active',NULL)`.execute(db);
        await sql`INSERT INTO sec_org_unit VALUES (1,'formalizacion','active',NULL)`.execute(db);
        await sql`INSERT INTO conf_calendar_event_type VALUES (1,${typeId},1,'adendum','active','formalizacion.general.v1')`.execute(db);
        const audit = {
            enabled: true,
            captureActor: async (tx: Transaction<CrmDatabase>, actorId: number) => {
                const row = (await sql<{ publicId: string }>`SELECT public_id_user AS publicId FROM sec_user WHERE id_user=${actorId}`.execute(tx)).rows[0];
                if (!row) throw new Error("Fixture actor missing");
                return { publicId: row.publicId, name: row.publicId, roles: [] };
            },
            append: async (tx: Transaction<CrmDatabase>, input: RecordAuditInput) => {
                if (failCalendarAudit && input.source.entity === "calendar_event") throw new Error("Injected calendar audit failure");
                if (failOrderAudit && input.source.entity === "sales_order") throw new Error("Injected order audit failure");
                await sql`INSERT INTO audit_record (entity_type_record,source_schema_record,source_table_record,source_id_record) VALUES (${input.source.entity},${input.source.schema},${input.source.table},${input.source.id}) ON DUPLICATE KEY UPDATE id_record=LAST_INSERT_ID(id_record)`.execute(tx);
                const row = (await sql<{ id: number }>`SELECT id_record AS id FROM audit_record WHERE entity_type_record=${input.source.entity} AND source_schema_record=${input.source.schema} AND source_table_record=${input.source.table} AND source_id_record=${input.source.id} FOR UPDATE`.execute(tx)).rows[0];
                if (!row) throw new Error("Fixture audit record missing");
                await sql`INSERT INTO audit_record_event (record_id_record_event,actor_reference_record_event,operation_id_record_event,after_record_event) VALUES (${row.id},${input.actor.publicId},${input.operationId},${JSON.stringify(input.after)})`.execute(tx);
                return { publicId: ulid(), sequence: 1, replayed: false };
            },
        } as unknown as RecordAuditService;
        const legacy: SalesOrderAddendumLegacy = {
            countPending: async (tx) => Number((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM ${sql.table(`${legacySchema}.ordenventa`)} WHERE estado_adendum_ov='pending'`.execute(tx)).rows[0]?.total),
            read: async (tx, id, lock) => {
                const ending = lock ? sql`FOR UPDATE` : sql``;
                const row = (await sql<{ id: string; leadId: string; status: AddendumOrder["status"]; version: number; changedAt: string | null; note: string | null }>`SELECT CAST(id_ov AS CHAR) AS id,CAST(id_lead AS CHAR) AS leadId,estado_adendum_ov AS status,version_adendum_ov AS version,fecha_adendum_ov AS changedAt,nota_adendum_ov AS note FROM ${sql.table(`${legacySchema}.ordenventa`)} WHERE id_ov=${id} ${ending}`.execute(tx)).rows[0];
                return row ? { ...row, source: "legacy", internalId: row.id, active: true, lead: { source: "legacy", id: row.leadId } } : undefined;
            },
            write: async (tx, order, next) => {
                await sql`UPDATE ${sql.table(`${legacySchema}.ordenventa`)} SET estado_adendum_ov=${next.status},version_adendum_ov=${next.version},fecha_adendum_ov=${next.changedAt.slice(0, 23).replace("T", " ")},nota_adendum_ov=${next.note} WHERE id_ov=${order.id}`.execute(tx);
            },
        };
        const database = { db } as DatabaseService;
        calendar = new CalendarRepository(database, audit);
        addendum = new SalesOrderAddendumRepository(database, audit, legacy);
        service = new CalendarService(
            { getCurrentUser: (actor: string) => Promise.resolve({ user: { publicId: actor }, roles: [], orgUnits: [{ code: "formalizacion", status: "active" }], permissions: ["read", "create", "update", "assign_lead"].map((action) => ({ code: `formalizacion.calendar.${action}`, effect: "allow", scope: "own_area" })) }) } as never,
            calendar,
            { enabled: () => false, list: () => Promise.resolve([]) },
            { validateLinks: () => Promise.resolve(), canManageLinks: () => Promise.resolve(true), selectionOptions: () => Promise.resolve({ users: [], notes: [], leads: [], orders: [] }) } as never,
            { publish: () => Promise.resolve({ status: "crm_only" }) } as never,
            addendum,
        );
    });

    afterAll(async () => {
        // beforeAll puede fallar antes de asignar cualquiera de las conexiones.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (db) await db.destroy();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!admin) return;
        try {
            for (const name of created) {
                if (![nativeSchema, legacySchema].includes(name) || !/^codex_addendum_qa_\d+_\d+_(native|legacy)$/.test(name)) throw new Error("Unsafe QA cleanup");
                await sql`DROP DATABASE ${sql.id(name)}`.execute(admin);
            }
        } finally {
            await admin.destroy();
        }
    });

    beforeEach(async () => {
        failCalendarAudit = false;
        failOrderAudit = false;
        for (const table of nativeTables) await sql`DELETE FROM ${sql.id(table)}`.execute(db);
        await sql`DELETE FROM ${sql.table(`${legacySchema}.ordenventa`)}`.execute(db);
    });

    async function seed(source: "native" | "legacy"): Promise<AddendumIdentity> {
        if (source === "native") {
            await sql`INSERT INTO crm_lead VALUES (1,${leadId},NULL)`.execute(db);
            await sql`INSERT INTO crm_sales_order (id_sales_order,public_id_sales_order,lead_id_sales_order,status_sales_order,cancelled_sales_order) VALUES (1,${orderId},1,'active','no')`.execute(db);
            return { source, id: orderId };
        }
        await sql`INSERT INTO ${sql.table(`${legacySchema}.ordenventa`)} (id_ov,id_lead) VALUES (7,8)`.execute(db);
        return { source, id: "7" };
    }
    function command(order: AddendumIdentity, future = true): CalendarInput {
        const start = Date.now() + (future ? 86400000 : -86400000);
        return {
            moduleCode: "formalizacion",
            typeId,
            title: "Adéndum QA",
            allDay: false,
            start: new Date(start).toISOString(),
            end: new Date(start + 1800000).toISOString(),
            details: {},
            operationId: randomUUID(),
            links: [
                { entityType: "sales_order", ...order },
                { entityType: "lead", source: order.source, id: order.source === "native" ? leadId : "8" },
            ],
        };
    }
    async function save(actor: string, input: CalendarInput | CalendarUpdate, eventId?: string) {
        return (await service.save(actor, input, eventId)).event;
    }
    async function count(table: string): Promise<number> {
        return Number((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM ${sql.id(table)}`.execute(db)).rows[0]?.total);
    }

    it.each(["native", "legacy"] as const)("dos actores crean Adéndum futuro: uno gana, otro recibe conflicto; %s", async (source) => {
        const order = await seed(source);
        const first = command(order);
        const second = command(order);
        const results = await Promise.allSettled([save("actor-one", first), save("actor-two", second)]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const failure = results.find((result) => result.status === "rejected");
        expect(failure?.status === "rejected" && (failure.reason as { status: number }).status).toBe(409);
        expect(await count("crm_calendar_event")).toBe(1);
        expect(await count("audit_record_event")).toBe(2);
        expect(await addendum.read(order)).toMatchObject({ status: "pending", version: 1 });
        const winner = results[0].status === "fulfilled" ? "actor-one" : "actor-two";
        const winningInput = winner === "actor-one" ? first : second;
        await save(winner, winningInput);
        expect(await count("audit_record_event")).toBe(2);
    });

    it.each(["native", "legacy"] as const)("auditoría del evento falla después del marcador: revierte ambos y sus evidencias; %s", async (source) => {
        const order = await seed(source);
        failCalendarAudit = true;
        await expect(save("actor-one", command(order))).rejects.toMatchObject({ status: 503 });
        expect(await count("crm_calendar_event")).toBe(0);
        expect(await count("crm_calendar_event_link")).toBe(0);
        expect(await count("audit_record_event")).toBe(0);
        expect(await count("audit_record")).toBe(0);
        expect(await addendum.read(order)).toMatchObject({ status: null, version: 0 });
    });

    it("editar Adéndum pasado a futuro compite con crear otro: nunca quedan dos futuros", async () => {
        const order = await seed("native");
        const past = await save("actor-one", command(order, false));
        const results = await Promise.allSettled([save("actor-one", { ...command(order), expectedVersion: past.version }, past.id), save("actor-two", command(order))]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const future = (await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_calendar_event WHERE status_calendar_event='scheduled' AND starts_at_calendar_event>UTC_TIMESTAMP(3)`.execute(db)).rows[0];
        expect(Number(future?.total)).toBe(1);
        expect((await addendum.read(order)).status).toBe("pending");
    });
    it.each(["native", "legacy"] as const)("marcado manual concurrente conserva una sola nota y su evidencia, sin evento: %s", async (source) => {
        const order = await seed(source);
        const first = { ...order, actorPublicId: "actor-one", expectedVersion: 0, operationId: randomUUID(), note: "Nota manual QA uno" };
        const second = { ...first, actorPublicId: "actor-two", operationId: randomUUID(), note: "Nota manual QA dos" };
        const outcomes = await Promise.allSettled([addendum.markManually(first), addendum.markManually(second)]);
        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
        const winner = outcomes[0].status === "fulfilled" ? first : second;
        expect(await addendum.read(order)).toMatchObject({ status: "pending", version: 1, note: winner.note });
        expect(await count("crm_calendar_event")).toBe(0);
        expect(await count("audit_record_event")).toBe(1);
        expect(await addendum.markManually(winner)).toMatchObject({ replayed: true });
        expect(await count("audit_record_event")).toBe(1);
        expect(await addendum.summary()).toEqual({ total: 1 });
    });
    it.each(["native", "legacy"] as const)("marcado manual y nota revierten si falla la bitácora: %s", async (source) => {
        const order = await seed(source);
        failOrderAudit = true;
        await expect(addendum.markManually({ ...order, actorPublicId: "actor-one", expectedVersion: 0, operationId: randomUUID(), note: "No debe guardarse" })).rejects.toThrow("Injected order audit failure");
        expect(await addendum.read(order)).toMatchObject({ status: null, version: 0, note: null });
        expect(await count("audit_record_event")).toBe(0);
        expect(await count("audit_record")).toBe(0);
    });
});
