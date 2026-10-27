import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { readOrderRecord } from "../../src/modules/crm/sales/sales-orders/order-record.query.js";

function fixture(rows: Record<string, unknown>[][]) {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) => {
            queries.push(query);
            return Promise.resolve({ rows: (rows.shift() ?? []) as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (instance) => new MysqlIntrospector(instance), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}
it("joins legacy using provider relationship keys, returning all three snapshots without writes", async () => {
    const f = fixture([[{ id_ov: 208, id_ov_tranid: "RDR673", id_ov_lead: 400, idExpediente_ov: 500, id_ov_netsuite: 600 }], [{ id_lead: 1, nombre_lead: "Example", email_lead: "example@example.com" }], [{ id_expediente: 2, codigo_exp: "U-1" }]]);
    try {
        const data = await readOrderRecord(f.db as never, "legacy", "208", "legacy:208");
        expect(data.order.number).toBe("RDR673");
        expect(data.lead?.id).toBe("legacy:1");
        expect(data.unitFile?.sourceFields.codigo_exp).toBe("U-1");
        expect(data.contact?.name).toBe("Example");
        expect(data.warnings).toEqual([]);
        expect(f.queries[1]?.sql).toContain("`idinterno_lead`=?");
        expect(f.queries[1]?.parameters).toContain(400);
        expect(f.queries[2]?.sql).toContain("`ID_interno_expediente`=?");
        expect(f.queries.every((query) => !/SELECT \*|INSERT|UPDATE|DELETE/.test(query.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("uses only native relations and reads the normalized contact separately", async () => {
    const f = fixture([[{ lead_id_sales_order: 11, unit_file_id_sales_order: 12, native_code_sales_order: "CRM-1" }], [{ public_id_lead: "lead", primary_contact_id_lead: 13 }], [{ public_id_unit_file: "unit", code_unit_file: "U" }], [{ public_id_contact: "contact", full_name_contact: "Example" }], [{ provider: "odoo", externalId: "SO123", number: "SO123" }]]);
    try {
        const data = await readOrderRecord(f.db as never, "native", "10", "public");
        expect(data.source).toBe("native");
        expect(data.contact?.id).toBe("contact");
        expect(data.references[0]?.provider).toBe("odoo");
        expect(f.queries.every((query) => !query.sql.includes("crmdatabase-api"))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("reports ambiguous or missing relations without choosing arbitrary data", async () => {
    const f = fixture([[{ id_ov_tranid: "RDR673", id_ov_lead: 1, idExpediente_ov: 2 }], [{ id_lead: 1 }, { id_lead: 2 }], []]);
    try {
        const data = await readOrderRecord(f.db as never, "legacy", "208", "legacy:208");
        expect(data.lead).toBeNull();
        expect(data.unitFile).toBeNull();
        expect(data.contact).toBeNull();
        expect(data.warnings).toEqual(["lead:ambiguous", "unitFile:missing"]);
    } finally {
        await f.db.destroy();
    }
});
