import { createHmac, randomBytes } from "node:crypto";

import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import { isNetsuiteSandboxRestletUrl } from "../../config/env.validation.js";

const RESTLET = "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl";
const MAX_BYTES = 5 * 1024 * 1024;
const approvalConfirmation = z.object({ status: z.literal(200), data: z.object({ type: z.literal("salesorder"), id: z.string(), approval: z.literal("formalization"), approved: z.literal(true), alreadyApproved: z.boolean() }) });
// Only known pre-write business rejections leave the adapter; provider messages remain private.
const approvalRejection = z.object({ status: z.literal(409), error: z.object({ code: z.enum(["APPROVAL_PREREQUISITES_REQUIRED", "SALES_ORDER_CANCELLED"]) }) });
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
    return netsuiteAuthorization("GET", url, credentials, { nonce, timestamp });
}
/** JSON request bodies are not OAuth form parameters; only URL and OAuth parameters are normalized. */
function netsuiteAuthorization(method: "GET" | "PUT", url: URL, credentials: Credentials, { nonce, timestamp }: { nonce: string; timestamp: string }): string {
    const oauth = { oauth_consumer_key: credentials.consumerKey, oauth_token: credentials.token, oauth_signature_method: "HMAC-SHA256", oauth_timestamp: timestamp, oauth_nonce: nonce, oauth_version: "1.0" };
    const entries = [...url.searchParams.entries(), ...Object.entries(oauth)].map(([key, value]) => encode(key) + "=" + encode(value)).sort();
    const base = [method, url.origin + url.pathname, entries.join("&")].map(encode).join("&");
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
/** Server-configured reads and sandbox-only formalization approval; no caller-controlled URLs or scripts. */
@Injectable()
export class NetsuiteRestletClient {
    /**
     *
     */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
    /** Confirm only the exact requested order and approval; lost responses leave the outcome unknown. */
    async approveFormalization(id: string): Promise<{ id: string; approved: true; alreadyApproved: boolean; environment: "sandbox" | "production" }> {
        if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new BadRequestException("Identificador NetSuite invalido.");
        if (this.config.get<unknown>("NETSUITE_ENVIRONMENT") !== "sandbox") throw new ServiceUnavailableException("Aprobacion NetSuite disponible solamente en sandbox.");
        const { credentials, url } = this.connection();
        const authorization = netsuiteAuthorization("PUT", url, credentials, { nonce: randomBytes(16).toString("hex"), timestamp: String(Math.floor(Date.now() / 1000)) });
        try {
            const response = await fetch(url, { method: "PUT", redirect: "error", headers: { Authorization: authorization, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ module: "salesOrders", action: "approveFormalization", id }), signal: AbortSignal.timeout(15000) });
            if (!response.ok) {
                await response.body?.cancel();
                throw new Error("upstream");
            }
            const data = confirmApprovalBody(await this.readBody(response), id);
            return { id, approved: true, alreadyApproved: data.alreadyApproved, environment: "sandbox" };
        } catch (error) {
            if ([ConflictException, NotFoundException].some((type) => error instanceof type)) throw error;
            throw new BadGatewayException("Resultado de aprobacion NetSuite desconocido. Consulta el estado antes de reintentar.");
        }
    }
    /**
     *
     */
    async readSalesOrder(id: string): Promise<unknown> {
        if (!/^[1-9][0-9]{0,19}$/.test(id)) throw new BadRequestException("Identificador NetSuite invalido.");
        const { credentials, url } = this.connection();
        const operation = this.config.get<string>("NETSUITE_ENVIRONMENT") === "sandbox" ? { module: "salesOrders", id } : { rType: "salesordersExtraer", id };
        for (const [key, value] of Object.entries(operation)) url.searchParams.set(key, value);
        const authorization = netsuiteGetAuthorization(url, credentials, randomBytes(16).toString("hex"), String(Math.floor(Date.now() / 1000)));
        try {
            const response = await fetch(url, { method: "GET", redirect: "error", headers: { Authorization: authorization, Accept: "application/json", "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000) });
            if (!response.ok) {
                await response.body?.cancel();
                throw new Error("upstream");
            }
            return readSalesOrderBody(await this.readBody(response));
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            throw new BadGatewayException("No fue posible consultar NetSuite. La orden no fue modificada.");
        }
    }
    /** Resolve and validate the selected server configuration before any request. */
    private connection(): { credentials: Credentials; url: URL } {
        const environment = this.config.get<unknown>("NETSUITE_ENVIRONMENT") ?? "production";
        if (environment !== "production" && environment !== "sandbox") throw new ServiceUnavailableException("Configuracion NetSuite incompatible.");
        const sandbox = environment === "sandbox";
        const credentials = this.credentials(sandbox);
        const deploymentUrl = sandbox ? this.config.get<unknown>("NETSUITE_SANDBOX_RESTLET_URL") : RESTLET + "?script=1764&deploy=1";
        if (sandbox && !isNetsuiteSandboxRestletUrl(deploymentUrl)) throw new ServiceUnavailableException("Configuracion NetSuite incompatible.");
        const url = new URL(deploymentUrl as string);
        return { credentials, url };
    }
    private credentials(sandbox: boolean): Credentials {
        const read = (key: string) => {
            const value = this.config.get<unknown>(sandbox ? key.replace("NETSUITE_", "NETSUITE_SANDBOX_") : key);
            if (typeof value !== "string" || !value.trim()) throw new ServiceUnavailableException("Conexion NetSuite no configurada.");
            return value.trim();
        };
        const result = { consumerKey: read("NETSUITE_CONSUMER_KEY"), consumerSecret: read("NETSUITE_CONSUMER_SECRET"), token: read("NETSUITE_TOKEN_ID"), tokenSecret: read("NETSUITE_TOKEN_SECRET"), realm: read("NETSUITE_REALM") };
        if (result.realm !== (sandbox ? "4552704_SB1" : "4552704") || this.config.get<string>("OAUTH_NETSUITE_SIGNATURE", "HMAC-SHA256") !== "HMAC-SHA256") throw new ServiceUnavailableException("Configuracion NetSuite incompatible con el RESTlet de lectura.");
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
    const data = decodeRestletBody(body);
    if (!data || typeof data !== "object" || "error" in data) throw new Error("upstream-payload");
    return data;
}

/** Decode legacy double-serialized JSON without exposing provider content. */
function decodeRestletBody(body: string): unknown {
    const data: unknown = JSON.parse(body);
    return typeof data === "string" ? (JSON.parse(data) as unknown) : data;
}

/** Only an explicit record-not-found response proves absence; HTTP failures alone do not. */
function assertProviderOrderExists(payload: unknown): void {
    const missingOrder = z.object({ status: z.literal(404), error: z.object({ code: z.literal("SALES_ORDER_NOT_FOUND") }) }).safeParse(payload);
    if (missingOrder.success) throw new NotFoundException({ statusCode: 404, error: "Not Found", code: "NETSUITE_SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe en NetSuite en el entorno configurado." });
}

function readSalesOrderBody(body: string): unknown {
    assertProviderOrderExists(decodeRestletBody(body));
    return parseRestletBody(body);
}

/** Map only documented pre-write rejections; all other failures remain uncertain. */
function confirmApprovalBody(body: string, id: string) {
    const payload = decodeRestletBody(body);
    assertProviderOrderExists(payload);
    const rejection = approvalRejection.safeParse(payload);
    if (rejection.success) {
        const code = rejection.data.error.code;
        const message = code === "APPROVAL_PREREQUISITES_REQUIRED" ? "NetSuite rechazó la aprobación: faltan las aprobaciones de Jefe de Ventas y/o Desarrolladora. Revisa la orden en el entorno configurado." : "NetSuite rechazó la aprobación porque la orden está marcada como venta caída.";
        throw new ConflictException({ statusCode: 409, error: "Conflict", code, message });
    }
    const { data } = approvalConfirmation.parse(parseRestletBody(body));
    if (data.id !== id) throw new Error("upstream-confirmation");
    return data;
}
