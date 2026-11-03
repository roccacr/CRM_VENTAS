import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { AuditReadRepository } from "../../src/modules/crm/audit/audit-read.repository.js";
import type { SecurityAuditEvent, SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { BanksRepository } from "../../src/modules/crm/banks/banks.repository.js";

it("keeps advisor events visible in the banks catalog audit filter while retaining their own source entity", async () => {
    const queries: CompiledQuery[] = [];
    const events: SecurityAuditEvent[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                let rows: object[] = [];
                if (query.sql.includes("from `sec_user`")) rows = [{ id_user: 1 }];
                if (query.sql.startsWith("SELECT CAST(id_bank")) rows = [{ id: "1", version: 1, status: "active" }];
                if (query.sql.includes("FROM crm_bank_advisor a JOIN")) rows = [{ publicId: "01ARZ3NDEKTSV4RRFFQ69G5FAW", bankPublicId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", name: "Advisor", email: "a@example.test", phone: "123", area: "Credit", status: "active", version: 1, createdAt: "2026-11-03T12:00:00.000Z", updatedAt: "2026-11-03T12:00:00.000Z" }];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const database = { db } as DatabaseService;
    const audit = {
        captureActor: vi.fn().mockResolvedValue({ publicId: "actor", name: "Actor", roles: [] }),
        record: vi.fn().mockImplementation((event: SecurityAuditEvent) => {
            events.push(event);
            return Promise.resolve();
        }),
    };
    try {
        await new BanksRepository(database, audit as unknown as SecurityAuditService).mutateAdvisor({ bankId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }, { kind: "create", name: "Advisor", email: "a@example.test", phone: "123", area: "Credit" }, { actorPublicId: "actor", moduleCode: "ventas", reason: "Authorized creation" });
        expect(events[0]?.metadata).toMatchObject({ catalogCode: "banks", sectionCode: "catalogs", changeSet: { entity: "bank_advisor" } });
        await new AuditReadRepository(database).list({ moduleCode: "ventas", sectionCode: "catalogs", catalogCode: "banks", limit: 25 });
        expect(queries.at(-1)?.parameters).toContain(events[0]?.metadata?.catalogCode);
        expect(queries.at(-1)?.parameters).toContain("catalogs");
    } finally {
        await db.destroy();
    }
});
