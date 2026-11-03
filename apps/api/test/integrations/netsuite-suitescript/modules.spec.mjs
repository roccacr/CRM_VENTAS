import { describe, expect, it, vi } from "vitest";

import { EVENT_PROVIDERS, EVENT_TEST_ID, loadAmd, logMock, nsError, READY, recordMock, runtimeMock, searchMock } from "./amd-harness.mjs";

const SALES_ORDERS = "modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta.js";
const throwing = (error) => () => {
    throw error;
};

/** Carga un modulo con NetSuite simulado y devuelve los dobles para contar llamadas (gobernanza). */
function ordersFixture({ record = recordMock(), search = searchMock(READY) } = {}) {
    const nativeRecord = { load: record.load, submitFields: record.submitFields };
    const orders = loadAmd(SALES_ORDERS, { "N/record": nativeRecord, "N/search": search });
    return { orders, record, search };
}

describe("salesOrders GET", () => {
    it("returns the stable contract with scalar-only values and costs exactly one record.load", () => {
        const { orders, record, search } = ordersFixture({
            record: recordMock({ fields: { tranid: "OV-214", total: 123456789.001, custbody43: false, memo: "Nota" }, texts: { trandate: "28/10/2026", entity: "Cliente" }, lineCount: 2 }),
        });
        const response = orders.get({ module: "salesOrders", id: "214" });
        expect(Object.keys(response).slice(0, 2)).toEqual(["status", "data"]);
        expect(response).toMatchObject({
            status: 200,
            data: { type: "salesorder", id: "214", fields: { initialtranid: "OV-214", total: "123456789.001", custbody43: false, memo: "Nota", trandate: "28/10/2026" } },
            MOTIVO_COMPRA: null,
            cli: "Cliente",
        });
        expect(Object.keys(response.data.sublists.item)).toEqual(["line 1", "line 2"]);
        expect(response.data.sublists.item["line 1"]).toMatchObject({ item_display: "item-t0", quantity: "1" });
        expect(JSON.parse(JSON.stringify(response))).toEqual(response);
        expect(record.load).toHaveBeenCalledExactlyOnceWith({ type: "salesorder", id: "214", isDynamic: false });
        expect(search.lookupFields).not.toHaveBeenCalled();
        expect(record.submitFields).not.toHaveBeenCalled();
    });
    it("maps every schema alias to a key and never leaks non-scalars", () => {
        const { orders } = ordersFixture({ record: recordMock({ fields: { total: { raw: 1 }, memo: new Date(0), custbody90: [1] } }) });
        const body = orders.get({ id: "1" });
        for (const value of Object.values(body.data.fields)) expect(["string", "boolean"].includes(typeof value) || value === null).toBe(true);
        expect(body.data.fields.total).toBeNull();
        for (const alias of ["Expediente", "UNIDAD", "cli", "Subsidaria", "Departamento", "Clase", "Ubi", "Oportunidad", "CREADO", "vendedor", "socio", "CAMPANA", "METODO_PAGO", "FONDOS", "MOTIVO_CANCE", "MOTIVO_COMPRA"]) expect(body).toHaveProperty(alias);
    });
    it("spends nothing on an invalid ID", () => {
        const { orders, record, search } = ordersFixture();
        for (const id of [undefined, "", "0", "abc", 5, "1e3"]) expect(orders.get({ id })).toMatchObject({ status: 400, error: { code: "INVALID_ID" } });
        expect(record.load).not.toHaveBeenCalled();
        expect(search.lookupFields).not.toHaveBeenCalled();
    });
    it("accepts exactly 1000 lines and rejects 1001 with 422", () => {
        expect(Object.keys(ordersFixture({ record: recordMock({ lineCount: 1000 }) }).orders.get({ id: "1" }).data.sublists.item)).toHaveLength(1000);
        const over = recordMock({ lineCount: 1001 });
        expect(ordersFixture({ record: over }).orders.get({ id: "1" })).toMatchObject({ status: 422, error: { code: "ITEM_LINE_LIMIT_EXCEEDED" } });
        expect(over.rec.getValue).not.toHaveBeenCalled();
    });
    it("translates provider failures without leaking raw messages", () => {
        const missing = ordersFixture({ record: recordMock({ loadError: nsError("RCRD_DSNT_EXIST") }) }).orders.get({ id: "9" });
        expect(missing).toMatchObject({ status: 404, error: { code: "SALES_ORDER_NOT_FOUND" } });
        for (const name of ["SSS_USAGE_LIMIT_EXCEEDED", "INSUFFICIENT_PERMISSION", "UNEXPECTED_ERROR"]) {
            const failed = ordersFixture({ record: recordMock({ loadError: nsError(name) }) }).orders.get({ id: "9" });
            expect(failed).toMatchObject({ status: 502, error: { code: "SALES_ORDER_READ_ERROR" } });
            expect(JSON.stringify(failed)).not.toContain("SECRET");
        }
        const brokenLines = recordMock();
        brokenLines.rec.getLineCount.mockReturnValue(-1);
        expect(ordersFixture({ record: brokenLines }).orders.get({ id: "9" }).status).toBe(502);
    });
});

describe("salesOrders PUT approveFormalization", () => {
    const put = (orders, extra = {}) => orders.put({ module: "salesOrders", action: "approveFormalization", id: "214", ...extra });
    const approved = (alreadyApproved) => ({ status: 200, data: { type: "salesorder", id: "214", approval: "formalization", approved: true, alreadyApproved } });

    it("approves with 2 lookups, 1 write and ZERO record.load", () => {
        const search = searchMock(READY, (arg, n) => (n === 1 ? READY : { ...READY, custbodyid_firma_rc: true }));
        const { orders, record } = ordersFixture({ search });
        expect(put(orders)).toEqual(approved(false));
        expect(search.lookupFields).toHaveBeenCalledTimes(2);
        expect(search.lookupFields.mock.calls[0][0].columns).toEqual(["custbody43", "custbody_aprueba_jefe_ventas", "custbodyid_firma_rocca", "custbodyid_firma_rc"]);
        expect(record.submitFields).toHaveBeenCalledExactlyOnceWith({
            type: "salesorder",
            id: "214",
            values: { custbodyid_firma_rc: true },
            options: { enableSourcing: false, ignoreMandatoryFields: false },
        });
        expect(record.load).not.toHaveBeenCalled();
    });
    it("is idempotent: already approved costs one lookup and no write, even without prerequisites", () => {
        const search = searchMock({ ...READY, custbodyid_firma_rc: true, custbody_aprueba_jefe_ventas: false });
        const { orders, record } = ordersFixture({ search });
        expect(put(orders)).toEqual(approved(true));
        expect(search.lookupFields).toHaveBeenCalledOnce();
        expect(record.submitFields).not.toHaveBeenCalled();
    });
    it("rejects a cancelled order, even if already approved, without writing", () => {
        const { orders, record } = ordersFixture({ search: searchMock({ ...READY, custbody43: true, custbodyid_firma_rc: true }) });
        expect(put(orders)).toMatchObject({ status: 409, error: { code: "SALES_ORDER_CANCELLED" } });
        expect(record.submitFields).not.toHaveBeenCalled();
    });
    it.each([
        ["jefe false", { custbody_aprueba_jefe_ventas: false }],
        ["rocca false", { custbodyid_firma_rocca: false }],
        ["jefe missing", { custbody_aprueba_jefe_ventas: undefined }],
        ["jefe truthy number", { custbody_aprueba_jefe_ventas: 1 }],
        ["rocca string T", { custbodyid_firma_rocca: "T" }],
    ])("requires strict booleans for prerequisites (%s)", (_name, override) => {
        const { orders, record } = ordersFixture({ search: searchMock({ ...READY, ...override }) });
        expect(put(orders)).toMatchObject({ status: 409, error: { code: "APPROVAL_PREREQUISITES_REQUIRED" } });
        expect(record.submitFields).not.toHaveBeenCalled();
    });
    it("does not treat a truthy non-boolean cancelled or approved flag as true", () => {
        const { orders } = ordersFixture({ search: searchMock({ ...READY, custbody43: 1, custbodyid_firma_rc: 1 }, (arg, n) => (n === 1 ? { ...READY, custbody43: 1, custbodyid_firma_rc: 1 } : { ...READY, custbodyid_firma_rc: true })) });
        expect(put(orders)).toEqual(approved(false));
    });
    it("reports a pre-write read failure as a definite error (404/502), never as unknown outcome", () => {
        const missing = ordersFixture({ search: searchMock({}, throwing(nsError("RCRD_DSNT_EXIST"))) });
        expect(put(missing.orders)).toMatchObject({ status: 404, error: { code: "SALES_ORDER_NOT_FOUND" } });
        const broken = ordersFixture({ search: searchMock({}, throwing(new Error("SECRET"))) });
        expect(put(broken.orders)).toMatchObject({ status: 502, error: { code: "SALES_ORDER_READ_ERROR" } });
        expect(broken.record.submitFields).not.toHaveBeenCalled();
        expect(JSON.stringify(put(broken.orders))).not.toContain("SECRET");
    });
    it.each([
        ["write fails", (record) => record.submitFields.mockImplementation(throwing(new Error("SECRET"))), searchMock(READY), "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN"],
        [
            "confirmation lookup throws",
            () => {},
            searchMock(READY, (arg, n) => {
                if (n === 1) return READY;
                throw new Error("SECRET");
            }),
            "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN",
        ],
        ["confirmation is false", () => {}, searchMock(READY), "FORMALIZATION_APPROVAL_UNCONFIRMED"],
        ["confirmation is truthy non-boolean", () => {}, searchMock(READY, (arg, n) => (n === 1 ? READY : { ...READY, custbodyid_firma_rc: "T" })), "FORMALIZATION_APPROVAL_UNCONFIRMED"],
    ])("answers 502 'unknown outcome' when %s", (_name, arrange, search, code) => {
        const { orders, record } = ordersFixture({ search });
        arrange(record);
        const response = put(orders);
        expect(response).toMatchObject({ status: 502, error: { code } });
        expect(JSON.stringify(response)).not.toContain("SECRET");
    });
    it.each([
        ["custbody43", true],
        ["custbody_aprueba_jefe_ventas", false],
        ["custbodyid_firma_rocca", 1],
        ["custbodyid_firma_rocca", undefined],
        ["custbody43", undefined],
        ["custbody43", null],
    ])("does not confirm success when %s changes between validation and confirmation (value %j)", (field, value) => {
        const search = searchMock(READY, (arg, n) => (n === 1 ? READY : { ...READY, custbodyid_firma_rc: true, [field]: value }));
        const { orders, record } = ordersFixture({ search });
        expect(put(orders)).toMatchObject({ status: 409, error: { code: "APPROVAL_STATE_CHANGED" } });
        expect(record.submitFields).toHaveBeenCalledOnce();
        expect(search.lookupFields).toHaveBeenCalledTimes(2);
        expect(search.lookupFields.mock.calls[1][0].columns).toHaveLength(4);
    });
    it("validates the request before any NetSuite call", () => {
        const { orders, record, search } = ordersFixture();
        expect(orders.put({ module: "salesOrders" })).toMatchObject({ status: 501 });
        expect(orders.put({ module: "salesOrders", action: "delete", id: "1" })).toMatchObject({ error: { code: "INVALID_ACTION" } });
        expect(put(orders, { extra: true })).toMatchObject({ error: { code: "INVALID_REQUEST" } });
        expect(put(orders, { id: "x" })).toMatchObject({ error: { code: "INVALID_ID" } });
        expect(search.lookupFields).not.toHaveBeenCalled();
        expect(record.load).not.toHaveBeenCalled();
        expect(record.submitFields).not.toHaveBeenCalled();
    });
    it("two concurrent-looking requests both write the same true value (documented non-atomicity)", () => {
        const { orders, record } = ordersFixture({ search: searchMock(READY, (arg, n) => (n % 2 === 1 ? READY : { ...READY, custbodyid_firma_rc: true })) });
        expect(put(orders)).toEqual(approved(false));
        expect(put(orders)).toEqual(approved(false));
        expect(record.submitFields).toHaveBeenCalledTimes(2);
    });
});

describe("module surface", () => {
    it("exports get, put and the separate GET/event snapshot readers, frozen", () => {
        const { orders } = ordersFixture();
        expect(Object.keys(orders).sort()).toEqual(["get", "getSalesOrderById", "getSalesOrderEventById", "put"]);
        expect(Object.isFrozen(orders)).toBe(true);
    });
    it.each([["modules/02_leads/SS2_1_LIB_CRM_Leads.js"], ["modules/03_estimates/SS2_1_LIB_CRM_Estimaciones.js"]])("%s stays reserved (501) and spends nothing", (path) => {
        const reserved = loadAmd(path, {});
        expect(reserved.get({ module: "x" })).toMatchObject({ status: 501, error: { code: "NOT_IMPLEMENTED" } });
        expect(reserved.put({ module: "x" })).toMatchObject({ status: 501 });
    });
});

describe("RESTlet entry point (integrated)", () => {
    function restlet({ runtime = runtimeMock(), record = recordMock(), search = searchMock(READY), log = logMock() } = {}) {
        const handlers = loadAmd("SS2_1_RL_CRM_Integracion.js", {
            "N/runtime": runtime,
            "N/record": { load: record.load, submitFields: record.submitFields },
            "N/search": search,
            "N/log": log,
        });
        return { handlers, record, search, log };
    }

    it("serves a GET end to end with one load and one final debug log", () => {
        const { handlers, record, log } = restlet();
        expect(handlers.get({ module: "salesOrders", id: "214" })).toMatchObject({ status: 200, data: { id: "214" } });
        expect(record.load).toHaveBeenCalledOnce();
        expect(log.debug).toHaveBeenCalledOnce();
        expect(log.debug.mock.calls[0][0]).toMatchObject({ title: "CRM_v2_good_flow: resultado", details: { module: "salesOrders", action: "get", netsuiteId: "214", status: 200 } });
    });
    it("returns 403 outside the sandbox and touches no NetSuite API", () => {
        const { handlers, record, search } = restlet({ runtime: runtimeMock({ envType: "PRODUCTION" }) });
        for (const method of ["get", "put"]) expect(handlers[method]({ module: "salesOrders", id: "1", action: "approveFormalization" })).toMatchObject({ status: 403, error: { code: "SANDBOX_REQUIRED", message: expect.stringContaining("4552704_SB1") } });
        expect(record.load).not.toHaveBeenCalled();
        expect(search.lookupFields).not.toHaveBeenCalled();
    });
    it.each([undefined])("answers 501 without arguments", (request) => {
        expect(restlet().handlers.get(request)).toMatchObject({ status: 501 });
    });
    it.each([null, [], "salesOrders", 7, {}, { module: "nope" }, { module: "constructor" }, Object.create({ module: "leads" })])("answers INVALID_MODULE for %j", (request) => {
        const { handlers, log } = restlet();
        expect(handlers.put(request)).toMatchObject({ status: 400, error: { code: "INVALID_MODULE", message: "Selecciona un modulo valido: salesOrders, leads o estimates." } });
        expect(log.debug.mock.calls[0][0].details.module).toBe("invalid");
    });
    it("logs 5xx at error level with the error code and never request text", () => {
        const { handlers, log } = restlet({ record: recordMock({ loadError: new Error("SECRET") }) });
        handlers.get({ module: "salesOrders", id: "5", junk: "SECRET-PII" });
        expect(log.error).toHaveBeenCalledOnce();
        expect(log.error.mock.calls[0][0].details).toMatchObject({ status: 502, code: "SALES_ORDER_READ_ERROR" });
        expect(JSON.stringify(log.error.mock.calls)).not.toContain("SECRET");
    });
    it("BREAKING B1: an unexpected exception becomes a JSON 500, never escapes, and is logged once", () => {
        const { handlers, log } = restlet();
        // Falla solo en la segunda lectura propia de `id`, ya dentro del despacho.
        let reads = 0;
        const request = new Proxy(
            { module: "salesOrders", id: "1" },
            {
                getOwnPropertyDescriptor(target, key) {
                    if (key === "id" && ++reads > 1) throw new Error("SECRET");
                    return Reflect.getOwnPropertyDescriptor(target, key);
                },
            },
        );
        let response;
        expect(() => {
            response = handlers.get(request);
        }).not.toThrow();
        expect(response).toEqual({ status: 500, error: { code: "UNEXPECTED_ERROR", message: "Error inesperado al procesar la solicitud." } });
        expect(JSON.stringify(response)).not.toContain("SECRET");
        expect(log.error).toHaveBeenCalledOnce();
        expect(log.error.mock.calls[0][0]).toMatchObject({ title: "CRM_v2_bad_flow: resultado", details: { status: 500, code: "UNEXPECTED_ERROR" } });
        expect(JSON.stringify(log.error.mock.calls)).not.toContain("SECRET");
    });
    it("responds 500 JSON when even building the log context fails", () => {
        const { handlers, log } = restlet();
        const request = new Proxy(
            { module: "salesOrders", id: "1" },
            {
                getOwnPropertyDescriptor() {
                    throw new Error("SECRET");
                },
            },
        );
        expect(handlers.get(request)).toMatchObject({ status: 500, error: { code: "UNEXPECTED_ERROR" } });
        expect(log.error.mock.calls[0][0].details).toMatchObject({ module: "invalid", action: "get", status: 500 });
    });
    it("keeps working when the logger fails and exports only get and put", () => {
        const log = { debug: throwing(new Error("down")), error: throwing(new Error("down")) };
        const { handlers } = restlet({ log });
        expect(Object.keys(handlers).sort()).toEqual(["get", "put"]);
        expect(handlers.get({ module: "salesOrders", id: "1" }).status).toBe(200);
    });
    it("runs a full approval PUT within the expected governance budget", () => {
        const search = searchMock(READY, (arg, n) => (n === 1 ? READY : { ...READY, custbodyid_firma_rc: true }));
        const { handlers, record } = restlet({ search });
        expect(handlers.put({ module: "salesOrders", action: "approveFormalization", id: "214" })).toMatchObject({ status: 200, data: { approved: true, alreadyApproved: false } });
        expect(record.load).not.toHaveBeenCalled();
        expect(search.lookupFields).toHaveBeenCalledTimes(2);
        expect(record.submitFields).toHaveBeenCalledOnce();
    });
    it("never requires N/https (the RESTlet must not load the transport)", () => {
        expect(() => loadAmd("SS2_1_RL_CRM_Integracion.js", { "N/runtime": runtimeMock(), "N/record": {}, "N/search": {}, "N/log": logMock() })).not.toThrow();
    });
});

describe("Sales order event snapshot", () => {
    it("rejects a mixed snapshot when money changes in the same source minute", () => {
        const first = recordMock({ fields: { custbody13: 100 } });
        const second = recordMock({ fields: { custbody13: 200 } });
        first.load.mockReturnValueOnce(first.rec).mockReturnValueOnce(second.rec);
        const https = { createSecureString: () => "opaque", post: vi.fn(() => ({ code: 200, body: JSON.stringify({ schemaVersion: 2, received: true, persisted: true, eventId: EVENT_TEST_ID, netsuiteId: "7" }) })) };
        const entry = loadAmd("SS2_1_UE_CRM_CambiosRegistros.js", { ...EVENT_PROVIDERS, "N/runtime": runtimeMock(), "N/record": first, "N/search": searchMock(), "N/log": logMock(), "N/https": https });
        entry.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 7 } });
        expect(https.post.mock.calls.length).toBe(0);
    });
    it("sends item lines as an ordered array while the GET keeps the line-keyed object", () => {
        const record = recordMock({ lineCount: 3 });
        const sent = [];
        const https = { createSecureString: (a) => a.input, post: vi.fn((o) => (sent.push(JSON.parse(o.body)), { code: 200, body: JSON.stringify({ schemaVersion: 2, received: true, persisted: true, eventId: EVENT_TEST_ID, netsuiteId: "7" }) })) };
        const entry = loadAmd("SS2_1_UE_CRM_CambiosRegistros.js", { ...EVENT_PROVIDERS, "N/runtime": runtimeMock(), "N/record": { load: record.load, submitFields: record.submitFields }, "N/search": searchMock(), "N/log": logMock(), "N/https": https });
        entry.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 7 } });
        const item = sent[0].snapshot.data.sublists.item;
        expect(Array.isArray(item)).toBe(true);
        expect(item).toHaveLength(3);
        expect(item[0]).toMatchObject({ item_display: "item-t0", quantity: "1" });
        const get = ordersFixture({ record: recordMock({ lineCount: 3 }) }).orders.get({ id: "7" });
        expect(Object.keys(get.data.sublists.item)).toEqual(["line 1", "line 2", "line 3"]);
    });
    it("passes a failed snapshot through unchanged", () => {
        const record = recordMock({ lineCount: 1001 });
        const https = { createSecureString: (a) => a.input, post: vi.fn() };
        const entry = loadAmd("SS2_1_UE_CRM_CambiosRegistros.js", { ...EVENT_PROVIDERS, "N/runtime": runtimeMock(), "N/record": { load: record.load, submitFields: record.submitFields }, "N/search": searchMock(), "N/log": logMock(), "N/https": https });
        entry.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 7 } });
        expect(https.post.mock.calls.length).toBe(0);
    });
});

describe("User Event entry point (integrated)", () => {
    const RECEIPT = JSON.stringify({ schemaVersion: 2, received: true, persisted: true, eventId: EVENT_TEST_ID, netsuiteId: "214" });
    function userEvent({ runtime = runtimeMock(), record = recordMock(), post = () => ({ code: 200, body: RECEIPT }), log = logMock(), search = searchMock() } = {}) {
        const https = { createSecureString: vi.fn((arg) => arg.input), post: vi.fn(post) };
        const entry = loadAmd("SS2_1_UE_CRM_CambiosRegistros.js", { ...EVENT_PROVIDERS, "N/runtime": runtime, "N/record": { load: record.load, submitFields: record.submitFields }, "N/search": search, "N/log": log, "N/https": https });
        return { entry, https, record, log };
    }
    const save = (type = "salesorder", id = 214, eventType = "edit") => ({ type: eventType, newRecord: { type, id } });

    it("does not emit a mixed snapshot if NetSuite changes during record.load", () => {
        let n = 0;
        const search = { lookupFields: () => ({ ...Object.fromEntries(["custbody90", "custbody51", "custbody91", "custbody105", "custbody43", "custbody103", "custbody_ix_comision_pagada", "custbody_entrega_de_llaves", "custbody274", "custbody_cuotas_pagadas"].map((field) => [field, false])), lastmodifieddate: n++ === 0 ? "2026-11-02T20:00:00.000Z" : "2026-11-02T20:00:01.000Z" }) };
        const f = userEvent({ search });
        f.entry.afterSubmit(save());
        expect(f.https.post).not.toHaveBeenCalled();
        expect(f.log.error.mock.calls[0][0].details.status).toBe("snapshot_changed");
    });
    it("delivers a saved sales order: two consistent order loads, one POST, no writes", () => {
        const { entry, https, record, log } = userEvent();
        entry.afterSubmit(save());
        expect(record.load).toHaveBeenCalledTimes(2);
        expect(record.load).toHaveBeenNthCalledWith(1, { type: "salesorder", id: "214", isDynamic: false });
        expect(record.submitFields).not.toHaveBeenCalled();
        expect(https.post).toHaveBeenCalledOnce();
        expect(JSON.parse(https.post.mock.calls[0][0].body).snapshot.data.id).toBe("214");
        expect(JSON.parse(https.post.mock.calls[0][0].body).snapshot.data.fields.crm_owner_employee).toBe("70");
        expect(https.post.mock.calls[0][0].url.endsWith("/integrations/netsuite/local/order-events")).toBe(true);
        expect(log.debug).toHaveBeenCalledOnce();
        expect(log.debug.mock.calls[0][0].details).toMatchObject({ module: "salesOrders", status: "received_local", delivered: true });
    });
    it("logs an error but does not throw when the receiver rejects", () => {
        const { entry, log } = userEvent({ post: () => ({ code: 500, body: "x" }) });
        expect(() => entry.afterSubmit(save())).not.toThrow();
        expect(log.error.mock.calls[0][0].details).toMatchObject({ status: "receiver_rejected", delivered: false });
    });
    it("does not read the order or post when the record cannot be loaded", () => {
        const { entry, https, log } = userEvent({ record: recordMock({ loadError: nsError("RCRD_DSNT_EXIST") }) });
        expect(() => entry.afterSubmit(save())).not.toThrow();
        expect(https.post.mock.calls.length).toBe(0);
        expect(log.error.mock.calls[0][0].details).toMatchObject({ delivered: false });
    });
    it.each(["lead", "estimate", "partner"])("reports %s as pending without spending units", (type) => {
        const { entry, https, record, log } = userEvent();
        entry.afterSubmit(save(type, 5, "create"));
        expect(record.load).not.toHaveBeenCalled();
        expect(https.post.mock.calls.length).toBe(0);
        expect(log.debug.mock.calls[0][0].details.status).toBe("module_pending");
    });
    it("ignores deletes, unknown types and non-sandbox accounts with zero calls", () => {
        const blocked = userEvent({ runtime: runtimeMock({ accountId: "999" }) });
        blocked.entry.afterSubmit(save());
        const live = userEvent();
        live.entry.afterSubmit(save("salesorder", 214, "delete"));
        live.entry.afterSubmit(save("invoice"));
        for (const f of [blocked, live]) {
            expect(f.record.load).not.toHaveBeenCalled();
            expect(f.https.post).not.toHaveBeenCalled();
        }
    });
    it("exports only afterSubmit", () => {
        expect(Object.keys(userEvent().entry)).toEqual(["afterSubmit"]);
    });
});
