import { createHmac } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { afterEach, expect, it, vi } from "vitest";

import { netsuiteGetAuthorization, NetsuiteRestletClient } from "../../src/integrations/netsuite/netsuite-restlet.client.js";

const config = () => new ConfigService({ NETSUITE_PRODUCTION_RESTLET_URL: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1", NETSUITE_CONSUMER_KEY: "consumer", NETSUITE_CONSUMER_SECRET: "consumer-secret", NETSUITE_TOKEN_ID: "token", NETSUITE_TOKEN_SECRET: "token-secret", NETSUITE_REALM: "4552704", OAUTH_NETSUITE_SIGNATURE: "HMAC-SHA256" });
afterEach(() => vi.unstubAllGlobals());
it("reports a confirmed missing NetSuite order as 404 without exposing provider details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 404, error: { code: "SALES_ORDER_NOT_FOUND", message: "private provider detail" } }))));
    const failure: unknown = await new NetsuiteRestletClient(config()).readSalesOrder("123").catch((error: unknown) => error);
    const exception = failure as { getStatus(): number; getResponse(): unknown };
    expect(exception.getStatus()).toBe(404);
    expect(exception.getResponse()).toMatchObject({ code: "NETSUITE_SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe en NetSuite en el entorno configurado." });
    expect(JSON.stringify(exception.getResponse())).not.toContain("private provider detail");
});
it.each([
    { status: 404, error: { code: "OTHER_ERROR" } },
    { status: "404", error: { code: "SALES_ORDER_NOT_FOUND" } },
])("does not infer record absence from an unconfirmed provider error %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    const failure: unknown = await new NetsuiteRestletClient(config()).readSalesOrder("123").catch((error: unknown) => error);
    expect((failure as { getStatus(): number }).getStatus()).toBe(502);
});
it("uses only GET, signs the explicitly configured extraction RESTlet and returns its JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123", fields: { tranid: "RDR673" } })));
    vi.stubGlobal("fetch", fetcher);
    expect(await new NetsuiteRestletClient(config()).readSalesOrder("123")).toEqual({ id: "123", fields: { tranid: "RDR673" } });
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.origin).toBe("https://4552704.restlets.api.netsuite.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({ script: "1764", deploy: "1", rType: "salesordersExtraer", id: "123" });
    expect(options.method).toBe("GET");
    expect(new Headers(options.headers).get("Content-Type")).toBe("application/json");
    expect(options.redirect).toBe("error");
    const authorization = new Headers(options.headers).get("Authorization");
    expect(authorization).toContain('oauth_signature_method="HMAC-SHA256"');
    expect(authorization).not.toMatch(/consumer-secret|token-secret/);
});
it.each(["0", "../1", "1&script=999", "not-an-id"])("rejects invalid provider id %s before network", async (id) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(config()).readSalesOrder(id)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});
it("sanitizes upstream errors and never returns credentials or provider failure content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("token-secret upstream details", { status: 401 })));
    await expect(new NetsuiteRestletClient(config()).readSalesOrder("123")).rejects.toThrow("No fue posible consultar NetSuite");
});
it("does not send an unsigned request when credentials are absent", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService()).readSalesOrder("123")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});

it("matches an independently computed RFC5849 HMAC-SHA256 vector", () => {
    const url = new URL("https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1&rType=salesordersExtraer&id=123");
    const header = netsuiteGetAuthorization(url, { consumerKey: "consumer", consumerSecret: "consumer-secret", token: "token", tokenSecret: "token-secret", realm: "4552704" }, "fixed-nonce", "1700000000");
    expect(header).toContain('oauth_signature="hxdaQsk7ELUdrgFa7gxgWxdFXajIcbCyrYqkgVBtITk%3D"');
});
it("rejects oversized and malformed responses without passing provider content through errors", async () => {
    for (const response of [new Response("{}", { headers: { "content-length": "99999999" } }), new Response("invalid-json"), new Response(JSON.stringify({ error: { message: "private failure" } }))]) {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
        await expect(new NetsuiteRestletClient(config()).readSalesOrder("123")).rejects.toThrow("No fue posible consultar NetSuite");
    }
});

const sandbox = {
    NETSUITE_ENVIRONMENT: "sandbox",
    NETSUITE_SANDBOX_CONSUMER_KEY: "sandbox-consumer",
    NETSUITE_SANDBOX_CONSUMER_SECRET: "sandbox-consumer-secret",
    NETSUITE_SANDBOX_TOKEN_ID: "sandbox-token",
    NETSUITE_SANDBOX_TOKEN_SECRET: "sandbox-token-secret",
    NETSUITE_SANDBOX_REALM: "4552704_SB1",
    NETSUITE_SANDBOX_RESTLET_URL: "https://4552704-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_read_order&deploy=customdeploy_read_order",
};
const approval = { type: "salesorder", id: "123", approval: "formalization", approved: true, alreadyApproved: false };
it("preserves confirmed absence during approval as a safe 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 404, error: { code: "SALES_ORDER_NOT_FOUND", message: "private" } }))));
    const failure: unknown = await new NetsuiteRestletClient(new ConfigService(sandbox)).approveFormalization("123").catch((error: unknown) => error);
    const exception = failure as { getStatus(): number; getResponse(): unknown };
    expect(exception.getStatus()).toBe(404);
    expect(exception.getResponse()).toMatchObject({ code: "NETSUITE_SALES_ORDER_NOT_FOUND" });
});
it.each(["APPROVAL_PREREQUISITES_REQUIRED", "SALES_ORDER_CANCELLED"])("preserves a known pre-write rejection without leaking provider details: %s", async (code) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 409, error: { code, message: "token-secret upstream details" } })));
    vi.stubGlobal("fetch", fetcher);
    const failure = await new NetsuiteRestletClient(new ConfigService(sandbox)).approveFormalization("123").catch((error: unknown) => error);
    const exception = failure as { getStatus(): number; getResponse(): unknown };
    expect(exception.getStatus()).toBe(409);
    expect(exception.getResponse()).toMatchObject({ statusCode: 409, code });
    expect(JSON.stringify(exception.getResponse())).not.toContain("token-secret");
    expect(fetcher).toHaveBeenCalledOnce();
});
it.each([false, true])("sends approval JSON only to configured sandbox and confirms alreadyApproved=%s", async (alreadyApproved) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 200, data: { ...approval, alreadyApproved } })));
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService(sandbox)).approveFormalization("123")).resolves.toEqual({ id: "123", approved: true, alreadyApproved, environment: "sandbox" });
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe(sandbox.NETSUITE_SANDBOX_RESTLET_URL);
    expect(options.method).toBe("PUT");
    expect(options.redirect).toBe("error");
    expect(JSON.parse(options.body as string)).toEqual({ module: "salesOrders", action: "approveFormalization", id: "123" });
    expect(new Headers(options.headers).get("Authorization")).toContain('realm="4552704_SB1"');
    const header = new Headers(options.headers).get("Authorization") ?? "";
    const oauth: Record<string, string> = Object.fromEntries([...header.matchAll(/(\w+)="([^"]*)"/g)].map((entry): [string, string] => [entry[1] ?? "", decodeURIComponent(entry[2] ?? "")]));
    const signature = oauth.oauth_signature;
    delete oauth.realm;
    delete oauth.oauth_signature;
    const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
    const parameters = [...url.searchParams.entries(), ...Object.entries(oauth)]
        .map(([key, value]) => `${encode(key)}=${encode(value)}`)
        .sort()
        .join("&");
    const base = ["PUT", url.origin + url.pathname, parameters].map(encode).join("&");
    expect(signature).toBe(createHmac("sha256", "sandbox-consumer-secret&sandbox-token-secret").update(base).digest("base64"));
});
it.each([undefined, "production", "other"])("blocks approval outside sandbox: %s", async (environment) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService({ ...sandbox, NETSUITE_ENVIRONMENT: environment })).approveFormalization("123")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});
it.each(["0", "-1", "1e3", "001", "9007199254740992", "123 "])("rejects unsafe approval ID %s", async (id) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService(sandbox)).approveFormalization(id)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});
it.each([{ id: "124" }, { id: 123 }, { type: "estimate" }, { approval: "developer" }, { approved: "true" }, { approved: false }, { alreadyApproved: "false" }])("rejects mismatched approval confirmation %j", async (override) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 200, data: { ...approval, ...override } }))));
    await expect(new NetsuiteRestletClient(new ConfigService(sandbox)).approveFormalization("123")).rejects.toThrow(/desconocido/i);
});
it("reports unknown outcome without retry or a no-modification claim after PUT timeout", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Timeout secret"));
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService(sandbox)).approveFormalization("123")).rejects.toThrow(/resultado.*desconocido/i);
    expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([{ status: 409, data: approval }, { status: "200", data: approval }, { status: 200 }, { status: 200, data: approval, error: { message: "private" } }])("does not accept incomplete or failed application acknowledgements: %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(new NetsuiteRestletClient(new ConfigService(sandbox)).approveFormalization("123")).rejects.toThrow(/desconocido/i);
});
it.each(Object.keys(sandbox).filter((key) => key !== "NETSUITE_ENVIRONMENT"))("fails closed before PUT with missing sandbox setting %s", async (key) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService({ ...sandbox, [key]: undefined })).approveFormalization("123")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});
it.each([302, 500])("reports unknown PUT outcome on upstream HTTP %s without following or retrying", async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response("private", { status }));
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService(sandbox)).approveFormalization("123")).rejects.toThrow(/desconocido/i);
    expect(fetcher).toHaveBeenCalledTimes(1);
});
it("selects sandbox credentials and the explicitly configured deployment only", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    await new NetsuiteRestletClient(new ConfigService({ NETSUITE_PRODUCTION_RESTLET_URL: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1", NETSUITE_CONSUMER_KEY: "production-consumer", NETSUITE_CONSUMER_SECRET: "production-secret", NETSUITE_TOKEN_ID: "production-token", NETSUITE_TOKEN_SECRET: "production-token-secret", NETSUITE_REALM: "4552704", ...sandbox })).readSalesOrder("123");
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.origin).toBe("https://4552704-sb1.restlets.api.netsuite.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({ script: "customscript_read_order", deploy: "customdeploy_read_order", module: "salesOrders", id: "123" });
    expect(new Headers(options.headers).get("Authorization")).toContain('realm="4552704_SB1"');
    expect(new Headers(options.headers).get("Authorization")).toContain('oauth_consumer_key="sandbox-consumer"');
    expect(options.redirect).toBe("error");
});
it.each(Object.keys(sandbox).filter((key) => key !== "NETSUITE_ENVIRONMENT"))("never falls back to production when sandbox is missing %s", async (key) => {
    const values: Record<string, string | undefined> = { ...sandbox, NETSUITE_CONSUMER_KEY: "production-consumer", NETSUITE_CONSUMER_SECRET: "production-secret", NETSUITE_TOKEN_ID: "production-token", NETSUITE_TOKEN_SECRET: "production-token-secret", NETSUITE_REALM: "4552704", [key]: undefined };
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService(values)).readSalesOrder("123")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});
it.each([
    { NETSUITE_ENVIRONMENT: "invalid" },
    { NETSUITE_SANDBOX_REALM: "4552704" },
    ...[
        "http://4552704-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=2&deploy=1",
        "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=2&deploy=1",
        sandbox.NETSUITE_SANDBOX_RESTLET_URL + "&script=3",
        sandbox.NETSUITE_SANDBOX_RESTLET_URL + "&id=123",
        sandbox.NETSUITE_SANDBOX_RESTLET_URL + "#secret",
        sandbox.NETSUITE_SANDBOX_RESTLET_URL.replace("https://", "https://user:secret@"),
        sandbox.NETSUITE_SANDBOX_RESTLET_URL.replace(".com/", ".com:443/"),
        sandbox.NETSUITE_SANDBOX_RESTLET_URL.replace("restlet.nl", "other.nl"),
        sandbox.NETSUITE_SANDBOX_RESTLET_URL.replace("customscript_read_order", "bad%2Fscript"),
        "not-a-url",
    ].map((NETSUITE_SANDBOX_RESTLET_URL) => ({ NETSUITE_SANDBOX_RESTLET_URL })),
])("rejects incompatible configuration before fetch: %j", async (override) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService({ ...sandbox, ...override })).readSalesOrder("123")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});
it("keeps production default despite populated sandbox settings", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    const settings = { ...sandbox, NETSUITE_PRODUCTION_RESTLET_URL: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1", NETSUITE_ENVIRONMENT: undefined, NETSUITE_CONSUMER_KEY: "consumer", NETSUITE_CONSUMER_SECRET: "consumer-secret", NETSUITE_TOKEN_ID: "token", NETSUITE_TOKEN_SECRET: "token-secret", NETSUITE_REALM: "4552704" };
    await new NetsuiteRestletClient(new ConfigService(settings)).readSalesOrder("123");
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.origin).toBe("https://4552704.restlets.api.netsuite.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({ script: "1764", deploy: "1", rType: "salesordersExtraer", id: "123" });
    expect(new Headers(options.headers).get("Authorization")).toContain('realm="4552704"');
});
it("sanitizes sandbox upstream failure without retrying production", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("sandbox-token-secret private error", { status: 302, headers: { Location: "https://4552704.restlets.api.netsuite.com" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService(sandbox)).readSalesOrder("123")).rejects.toThrow("No fue posible consultar NetSuite. La orden no fue modificada.");
    expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(["http://localhost:5173", "http://localhost.:5173", "https://app.localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.2:5173", "http://[::1]:5173"])("forces sandbox for configured local frontend %s despite production setting", async (origin) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123" })));
    vi.stubGlobal("fetch", fetcher);
    await new NetsuiteRestletClient(new ConfigService({ ...sandbox, FRONTEND_ORIGIN: origin, NETSUITE_ENVIRONMENT: "production" })).readSalesOrder("123");
    const [url] = fetcher.mock.calls[0] as [URL];
    expect(url.hostname).toBe("4552704-sb1.restlets.api.netsuite.com");
    expect(url.searchParams.get("module")).toBe("salesOrders");
});
it("forces production for Habita even if an old sandbox setting remains", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123" })));
    vi.stubGlobal("fetch", fetcher);
    await new NetsuiteRestletClient(new ConfigService({ ...sandbox, FRONTEND_ORIGIN: "https://habita.roccacr.com", NETSUITE_CONSUMER_KEY: "production", NETSUITE_CONSUMER_SECRET: "production-secret", NETSUITE_TOKEN_ID: "production-token", NETSUITE_TOKEN_SECRET: "production-token-secret", NETSUITE_REALM: "4552704", NETSUITE_PRODUCTION_RESTLET_URL: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_production&deploy=customdeploy_prod" })).readSalesOrder(
        "123",
    );
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.hostname).toBe("4552704.restlets.api.netsuite.com");
    expect(url.searchParams.get("script")).toBe("customscript_production");
    expect(new Headers(options.headers).get("Authorization")).toContain('realm="4552704"');
    expect(new Headers(options.headers).get("Authorization")).not.toContain("sandbox-consumer");
});
it.each([undefined, "", "https://4552704-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1&deploy=1", "https://evil.test/app/site/hosting/restlet.nl?script=1&deploy=1"])("never uses a fallback production URL when its deployment is %s", async (url) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const settings = config();
    settings.set("FRONTEND_ORIGIN", "https://habita.roccacr.com");
    settings.set("NETSUITE_PRODUCTION_RESTLET_URL", url);
    await expect(new NetsuiteRestletClient(settings).readSalesOrder("123")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});

it("supports the production modular read contract without changing the endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123" })));
    vi.stubGlobal("fetch", fetcher);
    const settings = config();
    settings.set("FRONTEND_ORIGIN", "https://habita.roccacr.com");
    settings.set("NETSUITE_PRODUCTION_READ_MODE", "modules");
    await new NetsuiteRestletClient(settings).readSalesOrder("123");
    const [url] = fetcher.mock.calls[0] as [URL];
    expect(url.searchParams.get("module")).toBe("salesOrders");
    expect(url.searchParams.has("rType")).toBe(false);
});
it.each(["NETSUITE_SANDBOX_RESTLET_URL", "NETSUITE_SANDBOX_TOKEN_ID"])("local never uses available production settings when missing %s", async (key) => {
    const settings = config();
    for (const [name, value] of Object.entries(sandbox)) settings.set(name, value);
    settings.set("FRONTEND_ORIGIN", "http://localhost:5173");
    settings.set(key, "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(settings).readSalesOrder("123")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});
it("Habita never substitutes complete sandbox credentials for missing production keys", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(new NetsuiteRestletClient(new ConfigService({ ...sandbox, FRONTEND_ORIGIN: "https://habita.roccacr.com", NETSUITE_PRODUCTION_RESTLET_URL: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1&deploy=1" })).readSalesOrder("123")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
});

it.each(["https://habita.roccacr.com", "http://localhost:5173"])("keeps the confirmed production3739 deployment separate from sandbox for %s", async (origin) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "123" })));
    vi.stubGlobal("fetch", fetcher);
    const settings = config();
    for (const [name, value] of Object.entries(sandbox)) settings.set(name, value);
    settings.set("FRONTEND_ORIGIN", origin);
    settings.set("NETSUITE_PRODUCTION_RESTLET_URL", "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=3739&deploy=1");
    settings.set("NETSUITE_PRODUCTION_READ_MODE", "modules");
    await new NetsuiteRestletClient(settings).readSalesOrder("123");
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("module")).toBe("salesOrders");
    expect(url.searchParams.has("rType")).toBe(false);
    const production = origin === "https://habita.roccacr.com";
    expect(url.hostname).toBe(production ? "4552704.restlets.api.netsuite.com" : "4552704-sb1.restlets.api.netsuite.com");
    expect(url.searchParams.get("script")).toBe(production ? "3739" : "customscript_read_order");
    expect(new Headers(options.headers).get("Authorization")).toContain(production ? 'realm="4552704"' : 'realm="4552704_SB1"');
});
