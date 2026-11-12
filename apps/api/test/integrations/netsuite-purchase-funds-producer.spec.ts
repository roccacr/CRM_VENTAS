import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { expect, it } from "vitest";

import { mapOrderFields } from "../../src/integrations/netsuite/netsuite-order-event.mapper.js";

interface Library {
    salesOrders: { getSalesOrderEventById(id: string): { data: { fields: Record<string, unknown> }; FONDOS: string } };
}

function readSnapshot(value: unknown, verified = false, changed = false, reservationApplied = false) {
    let loads = 0;
    const flagFields = new Set(["custbody90", "custbody51", "custbody91", "custbody105", "custbody43", "custbody103", "custbody_ix_comision_pagada", "custbody_entrega_de_llaves", "custbody274", "custbody_cuotas_pagadas", "custbody209", "custbody74", "custbody_aprueba_jefe_ventas", "custbodyid_firma_rocca", "custbodyid_firma_rc"]);
    const order = {
        getValue: ({ fieldId }: { fieldId: string }) => {
            if (fieldId === "custbody209") return reservationApplied;
            if (fieldId === "custbody37") return changed && loads > 1 ? "1" : value;
            if (fieldId === "trandate") return new Date(2026, 10, 3);
            if (fieldId === "tranid") return "RDR673";
            if (flagFields.has(fieldId)) return false;
            return null;
        },
        getText: () => "Display label is not the ID",
        getSublists: () => [],
        getLineCount: () => 0,
    };
    let library: Library | undefined;
    runInNewContext(readFileSync(new URL("../../src/integrations/netsuite/suitescript/SS2_1_LIB_CRM_habita.js", import.meta.url), "utf8"), {
        define: (_dependencies: string[], factory: (...providers: unknown[]) => Library) => {
            library = factory(
                {},
                {},
                {},
                {},
                {
                    Type: { SALES_ORDER: "salesorder" },
                    load: () => {
                        loads++;
                        return order;
                    },
                },
                { lookupFields: () => ({ ...Object.fromEntries([...["custbody90", "custbody51", "custbody91", "custbody105", "custbody43", "custbody103", "custbody_ix_comision_pagada", "custbody_entrega_de_llaves", "custbody274", "custbody_cuotas_pagadas"].map((key) => [key, false] as const)]), custbody209: reservationApplied }) },
                { parse: () => new Date("2026-11-03T18:00:00Z"), Type: { DATETIME: "datetime" } },
            );
        },
    });
    if (!library) throw new Error("Missing SuiteScript library");
    const snapshot = verified ? (library.salesOrders as unknown as { get(request: unknown): unknown }).get({ id: "123", action: "syncSnapshot" }) : library.salesOrders.getSalesOrderEventById("123");
    return snapshot as ReturnType<Library["salesOrders"]["getSalesOrderEventById"]>;
}

it.each([
    ["1", "own_funds"],
    ["2", "bank_financing"],
] as const)("reads raw custbody37=%s from the real producer and maps both databases", (value, expected) => {
    const snapshot = readSnapshot(value);
    expect(snapshot.data.fields.custbody37).toBe(value);
    expect(snapshot.FONDOS).toBe("Display label is not the ID");
    for (const destination of ["native", "legacy"] as const) expect(mapOrderFields(snapshot.data.fields, destination, {}).find((change) => change.field === "custbody37")?.after).toBe(expected);
});
it.each([undefined, {}, [], true, "unknown", 3])("rejects unreadable or invalid raw funds %j before converting them to null", (value) => {
    expect(() => readSnapshot(value)).toThrow("purchase_funds_unavailable");
});
it.each([null, ""])("preserves an explicitly empty raw value %j", (value) => {
    expect(readSnapshot(value).data.fields.custbody37).toBe(value);
});

it("manual sync GET returns the complete verified event projection with a real source version", () => {
    const result = readSnapshot("2", true) as unknown as { status: number; sourceModifiedAt: string; snapshotReadStartedAt: string; snapshotReadCompletedAt: string; data: { fields: Record<string, unknown>; sublists: { item: unknown[] } } };
    expect(result.status).toBe(200);
    expect(result.sourceModifiedAt).toBe("2026-11-03T18:00:00.000Z");
    expect(result.data.fields.crm_sync_projection).toBe(1);
    expect(result.data.fields.custbody37).toBe("2");
    expect(result.data.fields.custbody209).toBe(false);
    expect(Array.isArray(result.data.sublists.item)).toBe(true);
    expect(Date.parse(result.snapshotReadCompletedAt)).toBeGreaterThanOrEqual(Date.parse(result.snapshotReadStartedAt));
});
it("manual sync GET rejects a snapshot that changes between its two reads", () => {
    expect(readSnapshot("2", true, true)).toMatchObject({ status: 502 });
});

it.each([true, false])("el productor real conserva Reserva Aplicada=%s en la lectura verificada", (value) => {
    const result = readSnapshot("2", true, false, value) as unknown as { status: number; data: { fields: Record<string, unknown> } };
    expect(result.status).toBe(200);
    expect(result.data.fields.custbody209).toBe(value);
});
