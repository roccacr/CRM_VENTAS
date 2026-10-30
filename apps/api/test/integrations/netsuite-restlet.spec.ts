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
        const cabinetRoot = "/SuiteScripts/CRM TINK/";
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
}
const ENTRY = new URL("../../src/integrations/netsuite/suitescript/SS2_1_RL_CRM_Integracion.js", import.meta.url);

/** Carga el RESTlet completo (entrada + lib + modules) con proveedores aislados; sin conexion a NetSuite. */
function load(accountId = "4552704_SB1", envType = "SANDBOX", record = recordMock(), { logger = { debug: vi.fn(), error: vi.fn() }, search = searchMock() }: Doubles = {}) {
    const native = new Set<string>();
    const providers: Providers = { "N/runtime": { accountId, envType, EnvType: { SANDBOX: "SANDBOX" } }, "N/record": record, "N/search": search, "N/log": logger };
    const handlers = loadAmd(ENTRY, providers, new Map(), native) as Record<string, (request?: unknown) => unknown>;
    // Los modulos de apoyo solo pueden depender de estos servicios de NetSuite.
    expect([...native].sort()).toEqual(["N/log", "N/record", "N/runtime", "N/search"]);
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
    ["4552704", "PRODUCTION"],
    ["OTHER_SB1", "SANDBOX"],
    ["4552704_SB1", "PRODUCTION"],
])("blocks both entry points outside the exact sandbox: %s / %s", (account, env) => {
    for (const method of ["get", "put"]) {
        expect(load(account, env)[method]?.({ module: "salesOrders" })).toMatchObject({ status: 403, error: { code: "SANDBOX_REQUIRED" } });
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
it("checks existence before interpreting empty lookup fields as missing approvals", () => {
    const record = recordMock(READY);
    record.load.mockImplementation(() => {
        throw Object.assign(new Error("private"), { name: "RCRD_DSNT_EXIST" });
    });
    const search = searchMock();
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toMatchObject({ status: 404, error: { code: "SALES_ORDER_NOT_FOUND" } });
    expect(search.lookupFields).not.toHaveBeenCalled();
    expect(record.submitFields).not.toHaveBeenCalled();
});
it("confirms an existing approval without rewriting it even if previous checks were later cleared", () => {
    const record = recordMock({ ...READY, custbody_aprueba_jefe_ventas: false, custbodyid_firma_rc: true });
    const search = searchMock({ ...READY, custbody_aprueba_jefe_ventas: false, custbodyid_firma_rc: true });
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toMatchObject({ status: 200, data: { approved: true, alreadyApproved: true } });
    expect(record.submitFields).not.toHaveBeenCalled();
});

it.each([false, true])("confirms formalization approval with alreadyApproved=%s after proving existence and reading flags", (alreadyApproved) => {
    const record = recordMock({ ...READY, custbodyid_firma_rc: alreadyApproved });
    const search = searchMock({ ...READY, custbodyid_firma_rc: alreadyApproved });
    // Tras escribir, la relectura debe devolver true.
    search.lookupFields.mockImplementation(({ columns }) => Object.fromEntries(columns.map((column) => [column, column === "custbodyid_firma_rc" && !alreadyApproved && record.submitFields.mock.calls.length ? true : ({ ...READY, custbodyid_firma_rc: alreadyApproved } as Record<string, unknown>)[column]])));
    const logger = { debug: vi.fn(), error: vi.fn() };
    expect(load(undefined, undefined, record, { logger, search }).put?.(APPROVAL)).toEqual({ status: 200, data: { type: "salesorder", id: "214", approval: "formalization", approved: true, alreadyApproved } });
    expect(record.load).toHaveBeenCalledExactlyOnceWith({ type: "salesorder", id: "214", isDynamic: false });
    expect(search.lookupFields).toHaveBeenCalledTimes(alreadyApproved ? 0 : 1);
    if (alreadyApproved) expect(record.submitFields).not.toHaveBeenCalled();
    else expect(record.submitFields).toHaveBeenCalledExactlyOnceWith({ type: "salesorder", id: "214", values: { custbodyid_firma_rc: true }, options: { enableSourcing: false, ignoreMandatoryFields: false } });
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
    search.lookupFields.mockImplementation(({ columns }) => Object.fromEntries(columns.map((column) => [column, column === "custbodyid_firma_rc" && record.submitFields.mock.calls.length ? confirmation : (READY as Record<string, unknown>)[column]])));
    const result = load(undefined, undefined, record, { search }).put?.(APPROVAL);
    expect(result).toMatchObject({ status: 502, error: { code: "FORMALIZATION_APPROVAL_UNCONFIRMED" } });
    expect(JSON.stringify(result)).not.toContain("no fue modificada");
});

it.each(["T", 1, null, undefined])("requires strict boolean prerequisite approvals: %j", (value) => {
    const record = recordMock({ ...READY, custbody_aprueba_jefe_ventas: value });
    const search = searchMock({ ...READY, custbody_aprueba_jefe_ventas: value });
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toMatchObject({ status: 409 });
    expect(record.submitFields).not.toHaveBeenCalled();
});

it.each(["submit", "reload"])("sanitizes %s failures as unknown outcome with a single final log", (failure) => {
    const record = recordMock(READY);
    const search = searchMock(READY);
    if (failure === "submit")
        record.submitFields.mockImplementation(() => {
            throw new Error("PRIVATE_WRITE_ERROR");
        });
    else
        search.lookupFields.mockImplementationOnce(() => {
            throw new Error("PRIVATE_RELOAD_ERROR");
        });
    const logger = { debug: vi.fn(), error: vi.fn() };
    const result = load(undefined, undefined, record, { logger, search }).put?.(APPROVAL);
    expect(result).toMatchObject({ status: 502, error: { code: "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN" } });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.debug).not.toHaveBeenCalled();
    expect(JSON.stringify([result, logger.error.mock.calls])).not.toContain("PRIVATE_");
});

it("reports a read failure before any write as a definite error, not an unknown outcome", () => {
    const record = recordMock(READY);
    const search = searchMock(READY);
    record.load.mockImplementation(() => {
        throw Object.assign(new Error("PII"), { name: "RCRD_DSNT_EXIST" });
    });
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toEqual({ status: 404, error: { code: "SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe." } });
    record.load.mockImplementation(() => {
        throw new Error("PII");
    });
    expect(load(undefined, undefined, record, { search }).put?.(APPROVAL)).toMatchObject({ status: 502, error: { code: "SALES_ORDER_READ_ERROR" } });
    expect(record.submitFields).not.toHaveBeenCalled();
});
it("blocks approval writes outside sandbox", () => {
    const record = recordMock(READY);
    expect(load("4552704", "PRODUCTION", record).put?.({ module: "salesOrders", action: "approveFormalization", id: "214" })).toMatchObject({ status: 403 });
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
    loaded.getValue.mockReturnValue(value);
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
it("does not load records outside the exact sandbox", () => {
    const record = recordMock();
    load("4552704", "PRODUCTION", record).get?.({ module: "salesOrders", id: "214" });
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
    expect(logger.debug).toHaveBeenLastCalledWith({ title: "CRM_v2_good_flow: resultado", details: { scriptVersion: "2026.10.28.5", module: "salesOrders", action: "get", netsuiteId: "214", status: 200, durationMs: expect.any(Number) as unknown } });
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
    expect(logger.error).toHaveBeenCalledExactlyOnceWith({ title: "CRM_v2_good_flow: resultado", details: { scriptVersion: "2026.10.28.5", module: "salesOrders", action: "get", netsuiteId: "214", status: 502, code: "SALES_ORDER_READ_ERROR", durationMs: expect.any(Number) as unknown } });
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
    expect(logger.debug).toHaveBeenCalledExactlyOnceWith({ title: "CRM_v2_good_flow: resultado", details: { scriptVersion: "2026.10.28.5", module: "salesOrders", action: "get", netsuiteId: "214", status: 200, durationMs: expect.any(Number) as unknown } });
    logger.debug.mockClear();
    handlers.get?.({ module: "salesOrders", id: "invalid" });
    expect(logger.debug).toHaveBeenCalledExactlyOnceWith({ title: "CRM_v2_good_flow: resultado", details: { scriptVersion: "2026.10.28.5", module: "salesOrders", action: "get", status: 400, code: "INVALID_ID", durationMs: expect.any(Number) as unknown } });
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
    const handlers = load(undefined, undefined, record, { search });
    record.submitFields.mockImplementation(() => {
        if (record.submitFields.mock.calls.length === 1) secondResponse = handlers.put?.(APPROVAL);
        approved = true;
    });
    expect(handlers.put?.(APPROVAL)).toMatchObject({ status: 200 });
    expect(secondResponse).toMatchObject({ status: 200 });
    expect(approved).toBe(true);
    // Ambas lecturas fueron previas a la escritura: el flujo no promete exclusion mutua.
    expect(record.submitFields).toHaveBeenCalledTimes(2);
});
