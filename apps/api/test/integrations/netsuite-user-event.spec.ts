import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { expect, it, vi } from "vitest";

const entry = new URL("../../src/integrations/netsuite/suitescript/SS2_1_UE_CRM_CambiosRegistros.js", import.meta.url);
const root = new URL("./", entry);

function fixture(accountId = "4552704_SB1", envType = "SANDBOX", options: { url?: string; response?: { code: number; body: string }; error?: boolean } = {}) {
    const logger = { debug: vi.fn(), error: vi.fn() };
    const post = vi.fn((_request: unknown) => {
        if (options.error) throw new Error("PRIVATE NETWORK ERROR");
        return options.response ?? { code: 200, body: JSON.stringify({ schemaVersion: 1, received: true, persisted: false, netsuiteId: "123" }) };
    });
    const loadRecord = vi.fn(() => ({ getValue: ({ fieldId }: { fieldId: string }) => (fieldId === "tranid" ? "OV-123" : null), getText: () => null, getLineCount: () => 0 }));
    const providers: Record<string, unknown> = { "N/runtime": { accountId, envType, EnvType: { SANDBOX: "SANDBOX" }, getCurrentScript: () => ({ getParameter: () => options.url ?? "https://nontransgressively-sequential-leif.ngrok-free.dev/integrations/netsuite/local/order-events" }) }, "N/log": logger, "N/record": { load: loadRecord }, "N/search": {}, "N/https": { post, createSecureString: vi.fn(() => ({ secret: "opaque" })) } };
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
                        const cabinet = "/SuiteScripts/CRM TINK/";
                        return load(dependency.startsWith(cabinet) ? new URL(dependency.slice(cabinet.length) + ".js", root) : new URL(dependency + ".js", url));
                    }),
                );
            },
        });
        cache.set(url.href, result);
        return result;
    }
    return { logger, post, loadRecord, handlers: load(entry) as { afterSubmit: (context: unknown) => void } };
}

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
    ["4552704", "PRODUCTION"],
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
    expect(f.loadRecord).toHaveBeenCalledExactlyOnceWith({ type: "salesorder", id: "123", isDynamic: false });
    const sent = f.post.mock.calls[0]?.[0] as { body: string; headers: Record<string, unknown> };
    expect(JSON.parse(sent.body)).toMatchObject({ schemaVersion: 1, source: { environment: "sandbox", accountId: "4552704_SB1" }, event: { netsuiteId: "123", eventType: "xedit" }, snapshot: { data: { fields: { initialtranid: "OV-123" } } } });
    expect(sent.headers.Authorization).toEqual({ secret: "opaque" });
    expect(sent.body).not.toContain("DO NOT SEND");
});
it.each(["http://localhost:3000/integrations/netsuite/local/order-events", "https://example.com/integrations/netsuite/local/order-events", "https://test.ngrok-free.dev/other"])("does not read or transmit to an unapproved destination: %s", (url) => {
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
