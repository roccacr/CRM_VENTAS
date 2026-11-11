import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { expect, it, vi } from "vitest";
const EVENT_FIELDS: Record<string, boolean> = Object.fromEntries(["custbody90", "custbody51", "custbody91", "custbody105", "custbody43", "custbody103", "custbody_ix_comision_pagada", "custbody_entrega_de_llaves", "custbody274", "custbody_cuotas_pagadas"].map((field) => [field, false]));
const EVENT_PROVIDERS = { "N/crypto/random": { generateUUID: () => "11111111-1111-4111-8111-111111111111" }, "N/format": { Type: { DATETIME: "datetime" }, parse: ({ value }: { value: string }) => new Date(value) } };

const entry = new URL("../../src/integrations/netsuite/suitescript/SS2_1_UE_CRM_Habita.js", import.meta.url);
const root = new URL("./", entry);

function fixture(accountId = "4552704_SB1", envType = "SANDBOX", options: { url?: string; response?: { code: number; body: string }; error?: boolean; conflictOnce?: boolean } = {}) {
    const logger = { debug: vi.fn(), error: vi.fn() };
    const createSecureString = vi.fn(() => ({ secret: "opaque" }));
    let attempts = 0;
    let sequence = 0;
    const post = vi.fn((_request: unknown) => {
        if (options.conflictOnce && attempts++ === 0) return { code: 409, body: "conflict" };
        if (options.error) throw new Error("PRIVATE NETWORK ERROR");
        return options.response ?? { code: 200, body: JSON.stringify({ schemaVersion: 2, received: true, persisted: true, netsuiteId: "123", eventId: (JSON.parse((_request as { body: string }).body) as { event: { eventId: string } }).event.eventId }) };
    });
    const loadRecord = vi.fn(({ type }: { type: string }) => ({ getValue: ({ fieldId }: { fieldId: string }) => (type === "currency" ? "USD" : fieldId === "currency" ? 1 : fieldId === "tranid" ? "OV-123" : fieldId === "trandate" ? new Date(2026, 10, 2) : (EVENT_FIELDS[fieldId] ?? null)), getText: () => null, getSublists: () => ["item"], getLineCount: () => 0 }));
    const parameters: Record<string, string | undefined> = { custscript_crm_event_url: options.url ?? "https://habita.example.test/integrations/netsuite/local", custscript_crm_event_secret_id: "custsecret_habita_qa" };
    const providers: Record<string, unknown> = {
        ...EVENT_PROVIDERS,
        "N/crypto/random": { generateUUID: () => `${sequence++ === 0 ? "11111111" : "22222222"}-1111-4111-8111-111111111111` },
        "N/runtime": { accountId, envType, EnvType: { SANDBOX: "SANDBOX", PRODUCTION: "PRODUCTION" }, getCurrentScript: () => ({ getParameter: ({ name }: { name: string }) => parameters[name] }) },
        "N/log": logger,
        "N/workflow": { initiate: vi.fn() },
        "N/record": { load: loadRecord },
        "N/search": { lookupFields: () => ({ lastmodifieddate: "2026-11-02T20:00:00.000Z", ...EVENT_FIELDS }) },
        "N/https": { post, createSecureString },
    };
    const cache = new Map<string, unknown>();
    function load(url: URL): unknown {
        if (cache.has(url.href)) return cache.get(url.href);
        let result: unknown;
        runInNewContext(readFileSync(url, "utf8"), {
            define: (dependencies: string[], factory: (...args: unknown[]) => unknown) => {
                result = factory(
                    ...dependencies.map((dependency) => {
                        if (dependency.startsWith("N/")) {
                            if (!(dependency in providers)) throw new Error("Unexpected provider: " + dependency);
                            return providers[dependency];
                        }
                        const cabinet = "/SuiteScripts/";
                        return load(dependency.startsWith(cabinet) ? new URL(dependency.slice(cabinet.length) + ".js", root) : new URL(dependency + ".js", url));
                    }),
                );
            },
        });
        cache.set(url.href, result);
        return result;
    }
    return { logger, post, loadRecord, createSecureString, handlers: load(entry) as { afterSubmit: (context: unknown) => void } };
}

it("uses the fixed production credential only for the official receiver without logging it", () => {
    const f = fixture("4552704", "PRODUCTION", { url: "https://api-habita.rdghub.com/integrations/netsuite/production" });
    f.handlers.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 123 } });
    const calls = f.createSecureString.mock.calls as unknown as [{ input: string }][];
    const authorization = calls[0]?.[0].input ?? "";
    expect(/^Bearer [a-f0-9]{64}$/.test(authorization)).toBe(true);
    expect(JSON.stringify(f.logger.debug.mock.calls)).not.toContain(authorization.slice(7));
});

it("exports only afterSubmit and performs no provider calls at load time", () => {
    const f = fixture();
    expect(Object.keys(f.handlers)).toEqual(["afterSubmit"]);
    expect(f.logger.debug).not.toHaveBeenCalled();
});

it.each(["create", "edit", "xedit", "approve", "cancel", "reject"])("routes saved sales orders through their module: %s", (type) => {
    const f = fixture();
    f.handlers.afterSubmit({ type, newRecord: { type: "salesorder", id: 123 } });
    expect(f.logger.debug).toHaveBeenCalledOnce();
    expect(f.logger.debug.mock.calls[0]?.[0]).toMatchObject({ details: { module: "salesOrders", recordType: "salesorder", netsuiteId: "123", eventType: type, status: "received_local", delivered: true } });
});

it.each([
    ["OTHER", "PRODUCTION"],
    ["OTHER_SB1", "SANDBOX"],
])("ignores a different account or environment: %s", (account, environment) => {
    const f = fixture(account, environment);
    f.handlers.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 123 } });
    expect(f.logger.debug).not.toHaveBeenCalled();
    expect(f.logger.error).not.toHaveBeenCalled();
});

it.each([undefined, {}, { type: "delete", newRecord: { type: "salesorder", id: 123 } }, { type: "edit", newRecord: { type: "salesorder", id: "bad" } }, { type: "edit", newRecord: { type: "invoice", id: 123 } }])("ignores unsupported or malformed events", (context) => {
    const f = fixture();
    expect(() => {
        f.handlers.afterSubmit(context);
    }).not.toThrow();
    expect(f.logger.debug).not.toHaveBeenCalled();
});

it.each([
    ["lead", "leads"],
    ["estimate", "estimates"],
])("reports a reserved module without pretending synchronization: %s", (recordType, module) => {
    const f = fixture();
    f.handlers.afterSubmit({ type: "edit", newRecord: { type: recordType, id: 123 } });
    expect(f.logger.debug.mock.calls[0]?.[0]).toMatchObject({ details: { module, status: "module_pending", delivered: false } });
});

it("reuses full order read for xedit and sends the mapped snapshot with a secure header", () => {
    const f = fixture();
    f.handlers.afterSubmit({ type: "xedit", newRecord: { type: "salesorder", id: 123, _csrf: "DO NOT SEND" } });
    expect(f.loadRecord).toHaveBeenCalledTimes(2);
    expect(f.loadRecord).toHaveBeenCalledWith({ type: "salesorder", id: "123", isDynamic: false });
    const sent = f.post.mock.calls[0]?.[0] as { body: string; headers: Record<string, unknown> };
    expect(JSON.parse(sent.body)).toMatchObject({ schemaVersion: 2, source: { environment: "sandbox", accountId: "4552704_SB1" }, event: { netsuiteId: "123", eventType: "xedit" }, snapshot: { data: { fields: { initialtranid: "OV-123", crm_sync_projection: 1, crm_transaction_date: "2026-11-02", crm_owner_employee: null, entity: null, custbody38: null } } } });
    expect(sent.headers.Authorization).toEqual({ secret: "opaque" });
    expect(sent.body).not.toContain("DO NOT SEND");
});
it.each(["http://localhost:3000/integrations/netsuite/local/order-events", "https://example.com/integrations/netsuite/local?x=1", "https://user@example.com/integrations/netsuite/local"])("does not read or transmit to an unapproved destination: %s", (url) => {
    const f = fixture(undefined, undefined, { url });
    f.handlers.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 123 } });
    expect(f.post).not.toHaveBeenCalled();
    expect(f.loadRecord).not.toHaveBeenCalled();
});
it.each([
    { code: 200, body: "<html>ngrok warning</html>" },
    { code: 500, body: "private failure" },
    { code: 200, body: JSON.stringify({ received: true }) },
    { code: 200, body: JSON.stringify({ schemaVersion: 1, received: true, persisted: false, netsuiteId: "456" }) },
])("never calls an invalid acknowledgement a delivery", (response) => {
    const f = fixture(undefined, undefined, { response });
    f.handlers.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 123 } });
    expect(f.logger.error.mock.calls[0]?.[0]).toMatchObject({ details: { delivered: false } });
    expect(JSON.stringify(f.logger.error.mock.calls)).not.toContain("private failure");
});
it("reports network failures without throwing after the record was saved", () => {
    const f = fixture(undefined, undefined, { error: true });
    expect(() => {
        f.handlers.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 123 } });
    }).not.toThrow();
    expect(f.logger.error.mock.calls[0]?.[0]).toMatchObject({ details: { delivered: false, status: "delivery_failed" } });
});

it("rereads the full order with a new observation ID after a 409; network retries keep their original body", () => {
    const f = fixture(undefined, undefined, { conflictOnce: true });
    f.handlers.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: 123 } });
    expect(f.post.mock.calls.length).toBe(2);
    expect(f.loadRecord).toHaveBeenCalledTimes(4);
    const bodies = f.post.mock.calls.map(([request]) => JSON.parse((request as { body: string }).body) as { event: { eventId: string; snapshotReadStartedAt: string; snapshotReadCompletedAt: string } });
    expect(bodies[0]?.event.eventId).not.toBe(bodies[1]?.event.eventId);
    expect(bodies.every((body) => Boolean(body.event.snapshotReadStartedAt) && Boolean(body.event.snapshotReadCompletedAt))).toBe(true);
    expect(f.logger.debug.mock.calls[0]?.[0]).toMatchObject({ details: { delivered: true } });
});
