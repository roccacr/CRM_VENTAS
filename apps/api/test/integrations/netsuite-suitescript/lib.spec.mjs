import { describe, expect, it, vi } from "vitest";

import { EVENT_PROVIDERS, EVENT_TEST_ID, loadAmd, logMock, nsError, recordMock, runtimeMock, searchMock } from "./amd-harness.mjs";

const lib = (name, providers = {}) => loadAmd("SS2_1_LIB_CRM_habita.js", providers)[name];
const throwing = (error) => () => {
    throw error;
};

describe("Respuestas", () => {
    const { fail, ok, notImplemented } = lib("responses");
    it("builds the single success and error shapes", () => {
        expect(ok({ a: 1 })).toEqual({ status: 200, data: { a: 1 } });
        expect(fail(400, "X", "msg")).toEqual({ status: 400, error: { code: "X", message: "msg" } });
        expect(notImplemented()).toMatchObject({ status: 501, error: { code: "NOT_IMPLEMENTED" } });
    });
    it("exports a frozen API", () => expect(Object.isFrozen(lib("responses"))).toBe(true));
});

describe("Validacion", () => {
    const { hasOwn, isValidId, invalidIdResponse } = lib("validation");
    it("hasOwn ignores inherited properties", () => {
        expect(hasOwn({ a: 1 }, "a")).toBe(true);
        expect(hasOwn(Object.create({ a: 1 }), "a")).toBe(false);
        expect(hasOwn({}, "toString")).toBe(false);
        expect(hasOwn({ hasOwnProperty: 1 }, "hasOwnProperty")).toBe(true);
    });
    it.each(["1", "214", "12014949", "999999999999999"])("accepts the canonical ID %s", (id) => {
        expect(isValidId({ id })).toBe(true);
        expect(invalidIdResponse({ id })).toBeNull();
    });
    it.each(["", "0", "01", "-1", "+1", "1.5", "1e3", " 1", "1 ", "0x10", "abc", "1000000000000000", "9007199254740991", "9007199254740993", "1".repeat(400), 1, 0, null, undefined, [], {}, true, ["1"]])("rejects the ID %j", (id) => {
        expect(isValidId({ id })).toBe(false);
        expect(invalidIdResponse({ id })).toMatchObject({ status: 400, error: { code: "INVALID_ID" } });
    });
    it("rejects a missing or inherited id", () => {
        expect(isValidId({})).toBe(false);
        expect(isValidId(Object.create({ id: "5" }))).toBe(false);
    });
});

describe("Campos", () => {
    const campos = lib("fields");
    const { fieldMap, mapFields, bodyValue, bodyText, readSublist } = campos;
    it("exports only what consumers use", () => {
        expect(Object.keys(campos).sort()).toEqual(["bodyText", "bodyValue", "fieldMap", "mapFields", "readSublist"]);
        expect(Object.isFrozen(campos)).toBe(true);
    });
    it("fieldMap splits on any whitespace and ignores edges", () => {
        expect(fieldMap("  a\n  b\tc ")).toEqual({ a: "a", b: "b", c: "c" });
    });
    it("mapFields normalizes to serializable scalars only", () => {
        const values = {
            s: "x",
            empty: "",
            t: true,
            f: false,
            n: 12.5,
            zero: 0,
            nan: NaN,
            inf: Infinity,
            big: 123456789.001,
            date: new Date(0),
            obj: { a: 1 },
            arr: [1],
            nul: null,
            undef: undefined,
            fn: () => 1,
        };
        const result = mapFields(Object.fromEntries(Object.keys(values).map((k) => [k, k])), (id) => values[id]);
        expect(result).toEqual({
            s: "x",
            empty: "",
            t: true,
            f: false,
            n: "12.5",
            zero: "0",
            nan: null,
            inf: null,
            big: "123456789.001",
            date: null,
            obj: null,
            arr: null,
            nul: null,
            undef: null,
            fn: null,
        });
        expect(() => JSON.stringify(result)).not.toThrow();
    });
    it("mapFields maps response keys to NetSuite ids and reads each field once", () => {
        const read = vi.fn((id) => `v-${id}`);
        expect(mapFields({ alias: "real", other: "o" }, read)).toEqual({ alias: "v-real", other: "v-o" });
        expect(read).toHaveBeenCalledTimes(2);
    });
    it("bodyValue uses getValue and bodyText uses getText", () => {
        const rec = { getValue: vi.fn(() => 1), getText: vi.fn(() => "t") };
        expect(bodyValue(rec)("f")).toBe(1);
        expect(bodyText(rec)("f")).toBe("t");
        expect(rec.getValue).toHaveBeenCalledWith({ fieldId: "f" });
        expect(rec.getText).toHaveBeenCalledWith({ fieldId: "f" });
    });
    describe("readSublist", () => {
        const schema = { texts: { label: "item" }, values: { quantity: "quantity" } };
        it("numbers lines from 1 and merges texts and values", () => {
            const { rec } = recordMock({ lineCount: 2 });
            expect(readSublist(rec, "item", schema, 10)).toEqual({
                "line 1": { label: "item-t0", quantity: "1" },
                "line 2": { label: "item-t1", quantity: "2" },
            });
        });
        it("accepts exactly maxLines and returns null above it without reading any line", () => {
            const exact = recordMock({ lineCount: 3 }).rec;
            expect(Object.keys(readSublist(exact, "item", schema, 3))).toHaveLength(3);
            const over = recordMock({ lineCount: 4 }).rec;
            expect(readSublist(over, "item", schema, 3)).toBeNull();
            expect(over.getSublistText).not.toHaveBeenCalled();
            expect(over.getSublistValue).not.toHaveBeenCalled();
        });
        it("returns an empty object for an empty sublist and tolerates missing maps", () => {
            expect(readSublist(recordMock({ lineCount: 0 }).rec, "item", {}, 5)).toEqual({});
            expect(readSublist(recordMock({ lineCount: 1 }).rec, "item", {}, 5)).toEqual({ "line 1": {} });
        });
        it.each([-1, NaN, 1.5, "2", null, undefined])("throws on the invalid line count %j", (count) => {
            const { rec } = recordMock();
            rec.getLineCount.mockReturnValue(count);
            expect(() => readSublist(rec, "item", schema, 5)).toThrow("Invalid line count");
        });
    });
});

describe("ErroresProveedor", () => {
    const { providerError } = lib("providerErrors");
    const errors = { notFound: { code: "NF", message: "no existe" }, readFailed: { code: "RF", message: "fallo" } };
    it("maps RCRD_DSNT_EXIST to 404", () => {
        expect(providerError(nsError("RCRD_DSNT_EXIST"), errors)).toEqual({ status: 404, error: { code: "NF", message: "no existe" } });
    });
    it.each([nsError("SSS_USAGE_LIMIT_EXCEEDED"), nsError("INSUFFICIENT_PERMISSION"), new Error("boom"), null, undefined, "RCRD_DSNT_EXIST", { name: undefined }, 42])("maps anything else (%j) to 502 without leaking the provider message", (error) => {
        const response = providerError(error, errors);
        expect(response).toEqual({ status: 502, error: { code: "RF", message: "fallo" } });
        expect(JSON.stringify(response)).not.toContain("SECRET");
    });
    it("looks at error.name only, never at error.message", () => {
        expect(providerError({ name: "Error", message: "RCRD_DSNT_EXIST" }, errors).status).toBe(502);
    });
});

describe("ConsultarPorId.readById", () => {
    const { readById } = lib("readByIdFlow");
    const errors = { notFound: { code: "NF", message: "m" }, readFailed: { code: "RF", message: "m" } };
    it("rejects an invalid ID before reading (no governance spent)", () => {
        const read = vi.fn();
        expect(readById({ id: "abc" }, read, errors)).toMatchObject({ status: 400, error: { code: "INVALID_ID" } });
        expect(read).not.toHaveBeenCalled();
    });
    it("returns the read result and reads exactly once", () => {
        const read = vi.fn(() => ({ status: 200 }));
        expect(readById({ id: "7" }, read, errors)).toEqual({ status: 200 });
        expect(read).toHaveBeenCalledExactlyOnceWith("7");
    });
    it("translates provider exceptions", () => {
        expect(readById({ id: "7" }, throwing(nsError("RCRD_DSNT_EXIST")), errors).status).toBe(404);
        expect(readById({ id: "7" }, throwing(new Error("x")), errors).status).toBe(502);
    });
});

describe("EjecutarAccion.runAction", () => {
    const { runAction } = lib("runActionFlow");
    const action = vi.fn(() => ({ status: 200 }));
    const run = (request) => {
        action.mockClear();
        return runAction(request, { approve: action });
    };
    it("follows the contract order: no action 501, bad action 400, extra keys 400, bad ID 400", () => {
        expect(run({ module: "m", id: "1" })).toMatchObject({ status: 501 });
        expect(run({ action: "nope", id: "1" })).toMatchObject({ status: 400, error: { code: "INVALID_ACTION" } });
        expect(run({ action: "approve", id: "1", extra: 1 })).toMatchObject({ status: 400, error: { code: "INVALID_REQUEST" } });
        expect(run({ action: "approve", id: "x" })).toMatchObject({ status: 400, error: { code: "INVALID_ID" } });
        expect(action).not.toHaveBeenCalled();
    });
    it.each(["toString", "constructor", "__proto__", 1, null, ["approve"], {}])("rejects the non-registered action %j", (name) => {
        expect(run({ action: name, id: "1" })).toMatchObject({ error: { code: "INVALID_ACTION" } });
        expect(action).not.toHaveBeenCalled();
    });
    it("prefers INVALID_ACTION over INVALID_REQUEST when both apply", () => {
        expect(run({ action: "nope", extra: 1 })).toMatchObject({ error: { code: "INVALID_ACTION" } });
    });
    it("runs the action once with the ID", () => {
        expect(run({ module: "m", action: "approve", id: "9" })).toEqual({ status: 200 });
        expect(action).toHaveBeenCalledExactlyOnceWith("9");
    });
});

describe("Logs.executionLog", () => {
    it("forwards to the chosen level with the script version and never mutates details", () => {
        const log = logMock();
        const details = { a: 1 };
        lib("logging", { "N/log": log }).executionLog("debug", "t", details);
        expect(log.debug).toHaveBeenCalledExactlyOnceWith({
            title: "t",
            details: { a: 1, scriptVersion: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}\.\d+$/) },
        });
        expect(details).toEqual({ a: 1 });
    });
    it("swallows logger failures, unknown levels and missing details", () => {
        const { executionLog } = lib("logging", { "N/log": { debug: throwing(new Error("down")) } });
        expect(() => executionLog("debug", "t", {})).not.toThrow();
        expect(() => executionLog("nope", "t", {})).not.toThrow();
        expect(() => executionLog("debug", "t")).not.toThrow();
    });
});

describe("Registros", () => {
    it("declares the type without touching NetSuite APIs during define", () => {
        const record = {};
        Object.defineProperty(record, "Type", { get: throwing(new Error("UNAVAILABLE_IN_DEFINE")) });
        const registros = lib("records", { "N/record": record, "N/search": {} });
        expect(registros.RECORD_TYPES.SALES_ORDER).toBe("salesorder");
        expect(Object.isFrozen(registros.RECORD_TYPES)).toBe(true);
    });
    it("loads in standard mode, looks up by columns and writes one flag without sourcing", () => {
        const record = { load: vi.fn(() => "REC"), submitFields: vi.fn() };
        const search = searchMock({ f: true });
        const { loadRecord, lookupFlags, writeFlag } = lib("records", { "N/record": record, "N/search": search });
        expect(loadRecord("salesorder", "5")).toBe("REC");
        expect(record.load).toHaveBeenCalledWith({ type: "salesorder", id: "5", isDynamic: false });
        expect(lookupFlags("salesorder", "5", ["f"])).toEqual({ f: true });
        expect(search.lookupFields).toHaveBeenCalledWith({ type: "salesorder", id: "5", columns: ["f"] });
        writeFlag("salesorder", "5", "f");
        expect(record.submitFields).toHaveBeenCalledExactlyOnceWith({
            type: "salesorder",
            id: "5",
            values: { f: true },
            options: { enableSourcing: false, ignoreMandatoryFields: false },
        });
    });
});

describe("Entorno", () => {
    const check = (runtime) => lib("environment", { "N/runtime": runtime }).isAuthorizedEnvironment();
    it("authorizes only the account configured for a supported environment", () => {
        expect(check(runtimeMock())).toBe(true);
        expect(check(runtimeMock({ accountId: "4552704" }))).toBe(false);
        expect(check(runtimeMock({ accountId: "OTHER_SB1" }))).toBe(false);
        expect(check(runtimeMock({ envType: "PRODUCTION" }))).toBe(false);
        expect(check(runtimeMock({ envType: "PRODUCTION", accountId: "4552704" }))).toBe(true);
        expect(check(runtimeMock({ configuredAccount: "OTHER_SB1" }))).toBe(false);
        expect(check({ ...runtimeMock(), accountId: undefined })).toBe(false);
    });
    it("evaluates at call time and exports a frozen API", () => {
        const runtime = runtimeMock();
        const entorno = lib("environment", { "N/runtime": runtime });
        runtime.envType = "PRODUCTION";
        expect(entorno.isAuthorizedEnvironment()).toBe(false);
        expect(entorno.getEnvironmentName()).toBe("production");
        expect(Object.isFrozen(entorno)).toBe(true);
    });
});

describe("Eventos.afterSubmit", () => {
    const setup = ({ runtime = runtimeMock(), log = logMock() } = {}) => ({
        log,
        afterSubmit: lib("events", { "N/runtime": runtime, "N/log": log }).afterSubmit,
    });
    const handler = (result = { status: "received_local", delivered: true }) => vi.fn(() => result);
    const ctx = (over = {}) => ({ type: "edit", newRecord: { type: "salesorder", id: 214 }, ...over });

    it("does nothing outside the authorized sandbox", () => {
        const { afterSubmit, log } = setup({ runtime: runtimeMock({ envType: "PRODUCTION" }) });
        const mod = handler();
        afterSubmit(ctx(), { salesorder: { code: "salesOrders", afterSubmit: mod } });
        expect(mod).not.toHaveBeenCalled();
        expect(log.debug).not.toHaveBeenCalled();
    });
    it.each([
        ["no context", undefined],
        ["no record", {}],
        ["delete", ctx({ type: "delete" })],
        ["unknown event", ctx({ type: "view" })],
        ["unregistered type", ctx({ newRecord: { type: "invoice", id: 1 } })],
        ["inherited type", ctx({ newRecord: { type: "toString", id: 1 } })],
        ["null id", ctx({ newRecord: { type: "salesorder", id: null } })],
        ["bad id", ctx({ newRecord: { type: "salesorder", id: "0" } })],
    ])("ignores silently: %s", (_name, context) => {
        const { afterSubmit, log } = setup();
        const mod = handler();
        expect(() => afterSubmit(context, { salesorder: { code: "salesOrders", afterSubmit: mod } })).not.toThrow();
        expect(mod).not.toHaveBeenCalled();
        expect(log.debug).not.toHaveBeenCalled();
        expect(log.error).not.toHaveBeenCalled();
    });
    it.each(["create", "edit", "xedit", "approve", "cancel", "reject"])("dispatches the %s event with string ID and metadata only", (type) => {
        const { afterSubmit, log } = setup();
        const mod = handler();
        afterSubmit(ctx({ type }), { salesorder: { code: "salesOrders", afterSubmit: mod } });
        expect(mod).toHaveBeenCalledExactlyOnceWith({ recordType: "salesorder", netsuiteId: "214", eventType: type });
        expect(log.debug).toHaveBeenCalledOnce();
    });
    it("reports reserved modules as pending at debug level", () => {
        const { afterSubmit, log } = setup();
        afterSubmit(ctx({ newRecord: { type: "partner", id: 3 } }), { partner: { code: "brokers" } });
        expect(log.debug.mock.calls[0][0].details).toMatchObject({ module: "brokers", status: "module_pending", delivered: false });
    });
    it("logs undelivered results as errors and never includes the record or free text", () => {
        const { afterSubmit, log } = setup();
        const result = { status: "delivery_failed", delivered: false, leak: "SECRET" };
        afterSubmit(ctx(), { salesorder: { code: "salesOrders", afterSubmit: handler(result) } });
        expect(log.error).toHaveBeenCalledOnce();
        expect(JSON.stringify(log.error.mock.calls)).not.toContain("SECRET");
        expect(log.error.mock.calls[0][0].details).toMatchObject({ recordType: "salesorder", status: "delivery_failed", delivered: false });
    });
    it("never throws to the user when the module or the logger fails", () => {
        const { afterSubmit, log } = setup();
        afterSubmit(ctx(), { salesorder: { code: "salesOrders", afterSubmit: throwing(new Error("SECRET")) } });
        expect(log.error.mock.calls[0][0]).toMatchObject({ title: "CRM_v2: evento no procesado", details: { code: "USER_EVENT_FAILED" } });
        expect(JSON.stringify(log.error.mock.calls)).not.toContain("SECRET");
        const noisy = setup({ log: { debug: throwing(new Error("log down")), error: throwing(new Error("log down")) } });
        expect(() => noisy.afterSubmit(ctx(), { salesorder: { code: "s", afterSubmit: handler() } })).not.toThrow();
    });
});

describe("EnviarEvento.sendRecordEvent", () => {
    const EVENT = { recordType: "salesorder", netsuiteId: "214", eventType: "edit" };
    const GOOD_URL = "https://abc-def.example.test/integrations/netsuite/local";
    const receipt = (over = {}) => JSON.stringify({ schemaVersion: 2, received: true, persisted: true, eventId: EVENT_TEST_ID, netsuiteId: "214", ...over });
    const setup = ({ runtime = runtimeMock(), post } = {}) => {
        const https = {
            createSecureString: vi.fn(({ input }) => `SECURE(${input})`),
            post: vi.fn(post ?? (() => ({ code: 200, body: receipt() }))),
        };
        const { sendRecordEvent } = lib("delivery", { ...EVENT_PROVIDERS, "N/https": https, "N/runtime": runtime });
        // Por defecto se usa el endpoint de ordenes; los casos dinamicos pasan el suyo.
        return { https, send: (event, read, ...endpoint) => sendRecordEvent(event, read, ...(endpoint.length ? endpoint : ["order-events"])) };
    };
    const snapshot = () => ({ sourceModifiedAt: "2026-11-02T20:00:00.000Z", status: 200, data: { id: "214" } });
    const statusOf = (result) => result.status;

    it("retries a transient transport failure once with exactly the same UUID and body", () => {
        let attempts = 0;
        const f = setup({
            post: () => {
                if (attempts++ === 0) throw new Error("NETWORK");
                return { code: 200, body: receipt() };
            },
        });
        expect(f.send(EVENT, snapshot).delivered).toBe(true);
        expect(f.https.post).toHaveBeenCalledTimes(2);
        expect(f.https.post.mock.calls[0][0].body).toBe(f.https.post.mock.calls[1][0].body);
    });
    it("blocks outside the sandbox before reading the snapshot or touching the network", () => {
        const { send, https } = setup({ runtime: runtimeMock({ accountId: "X" }) });
        const read = vi.fn();
        expect(send(EVENT, read)).toEqual({ status: "environment_blocked", delivered: false, failureStage: "configuration", failureReason: "environment_blocked" });
        expect(read).not.toHaveBeenCalled();
        expect(https.post).not.toHaveBeenCalled();
        expect(https.createSecureString).not.toHaveBeenCalled();
    });
    it.each(["http://abc.example.test/integrations/netsuite/local", "https://user@abc.example.test/integrations/netsuite/local", "https://abc.example.test/../local", "https://abc.example.test/local#fragment", "https://abc.example.test/local?x=1", ""])("blocks the destination %s", (parameter) => {
        const { send, https } = setup({ runtime: runtimeMock({ parameter }) });
        const read = vi.fn();
        expect(send(EVENT, read)).toEqual({ status: "destination_blocked", delivered: false, failureStage: "configuration", failureReason: "destination_blocked" });
        expect(read).not.toHaveBeenCalled();
        expect(https.post).not.toHaveBeenCalled();
    });
    it.each([
        [null, "https://api-habita.rdghub.com/integrations/netsuite/production/order-events"],
        ["  ", "https://api-habita.rdghub.com/integrations/netsuite/production/order-events"],
        [GOOD_URL, GOOD_URL + "/order-events"],
        ["http://example.test", null],
    ])("resolves the production URL for parameter %j", (parameter, expectedUrl) => {
        const { send, https } = setup({ runtime: runtimeMock({ envType: "PRODUCTION", accountId: "4552704", parameter }) });
        const result = send(EVENT, snapshot);
        if (expectedUrl === null) {
            expect(result.status).toBe("destination_blocked");
            expect(https.post).not.toHaveBeenCalled();
        } else {
            expect(https.post).toHaveBeenCalledOnce();
            expect(https.post.mock.calls[0][0].url).toBe(expectedUrl);
        }
    });
    it("uses the fixed production credential only for the official receiver when the parameter is blank", () => {
        const production = { envType: "PRODUCTION", accountId: "4552704", secretId: "" };
        const fallback = setup({ runtime: runtimeMock({ ...production, parameter: null }) });
        fallback.send(EVENT, snapshot);
        // Comparar solo el formato evita imprimir el secreto en un diff de asercion.
        expect(/^Bearer [a-f0-9]{64}$/.test(fallback.https.createSecureString.mock.calls[0]?.[0]?.input ?? "")).toBe(true);
        expect(fallback.https.post).toHaveBeenCalledOnce();
        const other = setup({ runtime: runtimeMock({ ...production, parameter: GOOD_URL }) });
        expect(other.send(EVENT, snapshot).status).toBe("configuration_missing");
        expect(other.https.post).not.toHaveBeenCalled();
    });
    it("delivers once with a secure-string reference, closed payload and the configured URL", () => {
        const first = setup();
        expect(first.send(EVENT, snapshot)).toEqual({ status: "received_local", delivered: true });
        const [{ url, headers, body }] = first.https.post.mock.calls[0];
        expect(url).toBe("https://habita.example.test/integrations/netsuite/local/order-events");
        // El secret se referencia por ID del deployment; nunca se envía en el cuerpo.
        expect(typeof headers.Authorization).toBe("string");
        expect(headers.Authorization).toBe("SECURE(Bearer {custsecret_habita_qa})");
        expect(first.https.createSecureString).toHaveBeenCalledOnce();
        const [credential] = first.https.createSecureString.mock.calls[0];
        expect(credential.input).toBe("Bearer {custsecret_habita_qa}");
        expect(first.https.post).toHaveBeenCalledOnce();
        expect(JSON.parse(body)).toMatchObject({
            schemaVersion: 2,
            source: { system: "netsuite", accountId: "4552704_SB1", environment: "sandbox" },
            event: EVENT,
            snapshot: { status: 200 },
        });
        expect(JSON.parse(body).event.observedAt).toMatch(/Z$/);
        expect(body).not.toContain("custsecret");
        const second = setup({ runtime: runtimeMock({ parameter: GOOD_URL }) });
        second.send(EVENT, snapshot);
        expect(second.https.post.mock.calls[0][0].url).toBe(GOOD_URL + "/order-events");
    });
    it("builds the URL from the module's own endpoint, so new record types need no library change", () => {
        for (const [endpoint, parameter] of [
            ["lead-events", undefined],
            ["estimate-events", undefined],
            ["lead-events", GOOD_URL + "/"],
            ["order-events", "https://abc-def.example.test"],
        ]) {
            const { send, https } = setup({ runtime: runtimeMock({ parameter }) });
            expect(send({ ...EVENT, recordType: "lead" }, snapshot, endpoint).delivered).toBe(true);
            const { url } = https.post.mock.calls[0][0];
            expect(url.startsWith("https://")).toBe(true);
            expect(url).toBe((parameter ?? "https://habita.example.test/integrations/netsuite/local").replace(/\/$/, "") + "/" + endpoint);
        }
    });
    it.each([undefined, null, 5, "", "orders", "order-events/../x", "order-events?x=1", "Order-events", "../order-events", "order_events", "http://evil.com", {}])("blocks the invalid module endpoint %j without reading or posting", (endpoint) => {
        const { send, https } = setup();
        const read = vi.fn();
        expect(send(EVENT, read, endpoint)).toEqual({ status: "destination_blocked", delivered: false, failureStage: "configuration", failureReason: "destination_blocked" });
        expect(read).not.toHaveBeenCalled();
        expect(https.post).not.toHaveBeenCalled();
    });
    it("accepts the receiver code as a string", () => {
        expect(setup({ post: () => ({ code: "200", body: receipt() }) }).send(EVENT, snapshot).delivered).toBe(true);
    });
    it("stops on a failed snapshot without posting", () => {
        const { send, https } = setup();
        expect(statusOf(send(EVENT, () => ({ status: 404 })))).toBe("snapshot_failed");
        expect(https.post).not.toHaveBeenCalled();
    });
    it("measures the payload in bytes, not characters", () => {
        const { send, https } = setup();
        // 30 textos de 10000 caracteres: 300000 caracteres = 600000 bytes con "é" y 300000 bytes con "e".
        const lines = (character) => ({ status: 200, data: Array.from({ length: 30 }, () => character.repeat(10000)) });
        expect(statusOf(send(EVENT, () => lines("é")))).toBe("payload_too_large");
        expect(statusOf(send(EVENT, () => lines("e")))).toBe("received_local");
        expect(https.post).toHaveBeenCalledOnce();
    });
    it("blocks, without posting or truncating, any text above the receiver's per-value limit", () => {
        const { send, https } = setup();
        const result = (data) => send(EVENT, () => ({ status: 200, data }));
        expect(result("a".repeat(16001))).toEqual({ status: "value_too_long", delivered: false, failureStage: "payload_build", failureReason: "value_too_long" });
        expect(result({ fields: { memo: "a".repeat(16001) } }).status).toBe("value_too_long");
        expect(result({ lines: [{ description: "a".repeat(16001) }] }).status).toBe("value_too_long");
        expect(https.post).not.toHaveBeenCalled();
        expect(result("a".repeat(16000)).status).toBe("received_local");
        expect(result({ n: 1, ok: true, nothing: null, text: "a".repeat(16000) }).status).toBe("received_local");
    });
    it.each([400, 401, 500, 302, undefined, "abc"])("rejects the HTTP code %s", (code) => {
        expect(statusOf(setup({ post: () => ({ code, body: receipt() }) }).send(EVENT, snapshot))).toBe("receiver_rejected");
    });
    it.each([
        ["null body", "null"],
        ["number", "5"],
        ["array", "[]"],
        ["wrong schema", receipt({ schemaVersion: 1 })],
        ["not received", receipt({ received: false })],
        ["not persisted", receipt({ persisted: false })],
        ["queue without absent result", receipt({ persisted: false, importQueued: true })],
        ["absent without durable queue", receipt({ persisted: false, result: "not_found", importQueued: false })],
        ["other id", receipt({ netsuiteId: "999" })],
        ["id as number", receipt({ netsuiteId: 214 })],
    ])("never treats %s as delivered", (_name, body) => {
        const reasons = { "null body": "receipt_missing", number: "receipt_schema_mismatch", array: "receipt_schema_mismatch", "wrong schema": "receipt_schema_mismatch", "not received": "receipt_not_received", "not persisted": "receipt_persistence_unconfirmed", "queue without absent result": "receipt_persistence_unconfirmed", "absent without durable queue": "receipt_persistence_unconfirmed", "other id": "receipt_order_id_mismatch", "id as number": "receipt_order_id_mismatch" };
        expect(setup({ post: () => ({ code: 200, body }) }).send(EVENT, snapshot)).toEqual({ status: "receipt_invalid", delivered: false, failureStage: "receipt_validation", failureReason: reasons[_name], httpStatus: 200 });
    });
    it("acknowledges a durable import request without claiming that the order was persisted", () => {
        const body = receipt({ persisted: false, result: "not_found", importQueued: true });
        expect(setup({ post: () => ({ code: 200, body }) }).send(EVENT, snapshot)).toEqual({ status: "import_queued", delivered: true });
    });
    it.each([
        ["HTML body", () => ({ code: 200, body: "<html>ngrok</html>" })],
        ["network error", throwing(new Error("SECRET"))],
    ])("fails closed on %s without throwing", (name, post) => {
        const result = setup({ post }).send(EVENT, snapshot);
        expect(result).toEqual({ status: "delivery_failed", delivered: false, failureStage: name === "network error" ? "http_request" : "receipt_validation", errorCode: name === "network error" ? "UNCLASSIFIED" : "INVALID_JSON_RESPONSE", ...(name === "network error" ? { transportCode: "UNCLASSIFIED", failureReason: "transport_error" } : { failureReason: "exception_in_receipt_validation" }) });
        expect(JSON.stringify(result)).not.toContain("SECRET");
    });
    it("fails closed when the snapshot reader throws, without sending a request", () => {
        const { send, https } = setup();
        expect(send(EVENT, throwing(nsError("RCRD_DSNT_EXIST")))).toEqual({ status: "delivery_failed", delivered: false, failureStage: "snapshot_read", errorCode: "RCRD_DSNT_EXIST", failureReason: "exception_in_snapshot_read" });
        expect(https.post).not.toHaveBeenCalled();
    });
});
