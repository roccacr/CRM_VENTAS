import { ConfigService } from "@nestjs/config";
import { afterEach, expect, it, vi } from "vitest";

import { netsuiteGetAuthorization, NetsuiteRestletClient } from "../../src/integrations/netsuite/netsuite-restlet.client.js";

const config = () => new ConfigService({ NETSUITE_CONSUMER_KEY: "consumer", NETSUITE_CONSUMER_SECRET: "consumer-secret", NETSUITE_TOKEN_ID: "token", NETSUITE_TOKEN_SECRET: "token-secret", NETSUITE_REALM: "4552704", OAUTH_NETSUITE_SIGNATURE: "HMAC-SHA256" });
afterEach(() => vi.unstubAllGlobals());
it("uses only GET, signs the fixed extraction RESTlet and returns its JSON", async () => {
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
