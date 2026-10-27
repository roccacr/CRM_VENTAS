import { createHmac, randomBytes } from "node:crypto";

import { BadGatewayException, BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const RESTLET = "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl";
const MAX_BYTES = 5 * 1024 * 1024;
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
interface Credentials {
    consumerKey: string;
    consumerSecret: string;
    token: string;
    tokenSecret: string;
    realm: string;
}
/** RFC 5849 normalization; realm is a header attribute, never a signed parameter. */
export function netsuiteGetAuthorization(url: URL, credentials: Credentials, nonce: string, timestamp: string): string {
    const oauth = { oauth_consumer_key: credentials.consumerKey, oauth_token: credentials.token, oauth_signature_method: "HMAC-SHA256", oauth_timestamp: timestamp, oauth_nonce: nonce, oauth_version: "1.0" };
    const entries = [...url.searchParams.entries(), ...Object.entries(oauth)].map(([key, value]) => encode(key) + "=" + encode(value)).sort();
    const base = ["GET", url.origin + url.pathname, entries.join("&")].map(encode).join("&");
    const signature = createHmac("sha256", encode(credentials.consumerSecret) + "&" + encode(credentials.tokenSecret))
        .update(base)
        .digest("base64");
    return (
        "OAuth " +
        Object.entries({ realm: credentials.realm, ...oauth, oauth_signature: signature })
            .map(([key, value]) => key + '="' + encode(value) + '"')
            .join(", ")
    );
}
/** GET-only adapter. No provider URL, script, method or credentials are accepted from the browser. */
@Injectable()
export class NetsuiteRestletClient {
    /**
     *
     */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
    /**
     *
     */
    async readSalesOrder(id: string): Promise<unknown> {
        if (!/^[1-9][0-9]{0,19}$/.test(id)) throw new BadRequestException("Identificador NetSuite invalido.");
        const credentials = this.credentials();
        const url = new URL(RESTLET);
        for (const [key, value] of Object.entries({ script: "1764", deploy: "1", rType: "salesordersExtraer", id })) url.searchParams.set(key, value);
        const authorization = netsuiteGetAuthorization(url, credentials, randomBytes(16).toString("hex"), String(Math.floor(Date.now() / 1000)));
        try {
            const response = await fetch(url, { method: "GET", redirect: "error", headers: { Authorization: authorization, Accept: "application/json", "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000) });
            if (!response.ok) {
                await response.body?.cancel();
                throw new Error("upstream");
            }
            return parseRestletBody(await this.readBody(response));
        } catch {
            throw new BadGatewayException("No fue posible consultar NetSuite. La orden no fue modificada.");
        }
    }
    private credentials(): Credentials {
        const read = (key: string) => {
            const value = this.config.get<unknown>(key);
            if (typeof value !== "string" || !value.trim()) throw new ServiceUnavailableException("Conexion NetSuite no configurada.");
            return value.trim();
        };
        const result = { consumerKey: read("NETSUITE_CONSUMER_KEY"), consumerSecret: read("NETSUITE_CONSUMER_SECRET"), token: read("NETSUITE_TOKEN_ID"), tokenSecret: read("NETSUITE_TOKEN_SECRET"), realm: read("NETSUITE_REALM") };
        if (result.realm !== "4552704" || this.config.get<string>("OAUTH_NETSUITE_SIGNATURE", "HMAC-SHA256") !== "HMAC-SHA256") throw new ServiceUnavailableException("Configuracion NetSuite incompatible con el RESTlet de lectura.");
        return result;
    }
    private async readBody(response: Response): Promise<string> {
        if (Number(response.headers.get("content-length")) > MAX_BYTES || !response.body) throw new Error("upstream-size");
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > MAX_BYTES) {
                    await reader.cancel();
                    throw new Error("upstream-size");
                }
                chunks.push(value);
            }
        } finally {
            reader.releaseLock();
        }
        return Buffer.concat(chunks).toString("utf8");
    }
}

/** RESTlets may serialize their JSON once more; normalize without returning error payloads. */
function parseRestletBody(body: string): unknown {
    let data: unknown = JSON.parse(body);
    if (typeof data === "string") data = JSON.parse(data) as unknown;
    if (!data || typeof data !== "object" || "error" in data) throw new Error("upstream-payload");
    return data;
}
