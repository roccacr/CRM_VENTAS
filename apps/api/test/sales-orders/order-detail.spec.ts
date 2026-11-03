import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { buildOrderDetail, readOrderDetail } from "../../src/modules/crm/sales/sales-orders/order-detail.query.js";

const relations = () => ({ project: "Proyecto", subsidiary: "Subsidiaria", seller: "Vendedor", advisor: "Asesor", identification: null, approvals: [] as Record<string, unknown>[], warnings: [] as string[] });
const snapshot = (source: "native" | "legacy", fields: Record<string, unknown> = {}) => ({ source, order: { number: "RDR673", sourceFields: fields }, lead: null, contact: null, unitFile: null, warnings: [] as string[] });
const field = (detail: ReturnType<typeof buildOrderDetail>, code: string) => detail.sections.flatMap((section) => section.fields).find((item) => item.code === code);
function fixture(responses: Record<string, unknown>[][]) {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) => {
            queries.push(query);
            return Promise.resolve({ rows: (responses.shift() ?? []) as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (instance) => new MysqlIntrospector(instance), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}
it("projects every native operational flag without converting missing/unknown to false", () => {
    const fields = {
        currency_code_sales_order: "CRC",
        sale_price_sales_order: "900719925474099.1234",
        contract_signed_sales_order: "yes",
        commercial_closure_signed_sales_order: "no",
        advisor_commission_calculated_sales_order: "yes",
        advisor_commission_paid_sales_order: "no",
        unit_delivered_sales_order: "yes",
        unit_transferred_sales_order: "no",
        keys_delivered_sales_order: "yes",
        trust_down_payment_validated_sales_order: "no",
        commission_approved_sales_order: "yes",
        broker_commission_calculated_sales_order: "no",
        installments_fully_paid_sales_order: "unknown",
        cancelled_sales_order: "yes",
        cancellation_marked_on_sales_order: "2026-11-02",
    };
    const detail = buildOrderDetail(snapshot("native", fields), relations());
    expect(detail.currency).toBe("CRC");
    expect(field(detail, "currency")?.value).toBe("CRC");
    expect(field(detail, "salePrice")?.value).toBe(fields.sale_price_sales_order);
    expect(detail.sections.flatMap((section) => section.fields).filter((item) => item.kind === "boolean")).toHaveLength(15);
    expect(field(detail, "installmentsFullyPaid")?.value).toBeNull();
    expect(field(detail, "unitDelivered")?.value).toBe("yes");
    expect(field(detail, "cancellationDate")?.value).toBe("2026-11-02");
    expect(JSON.stringify(detail.sections)).not.toContain("id_sales_order");
});
it("preserves legacy amounts/dates and never borrows currency from lead or interprets ambiguous flags", () => {
    const data = { ...snapshot("legacy", { prec_venta_ov: "00123.4500", trandate_ov: "02/11/2026", caida_ov: 2, chekJefeVenta: 1, aprobacion__rdr_ov: 0, unidad_entregada_ov: 1 }), lead: { id: "legacy:9", sourceFields: { moneda_lead: "USD" } } };
    const detail = buildOrderDetail(data, relations());
    expect(detail.currency).toBeNull();
    expect(field(detail, "currency")?.value).toBeNull();
    expect(field(detail, "salePrice")?.value).toBe("00123.4500");
    expect(field(detail, "date")?.value).toBe("02/11/2026");
    expect(field(detail, "cancelled")?.value).toBeNull();
    expect(field(detail, "salesManagementApproval")?.value).toBe("yes");
    expect(field(detail, "developerApproval")?.value).toBe("no");
});
it("suppresses conflicting approval rows instead of selecting the first", () => {
    const resolved = relations();
    resolved.approvals = [
        { type: "developer", status: "approved" },
        { type: "developer", status: "not_approved" },
    ];
    const detail = buildOrderDetail(snapshot("native"), resolved);
    expect(field(detail, "developerApproval")?.value).toBeNull();
    expect(detail.warnings).toContain("approval.developer:ambiguous");
});
it("returns null client data and empty fields without fabricated values", () => {
    const detail = buildOrderDetail(snapshot("native"), { ...relations(), project: null, subsidiary: null, seller: null, advisor: null });
    expect(detail.client).toEqual({ name: null, email: null, phone: null, identification: null, advisor: null, identity: null });
    expect(field(detail, "contractSigned")?.value).toBeNull();
});
it("reads only identification from the unique legacy extra relation", async () => {
    const f = fixture([[{ cedula_lead: "ID-9" }]]);
    try {
        const data = { ...snapshot("legacy"), lead: { id: "legacy:9", sourceFields: { id_lead: 9, idinterno_lead: 90 } }, contact: { name: "Cliente", email: null, phone: null } };
        const detail = await readOrderDetail(f.db as never, data, {});
        expect(detail.client.identification).toBe("ID-9");
        expect(f.queries[0]?.sql).toContain("`id_lead_fk`=?");
        expect(f.queries[0]?.parameters).toContain(90);
        expect(f.queries[0]?.sql).not.toContain("SELECT *");
    } finally {
        await f.db.destroy();
    }
});
it("does not choose between duplicate identification records", async () => {
    const f = fixture([[{ cedula_lead: "A" }, { cedula_lead: "B" }]]);
    try {
        const detail = await readOrderDetail(f.db as never, { ...snapshot("legacy"), lead: { id: "legacy:9", sourceFields: { idinterno_lead: 90 } } }, {});
        expect(detail.client.identification).toBeNull();
        expect(detail.warnings).toContain("client.identification:ambiguous");
    } finally {
        await f.db.destroy();
    }
});
it("resolves a legacy order with no old lead through a unique active ERP reference, preserving order source", async () => {
    const f = fixture([[{ id_lead: 2, public_id_lead: "NATIVE", primary_contact_id_lead: 3, owner_user_id_lead: 4 }], [], [{ full_name_contact: "Nativo", email_contact: "n@example.com", phone_contact: "123" }], [{ display_name_user: "Asesor nativo" }]]);
    try {
        const data = snapshot("legacy", { id_ov_lead: 700 });
        const detail = await readOrderDetail(f.db as never, data, { legacyEnabled: true });
        expect(data.source).toBe("legacy");
        expect(detail.client).toEqual({ name: "Nativo", email: "n@example.com", phone: "123", identification: null, advisor: "Asesor nativo", identity: { source: "native", id: "NATIVE" } });
        expect(detail.warnings).toContain("client:native_reference_only");
        expect(f.queries[0]?.sql).toContain("x.status_lead_external_reference='active'");
        expect(f.queries[0]?.parameters).toContain(700);
        expect(f.queries[2]?.sql).toContain("deleted_at_contact IS NULL");
        expect(f.queries.every((query) => !/INSERT|UPDATE|DELETE|SELECT \*/.test(query.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("rejects ambiguous or conflicting cross-source links", async () => {
    for (const responses of [[[{ id_lead: 2 }, { id_lead: 3 }]], [[{ id_lead: 2, public_id_lead: "N" }], [{ id_lead: 99 }]]]) {
        const f = fixture(responses);
        try {
            const detail = await readOrderDetail(f.db as never, snapshot("legacy", { id_ov_lead: 700 }), { legacyEnabled: true });
            expect(detail.client.identity).toBeNull();
            expect(detail.warnings.some((warning) => warning.startsWith("client.link:"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    }
});
it("does not query legacy cross-source data when the gate is disabled", async () => {
    const f = fixture([]);
    try {
        await readOrderDetail(f.db as never, snapshot("native"), { legacyEnabled: false });
        expect(f.queries).toEqual([]);
    } finally {
        await f.db.destroy();
    }
});

it("enriches a native client with identification only after reciprocal unique legacy linkage", async () => {
    const legacy = { id_lead: 7, idinterno_lead: 70, nombre_lead: "Antiguo", email_lead: "old@example.com", telefono_lead: "old" };
    const native = { id_lead: 1, public_id_lead: "NATIVE" };
    const f = fixture([[legacy], [native], [{ cedula_lead: "ID70" }]]);
    try {
        const data = { ...snapshot("native"), lead: { id: "NATIVE", sourceFields: native }, contact: { name: "Actual", email: "new@example.com", phone: null } };
        const detail = await readOrderDetail(f.db as never, data, { legacyEnabled: true });
        expect(detail.client).toMatchObject({ name: "Actual", email: "new@example.com", phone: "old", identification: "ID70", identity: { source: "native", id: "NATIVE" } });
        expect(detail.warnings).toContain("client:linked_sources");
        expect(data.source).toBe("native");
    } finally {
        await f.db.destroy();
    }
});
it("prefers linked native contact while preserving the legacy order authority", async () => {
    const legacy = { id_lead: 7, idinterno_lead: 70, nombre_lead: "Antiguo" };
    const native = { id_lead: 1, public_id_lead: "NATIVE", primary_contact_id_lead: 3 };
    const f = fixture([[{ cedula_lead: "ID70" }], [native], [legacy], [{ full_name_contact: "Actual", email_contact: null, phone_contact: null }]]);
    try {
        const data = { ...snapshot("legacy"), lead: { id: "legacy:7", sourceFields: legacy }, contact: { name: "Antiguo", email: "old@example.com", phone: "123" } };
        const detail = await readOrderDetail(f.db as never, data, { legacyEnabled: true });
        expect(detail.client).toMatchObject({ name: "Actual", email: "old@example.com", identification: "ID70", identity: { source: "native", id: "NATIVE" } });
        expect(data.source).toBe("legacy");
    } finally {
        await f.db.destroy();
    }
});

it("does not choose an arbitrary commercial number across conflicting active references", () => {
    const data = { ...snapshot("native"), references: [{ number: "SO-A" }, { number: "SO-B" }] };
    const detail = buildOrderDetail(data, relations());
    expect(field(detail, "number")?.value).toBeNull();
    expect(detail.warnings).toContain("order.number:ambiguous");
});
