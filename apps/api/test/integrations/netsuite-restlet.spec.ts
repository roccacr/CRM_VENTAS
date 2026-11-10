import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { expect, it, vi } from "vitest";

function searchMock(flags: Record<string, unknown> = {}) {
    return { lookupFields: vi.fn(({ columns }: { columns: string[] }) => Object.fromEntries(columns.map((column) => [column, flags[column]]))) };
}
type Providers = Record<string, unknown>;
type AmdFactory = (...dependencies: unknown[]) => unknown;

/** Ejecuta el AMD real de un archivo y resuelve sus dependencias relativas (./lib/..., ../lib/...) recursivamente. */
function loadAmd(url: URL, providers: Providers, cache: Map<string, unknown>, nativeDependencies: Set<string>): unknown {
    if (cache.has(url.href)) return cache.get(url.href);
    let captured: { dependencies: string[]; factory: AmdFactory } | undefined;
    runInNewContext(readFileSync(url, "utf8"), {
        define: (dependencies: string[], factory: AmdFactory) => {
            captured = { dependencies, factory };
        },
    });
    if (!captured) throw new Error("define() was not called by " + url.href);
    const resolved = captured.dependencies.map((dependency) => {
        // Reproduce la ubicacion absoluta del File Cabinet usando los modulos locales reales.
        const cabinetRoot = "/SuiteScripts/";
        if (dependency.startsWith(cabinetRoot)) {
            return loadAmd(new URL(dependency.slice(cabinetRoot.length) + ".js", ENTRY), providers, cache, nativeDependencies);
        }
        if (!dependency.startsWith(".")) {
            nativeDependencies.add(dependency);
            return providers[dependency];
        }
        return loadAmd(new URL(dependency + ".js", url), providers, cache, nativeDependencies);
    });
    const exported = captured.factory(...resolved);
    cache.set(url.href, exported);
    return exported;
}

interface Doubles {
    logger?: { debug: unknown; error: unknown };
    search?: unknown;
    workflow?: { initiate: ReturnType<typeof vi.fn> };
}
const ENTRY = new URL("../../src/integrations/netsuite/suitescript/SS2_1_RL_CRM_Habita.js", import.meta.url);

/** Carga el RESTlet completo (entrada + lib + modules) con proveedores aislados; sin conexion a NetSuite. */
function load(accountId = "4552704_SB1", envType = "SANDBOX", record = recordMock(), { logger = { debug: vi.fn(), error: vi.fn() }, search = searchMock(), workflow = { initiate: vi.fn() } }: Doubles = {}) {
    const native = new Set<string>();
    const providers: Providers = { "N/runtime": { accountId, envType, EnvType: { SANDBOX: "SANDBOX", PRODUCTION: "PRODUCTION" }, getCurrentScript: () => ({ getParameter: () => undefined }) }, "N/record": record, "N/search": search, "N/log": logger, "N/workflow": workflow, "N/https": {}, "N/crypto/random": {}, "N/format": {} };
    const handlers = loadAmd(ENTRY, providers, new Map(), native) as Record<string, (request?: unknown) => unknown>;
    // Los modulos de apoyo solo pueden depender de estos servicios de NetSuite.
    expect([...native].sort()).toEqual(["N/crypto/random", "N/format", "N/https", "N/log", "N/record", "N/runtime", "N/search", "N/workflow"]);
    return handlers;
}
it("loads modules without accessing NetSuite APIs during define evaluation", () => {
    const record = recordMock();
    Object.defineProperty(record, "Type", {
        get: () => {
            throw new Error("SUITESCRIPT_API_UNAVAILABLE_IN_DEFINE");
        },
    });
    expect(Object.keys(load(undefined, undefined, record)).sort()).toEqual(["get", "put"]);
    expect(record.load).not.toHaveBeenCalled();
    expect(record.submitFields).not.toHaveBeenCalled();
});
it("exports only GET and PUT", () => {
    expect(Object.keys(load()).sort()).toEqual(["get", "put"]);
});
it.each(["get", "put"])("keeps %s unimplemented without a selected module", (method) => {
    expect(load()[method]?.()).toMatchObject({ status: 501, error: { code: "NOT_IMPLEMENTED" } });
});
it.each(["leads", "estimates"])("reserves GET and PUT for the %s module without executing business operations", (module) => {
    for (const method of ["get", "put"]) {
        expect(load()[method]?.({ module })).toMatchObject({ status: 501, error: { code: "NOT_IMPLEMENTED" } });
    }
});
it.each([null, [], "leads", 1, { module: "" }, { module: 1 }, { module: "unknown" }, { module: "toString" }, { module: "constructor" }, { module: "__proto__" }].map((request) => [request]))("rejects invalid or unregistered modules: %j", (request) => {
    for (const method of ["get", "put"]) {
        expect(load()[method]?.(request)).toMatchObject({ status: 400, error: { code: "INVALID_MODULE" } });
    }
});
it("never accepts an inherited module selector", () => {
    expect(load().get?.(Object.create({ module: "leads" }))).toMatchObject({ status: 400, error: { code: "INVALID_MODULE" } });
});
it.each([
    ["OTHER", "PRODUCTION"],
    ["OTHER_SB1", "SANDBOX"],
    ["4552704_SB1", "PRODUCTION"],
])("blocks both entry points outside the authorized account: %s / %s", (account, env) => {
    for (const method of ["get", "put"]) {
        expect(load(account, env)[method]?.({ module: "salesOrders" })).toMatchObject({ status: 403, error: { code: "ENVIRONMENT_NOT_AUTHORIZED" } });
    }
});

function recordMock(flags: Record<string, unknown> = {}) {
    return {
        submitFields: vi.fn(),
        Type: { SALES_ORDER: "salesorder" },
        load: vi.fn(() => ({
            getValue: vi.fn(({ fieldId }: { fieldId: string }): unknown => (({ tranid: "OV-214", total: "123456789.00100", custbody90: false, custbody188: 0, memo: "Nota", ...flags }) as Record<string, unknown>)[fieldId] ?? null),
            getText: vi.fn(({ fieldId }: { fieldId: string }) => (fieldId === "trandate" ? "28/10/2026" : fieldId === "custbody14" ? "0%" : "Etiqueta")),
            getLineCount: vi.fn(() => 1),
            getSublistText: vi.fn(({ fieldId }: { fieldId: string }) => (fieldId === "item" ? "Unidad" : "29/10/2026")),
            getSublistValue: vi.fn(({ fieldId }: { fieldId: string }) => (fieldId === "quantity" ? 0 : fieldId === "description" ? false : "123.4500")),
            toJSON: vi.fn(() => {
                throw new Error("RAW SECRET");
            }),
            save: vi.fn(() => {
                throw new Error("WRITE");
            }),
        })),
    };
}

const APPROVAL = { module: "salesOrders", action: "approveFormalization", id: "214" };
const READY = { custbody43: false, custbody_aprueba_jefe_ventas: true, custbodyid_firma_rocca: true, custbodyid_firma_rc: false };
it("reports a missing order as 404 instead of interpreting empty lookup fields as missing approvals", () => {
    const record = recordMock(READY);
    const search = searchMock();
    search.lookupFields.mockImplementation(() => {
        throw Object.assign(new Error("private"), { name: "RCRD_DSNT_EXIST" });
    });
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toMatchObject({ status: 404, error: { code: "SALES_ORDER_NOT_FOUND" } });
    expect(search.lookupFields).toHaveBeenCalledTimes(1);
    expect(record.load).not.toHaveBeenCalled();
    expect(record.submitFields).not.toHaveBeenCalled();
});
it("confirms an existing approval without rewriting it even if previous checks were later cleared", () => {
    const record = recordMock({ ...READY, custbody_aprueba_jefe_ventas: false, custbodyid_firma_rc: true });
    const search = searchMock({ ...READY, custbody_aprueba_jefe_ventas: false, custbodyid_firma_rc: true });
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toMatchObject({ status: 200, data: { approved: true, alreadyApproved: true } });
    expect(record.submitFields).not.toHaveBeenCalled();
});

it.each([false, true])("confirms formalization approval with alreadyApproved=%s after reading flags with lookupFields", (alreadyApproved) => {
    const record = recordMock({ ...READY, custbodyid_firma_rc: alreadyApproved });
    const search = searchMock({ ...READY, custbodyid_firma_rc: alreadyApproved });
    const workflow = { initiate: vi.fn() };
    // Tras escribir, la relectura debe devolver true.
    search.lookupFields.mockImplementation(({ columns }) => Object.fromEntries(columns.map((column) => [column, column === "custbodyid_firma_rc" && !alreadyApproved && workflow.initiate.mock.calls.length ? true : ({ ...READY, custbodyid_firma_rc: alreadyApproved } as Record<string, unknown>)[column]])));
    const logger = { debug: vi.fn(), error: vi.fn() };
    expect(load(undefined, undefined, record, { logger, search, workflow }).put?.(APPROVAL)).toEqual({ status: 200, data: { type: "salesorder", id: "214", approval: "formalization", approved: true, alreadyApproved } });
    // Las casillas se leen con lookupFields (no record.load); tras escribir hay una segunda lectura de confirmacion.
    expect(record.load).not.toHaveBeenCalled();
    expect(search.lookupFields).toHaveBeenCalledTimes(alreadyApproved ? 1 : 2);
    if (alreadyApproved) expect(workflow.initiate).not.toHaveBeenCalled();
    else expect(workflow.initiate).toHaveBeenCalledExactlyOnceWith({ recordType: "salesorder", recordId: "214", workflowId: "customworkflow219" });
    expect(record.submitFields).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
});

it.each(["custbody_aprueba_jefe_ventas", "custbodyid_firma_rocca", "custbody43"])("refuses approval when prerequisite %s fails", (blocked) => {
    const record = recordMock({ ...READY, [blocked]: blocked === "custbody43" });
    const search = searchMock({ ...READY, [blocked]: blocked === "custbody43" });
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toMatchObject({ status: 409 });
    expect(record.submitFields).not.toHaveBeenCalled();
});

it.each([{ action: "other" }, { action: "approveFormalization", extra: true }, { action: "approveFormalization", id: "9007199254740992" }, { action: "toString" }])("rejects unsupported approval inputs before any lookup: %j", (overrides) => {
    const record = recordMock(READY);
    const search = searchMock(READY);
    expect(load(undefined, undefined, record, { search }).put?.({ module: "salesOrders", id: "214", ...overrides })).toMatchObject({ status: 400 });
    expect(search.lookupFields).not.toHaveBeenCalled();
    expect(record.load).not.toHaveBeenCalled();
});

it.each([false, "T", null])("never confirms an unverified approval %j", (confirmation) => {
    const record = recordMock(READY);
    const search = searchMock(READY);
    const workflow = { initiate: vi.fn() };
    search.lookupFields.mockImplementation(({ columns }) => Object.fromEntries(columns.map((column) => [column, column === "custbodyid_firma_rc" && workflow.initiate.mock.calls.length ? confirmation : (READY as Record<string, unknown>)[column]])));
    const result = load(undefined, undefined, record, { search, workflow }).put?.(APPROVAL);
    expect(result).toMatchObject({ status: 502, error: { code: "FORMALIZATION_APPROVAL_UNCONFIRMED" } });
    expect(JSON.stringify(result)).not.toContain("no fue modificada");
});

it.each(["T", 1, null, undefined])("requires strict boolean prerequisite approvals: %j", (value) => {
    const record = recordMock({ ...READY, custbody_aprueba_jefe_ventas: value });
    const search = searchMock({ ...READY, custbody_aprueba_jefe_ventas: value });
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toMatchObject({ status: 409 });
    expect(record.submitFields).not.toHaveBeenCalled();
});

it.each(["initiate", "verify"])("sanitizes %s failures as unknown outcome with diagnostic and result logs", (failure) => {
    const record = recordMock(READY);
    const search = searchMock(READY);
    const workflow = { initiate: vi.fn() };
    if (failure === "initiate")
        workflow.initiate.mockImplementation(() => {
            throw new Error("PRIVATE_WRITE_ERROR");
        });
    else {
        // La primera lectura (casillas) es correcta; falla la relectura posterior a la escritura.
        let calls = 0;
        search.lookupFields.mockImplementation(({ columns }) => {
            calls += 1;
            if (calls > 1) throw new Error("PRIVATE_RELOAD_ERROR");
            return Object.fromEntries(columns.map((column) => [column, (READY as Record<string, unknown>)[column]]));
        });
    }
    const logger = { debug: vi.fn(), error: vi.fn() };
    const result = load(undefined, undefined, record, { logger, search, workflow }).put?.(APPROVAL);
    expect(result).toMatchObject({ status: 502, error: { code: "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN" } });
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error.mock.calls[0]?.[0]).toMatchObject({ title: "CRM: diagnostico aprobacion workflow", details: { phase: failure } });
    expect(logger.error.mock.calls[1]?.[0]).toMatchObject({ title: "CRM_v2_good_flow: resultado", details: { status: 502 } });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(JSON.stringify([result, logger.error.mock.calls])).not.toContain("PRIVATE_");
});

it("reports a read failure before any write as a definite error, not an unknown outcome", () => {
    const record = recordMock(READY);
    const search = searchMock(READY);
    const workflow = { initiate: vi.fn() };
    search.lookupFields.mockImplementation(() => {
        throw Object.assign(new Error("PII"), { name: "RCRD_DSNT_EXIST" });
    });
    expect(load(undefined, undefined, record, { search, workflow }).put?.(APPROVAL)).toEqual({ status: 404, error: { code: "SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe." } });
    search.lookupFields.mockImplementation(() => {
        throw new Error("PII");
    });
    expect(load(undefined, undefined, record, { search, workflow }).put?.(APPROVAL)).toMatchObject({ status: 502, error: { code: "SALES_ORDER_READ_ERROR" } });
    expect(workflow.initiate).not.toHaveBeenCalled();
    expect(record.submitFields).not.toHaveBeenCalled();
});
it("blocks approval writes outside the authorized account", () => {
    const record = recordMock(READY);
    expect(load("OTHER", "PRODUCTION", record).put?.({ module: "salesOrders", action: "approveFormalization", id: "214" })).toMatchObject({ status: 403 });
    expect(record.load).not.toHaveBeenCalled();
    expect(record.submitFields).not.toHaveBeenCalled();
});
it.each([undefined, "", "0", "-1", "1.5", "1e3", " 214", "214 ", "001", 214, true, {}, "9007199254740992"])("rejects invalid sales order ID %j before loading", (id) => {
    const record = recordMock();
    expect(load(undefined, undefined, record).get?.({ module: "salesOrders", id })).toMatchObject({ status: 400, error: { code: "INVALID_ID" } });
    expect(record.load).not.toHaveBeenCalled();
});
it("extracts only commercial scalar fields and display aliases without serialization or writes", () => {
    const record = recordMock();
    const loaded = record.load();
    record.load.mockClear();
    record.load.mockReturnValue(loaded);
    const result = load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" });
    expect(record.load).toHaveBeenCalledExactlyOnceWith({ type: "salesorder", id: "214", isDynamic: false });
    expect(result).toMatchObject({
        status: 200,
        data: { type: "salesorder", id: "214", fields: { initialtranid: "OV-214", total: "123456789.00100", custbody90: false, custbody188: "0", trandate: "28/10/2026", custbody14: "0%", currencyname: "Etiqueta" }, sublists: { item: { "line 1": { item_display: "Unidad", custcolfecha_pago_proyectado: "29/10/2026", quantity: "0", description: false, rate: "123.4500" } } } },
        cli: "Etiqueta",
        Subsidaria: "Etiqueta",
        FONDOS: "Etiqueta",
        MOTIVO_CANCE: "Etiqueta",
        Expediente: "Etiqueta",
        UNIDAD: "Etiqueta",
    });

    expect(loaded.toJSON).not.toHaveBeenCalled();
    expect(loaded.save).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/csrf|session|password|RAW SECRET/);
});
it("sanitizes provider load failures", () => {
    const record = recordMock();
    record.load.mockImplementation(() => {
        throw new Error("PII credential session");
    });
    expect(load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" })).toEqual({ status: 502, error: { code: "SALES_ORDER_READ_ERROR", message: "No se pudo consultar la orden de venta." } });
});
it.each([0, 1000, 1001])("handles %i lines without silent truncation", (count) => {
    const record = recordMock();
    const loaded = record.load();
    loaded.getLineCount.mockReturnValue(count);
    record.load.mockReturnValue(loaded);
    const result = load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" }) as { status: number; data?: { sublists: { item: object } }; error?: { code: string } };
    if (count > 1000) {
        expect(result).toMatchObject({ status: 422, error: { code: "ITEM_LINE_LIMIT_EXCEEDED" } });
        expect(loaded.getSublistValue).not.toHaveBeenCalled();
    } else {
        expect(result.status).toBe(200);
        expect(Object.keys(result.data?.sublists.item ?? {})).toHaveLength(count);
    }
});
it("keeps PUT disabled even for a valid sales order", () => {
    const record = recordMock();
    expect(load(undefined, undefined, record).put?.({ module: "salesOrders", id: "214" })).toMatchObject({ status: 501 });
    expect(record.load).not.toHaveBeenCalled();
});

it.each([Infinity, NaN, { password: "secret" }, ["session"], new Date("2026-10-28")])("omits unsupported provider values %j", (value) => {
    const record = recordMock();
    const loaded = record.load();
    const getValue = loaded.getValue.getMockImplementation();
    loaded.getValue.mockImplementation((field) => (field.fieldId === "memo" ? value : getValue?.(field)));
    record.load.mockReturnValue(loaded);
    const result = load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" });
    expect(result).toMatchObject({ status: 200, data: { fields: { memo: null } } });
    expect(JSON.stringify(result)).not.toMatch(/secret|session|2026-10-28T/);
});
it("sanitizes extraction errors without returning partial data", () => {
    const record = recordMock();
    const loaded = record.load();
    loaded.getSublistText.mockImplementation(() => {
        throw new Error("PII");
    });
    record.load.mockReturnValue(loaded);
    expect(load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" })).toEqual({ status: 502, error: { code: "SALES_ORDER_READ_ERROR", message: "No se pudo consultar la orden de venta." } });
});
it("reads dates and percentages exclusively as display text", () => {
    const record = recordMock();
    const loaded = record.load();
    record.load.mockReturnValue(loaded);
    load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" });
    for (const fieldId of ["trandate", "custbody68", "custbody114", "custbody140", "custbody208", "custbody206", "saleseffectivedate", "custbody14", "custbody20", "custbody60", "custbody62", "custbody63", "custbody64", "custbody65", "custbody66", "custbody67"]) {
        expect(loaded.getText).toHaveBeenCalledWith({ fieldId });
        expect(loaded.getValue).not.toHaveBeenCalledWith({ fieldId });
    }
});
it("does not load records outside the authorized account", () => {
    const record = recordMock();
    load("OTHER", "PRODUCTION", record).get?.({ module: "salesOrders", id: "214" });
    expect(record.load).not.toHaveBeenCalled();
});

it("maps the real tranid to the frontend initialtranid alias", () => {
    const record = recordMock();
    const loaded = record.load();
    record.load.mockReturnValue(loaded);
    expect(load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" })).toMatchObject({ data: { fields: { initialtranid: "OV-214" } } });
    expect(loaded.getValue).toHaveBeenCalledWith({ fieldId: "tranid" });
    expect(loaded.getValue).not.toHaveBeenCalledWith({ fieldId: "initialtranid" });
    expect(loaded.getText).toHaveBeenCalledWith({ fieldId: "custbody38" });
    expect(loaded.getText).toHaveBeenCalledWith({ fieldId: "custbodyix_exp_ligado_num_unid" });
});

it("returns a sanitized application 404 when NetSuite reports a missing order", () => {
    const record = recordMock();
    record.load.mockImplementation(() => {
        throw Object.assign(new Error("PII credential session"), { name: "RCRD_DSNT_EXIST" });
    });
    expect(load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" })).toEqual({
        status: 404,
        error: { code: "SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe." },
    });
});
it("does not classify a provider message as a missing-record error", () => {
    const record = recordMock();
    record.load.mockImplementation(() => {
        throw new Error("RCRD_DSNT_EXIST PII");
    });
    expect(load(undefined, undefined, record).get?.({ module: "salesOrders", id: "214" })).toEqual({
        status: 502,
        error: { code: "SALES_ORDER_READ_ERROR", message: "No se pudo consultar la orden de venta." },
    });
});

it("logs safe execution metadata without request or response data", () => {
    const logger = { debug: vi.fn(), error: vi.fn() };
    load(undefined, undefined, recordMock(), { logger }).get?.({ module: "salesOrders", id: "214", secret: "PRIVATE_TEST_DETAIL" });
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenLastCalledWith({ title: "CRM_v2_good_flow: resultado", details: { scriptVersion: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}\.\d+$/) as unknown, module: "salesOrders", action: "get", netsuiteId: "214", status: 200, durationMs: expect.any(Number) as unknown } });
    expect(logger.error).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.debug.mock.calls)).not.toMatch(/PRIVATE_TEST_DETAIL|Etiqueta|123456789/);
});
it("logs a sanitized failure code without the provider message", () => {
    const record = recordMock();
    record.load.mockImplementation(() => {
        throw new Error("PRIVATE_TEST_DETAIL");
    });
    const logger = { debug: vi.fn(), error: vi.fn() };
    load(undefined, undefined, record, { logger }).get?.({ module: "salesOrders", id: "214" });
    expect(logger.error).toHaveBeenCalledExactlyOnceWith({ title: "CRM_v2_good_flow: resultado", details: { scriptVersion: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}\.\d+$/) as unknown, module: "salesOrders", action: "get", netsuiteId: "214", status: 502, code: "SALES_ORDER_READ_ERROR", durationMs: expect.any(Number) as unknown } });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("PRIVATE_TEST_DETAIL");
});
it("keeps the response working when NetSuite logging fails", () => {
    const logger = {
        debug: vi.fn(() => {
            throw new Error("log unavailable");
        }),
        error: vi.fn(() => {
            throw new Error("log unavailable");
        }),
    };
    expect(load(undefined, undefined, recordMock(), { logger }).get?.({ module: "salesOrders", id: "214" })).toMatchObject({ status: 200 });
});

it("includes only validated order IDs in the single final log", () => {
    const logger = { debug: vi.fn(), error: vi.fn() };
    const handlers = load(undefined, undefined, recordMock(), { logger });
    handlers.get?.({ module: "salesOrders", id: "214" });
    expect(logger.debug).toHaveBeenCalledExactlyOnceWith({ title: "CRM_v2_good_flow: resultado", details: { scriptVersion: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}\.\d+$/) as unknown, module: "salesOrders", action: "get", netsuiteId: "214", status: 200, durationMs: expect.any(Number) as unknown } });
    logger.debug.mockClear();
    handlers.get?.({ module: "salesOrders", id: "invalid" });
    expect(logger.debug).toHaveBeenCalledExactlyOnceWith({ title: "CRM_v2_good_flow: resultado", details: { scriptVersion: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}\.\d+$/) as unknown, module: "salesOrders", action: "get", status: 400, code: "INVALID_ID", durationMs: expect.any(Number) as unknown } });
});

// Intercalado determinista de dos peticiones: no equivale a una prueba de carga en NetSuite.
it("keeps approval true when two requests read the same previous value", () => {
    const record = recordMock(READY);
    let approved = false;
    let secondResponse: unknown;
    const originalLoad = record.load.getMockImplementation();
    if (!originalLoad) throw new Error("Falta el doble de carga de la orden");
    record.load.mockImplementation(() => {
        const loaded = originalLoad();
        loaded.getValue.mockImplementation(({ fieldId }) => (fieldId === "custbodyid_firma_rc" ? approved : READY[fieldId as keyof typeof READY]));
        return loaded;
    });
    const search = searchMock();
    search.lookupFields.mockImplementation(({ columns }) => Object.fromEntries(columns.map((column) => [column, column === "custbodyid_firma_rc" ? approved : READY[column as keyof typeof READY]])));
    const workflow = { initiate: vi.fn() };
    const handlers = load(undefined, undefined, record, { search, workflow });
    workflow.initiate.mockImplementation(() => {
        if (workflow.initiate.mock.calls.length === 1) secondResponse = handlers.put?.(APPROVAL);
        approved = true;
    });
    expect(handlers.put?.(APPROVAL)).toMatchObject({ status: 200 });
    expect(secondResponse).toMatchObject({ status: 200 });
    expect(approved).toBe(true);
    // Ambas lecturas fueron previas a la escritura: el flujo no promete exclusion mutua.
    expect(workflow.initiate).toHaveBeenCalledTimes(2);
    expect(record.submitFields).not.toHaveBeenCalled();
});

it.each([0, 1, 2])("resolves only one exact NetSuite transaction number (%i matches)", (count) => {
    const getRange = vi.fn().mockReturnValue(Array.from({ length: count }, (_, index) => ({ id: String(8906821 + index), getValue: () => "BC448" })));
    const create = vi.fn(() => ({ run: () => ({ getRange }) }));
    const record = recordMock();
    const restlet = load(undefined, undefined, record, { search: { Type: { SALES_ORDER: "salesorder" }, create } });
    const result = restlet.get?.({ module: "salesOrders", action: "findByTranId", tranid: "BC448" });
    expect(result).toMatchObject(count === 1 ? { status: 200, data: { id: "8906821", tranid: "BC448" } } : { status: count === 0 ? 404 : 409, error: { code: count === 0 ? "SALES_ORDER_NOT_FOUND" : "SALES_ORDER_AMBIGUOUS" } });
    expect(create).toHaveBeenCalledWith({ type: "salesorder", filters: [["mainline", "is", "T"], "and", ["tranid", "is", "BC448"]], columns: ["internalid", "tranid"] });
    expect(getRange).toHaveBeenCalledWith({ start: 0, end: 2 });
    expect(record.load).not.toHaveBeenCalled();
});

it.each([
    { campaignId: 651, campaignName: "Gogetit Leads" },
    { campaignId: -3, campaignName: "Llamada" },
])("looks up a customer and preserves campaign ID $campaignId", ({ campaignId, campaignName }) => {
    const lookupFields = vi.fn(() => ({ firstname: "Ana", lastname: "Prueba", email: "synthetic@example.test", leadsource: [{ value: campaignId, text: campaignName }], privateField: "omitted" }));
    const restlet = load(undefined, undefined, undefined, { search: { Type: { CUSTOMER: "customer" }, lookupFields } });
    expect(restlet.get?.({ module: "leads", action: "importCustomer", id: "2034401" })).toEqual({
        status: 200,
        data: { id: "2034401", fullName: "Ana Prueba", email: "synthetic@example.test", company: null, phone: null, campaign: String(campaignId), campaignName },
    });
    expect(lookupFields).toHaveBeenCalledOnce();
});

it.each([
    { kind: "subsidiary", type: "subsidiary", field: "name", value: "Subsidiaria de prueba" },
    { kind: "user", type: "employee", field: "email", value: "synthetic@example.test" },
])("reads only the allowed field for a $kind relation", ({ kind, type, field, value }) => {
    const lookupFields = vi.fn(() => ({ [field]: value, extra: "omitted" }));
    const restlet = load(undefined, undefined, undefined, { search: { Type: { SUBSIDIARY: "subsidiary", EMPLOYEE: "employee" }, lookupFields } });
    expect(restlet.get?.({ module: "salesOrders", action: "importRelation", kind, id: "13" })).toEqual({ status: 200, data: { id: "13", value } });
    expect(lookupFields).toHaveBeenCalledExactlyOnceWith({ type, id: "13", columns: [field] });
    expect(restlet.get?.({ module: "salesOrders", action: "importRelation", kind: "other", id: "13" })).toMatchObject({ status: 400, error: { code: "INVALID_RELATION" } });
    expect(lookupFields).toHaveBeenCalledOnce();
});

it("loads the unit by internal ID and returns its code and principal project ID", () => {
    const record = recordMock();
    const getValue = vi.fn(({ fieldId }) => (fieldId === "name" ? "TEST-FF01" : 1805));
    const getText = vi.fn(() => "Proyecto de prueba");
    record.load.mockReturnValue({ getValue, getText } as never);
    const restlet = load(undefined, undefined, record);
    expect(restlet.get?.({ module: "salesOrders", action: "importRelation", kind: "unitFile", id: "8771" })).toEqual({
        status: 200,
        data: { id: "8771", code: "TEST-FF01", projectId: "1805", projectName: "Proyecto de prueba" },
    });
    expect(record.load).toHaveBeenCalledExactlyOnceWith({ type: "customrecord_ix_record_exp_unidades", id: "8771" });
    expect(getValue).toHaveBeenCalledWith({ fieldId: "custrecord_163_csegix_proyectos" });
    expect(getText).toHaveBeenCalledWith({ fieldId: "custrecord_163_csegix_proyectos" });
});
