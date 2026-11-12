import { createHmac, randomBytes } from "node:crypto";

import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import { isNetsuiteRestletUrl, resolveNetsuiteEnvironment } from "../../config/netsuite-environment.js";

const MAX_BYTES = 5 * 1024 * 1024;
const approvalConfirmation = z.object({ status: z.literal(200), data: z.object({ type: z.literal("salesorder"), id: z.string(), approval: z.literal("formalization"), approved: z.literal(true), alreadyApproved: z.boolean() }) });
// Solo salen los rechazos de negocio ya conocidos. El mensaje del proveedor no se publica.
const approvalRejection = z.object({ status: z.literal(409), error: z.object({ code: z.enum(["APPROVAL_PREREQUISITES_REQUIRED", "SALES_ORDER_CANCELLED"]) }) });
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase());
interface Credentials {
    consumerKey: string;
    consumerSecret: string;
    token: string;
    tokenSecret: string;
    realm: string;
}
/** Normalizacion de RFC 5849. `realm` va en el encabezado y no se firma como parametro. */
export function netsuiteGetAuthorization(url: URL, credentials: Credentials, nonce: string, timestamp: string): string {
    return netsuiteAuthorization("GET", url, credentials, { nonce, timestamp });
}
/** El JSON no entra en la firma. Se firman el metodo, la URL y los parametros OAuth. */
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
/** Lectura y aprobación en el entorno del servidor; el cliente no elige cuentas ni scripts. */
@Injectable()
export class NetsuiteRestletClient {
    /** No abre conexion al arrancar. El entorno se resuelve en cada llamada. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
    /** Contrato estricto: un 200 genérico, otra orden o una instancia ausente nunca confirman el flujo. */
    async transferUnit(id: string) {
        try {
            const { body, environment } = await this.putSalesOrderAction(id, "transferUnit");
            const confirmation = z.object({ status: z.literal(200), data: z.object({ type: z.literal("salesorder"), id: z.literal(id), action: z.literal("transferUnit"), workflowId: z.literal("customworkflow220"), stateId: z.literal("workflowstate2780"), executed: z.literal(true), instanceId: z.string().regex(/^[1-9][0-9]*$/) }) }).safeParse(decodeLookup(body));
            if (!confirmation.success) throw new Error("unconfirmed_workflow");
            return { ...confirmation.data.data, environment };
        } catch {
            throw new BadGatewayException("NetSuite no confirmó el flujo de Unidad traspasada. La etapa no fue guardada; concilie la ejecución antes de reintentar.");
        }
    }

    /** PUT autenticado compartido; nunca repite una operación con efectos externos. */
    private async putSalesOrderAction(id: string, action: "approveFormalization" | "transferUnit", connection = this.connection()) {
        if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new BadRequestException("Identificador NetSuite invalido.");
        const { credentials, url, environment } = connection;
        const authorization = netsuiteAuthorization("PUT", url, credentials, { nonce: randomBytes(16).toString("hex"), timestamp: String(Math.floor(Date.now() / 1000)) });
        const response = await fetch(url, { method: "PUT", redirect: "error", headers: { Authorization: authorization, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ module: "salesOrders", action, id }), signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
            await response.body?.cancel();
            throw new Error("upstream");
        }
        return { body: await this.readBody(response), environment };
    }
    /** Solo confirma la orden pedida y la aprobacion de formalizacion. Timeout, red o un 200 generico quedan como resultado desconocido. */
    async approveFormalization(id: string): Promise<{ id: string; approved: true; alreadyApproved: boolean; environment: "sandbox" | "production" }> {
        if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new BadRequestException("Identificador NetSuite invalido.");
        // La misma operación usa credenciales y destino del entorno validado, sin fallback entre cuentas.
        const { credentials, url, environment } = this.connection();
        try {
            const response = await this.putSalesOrderAction(id, "approveFormalization", { credentials, url, environment });
            const data = confirmApprovalBody(response.body, id);
            return { id, approved: true, alreadyApproved: data.alreadyApproved, environment };
        } catch (error) {
            if ([ConflictException, NotFoundException].some((type) => error instanceof type)) throw error;
            throw new BadGatewayException("Resultado de aprobacion NetSuite desconocido. Consulta el estado antes de reintentar.");
        }
    }
    /** El entorno lo elige el servidor. Origin y Host del navegador no eligen la cuenta. */
    integrationContext() {
        const environment = this.environment();
        return { environment, accountId: environment === "production" ? "4552704" : "4552704_SB1" };
    }
    /** La foto verificada es la que puede persistir. El GET comun sigue siendo solo lectura. */
    readSalesOrderSnapshot(id: string): Promise<unknown> {
        return this.readSalesOrder(id, true);
    }
    /** Un id que no es un entero positivo no sale del servidor. Un 404 explicito del registro es ausencia; un fallo de transporte no lo es. */
    async readSalesOrder(id: string, verifiedSnapshot = false): Promise<unknown> {
        if (!/^[1-9][0-9]{0,19}$/.test(id)) throw new BadRequestException("Identificador NetSuite invalido.");
        const body = await this.get((environment) => this.salesOrderOperation(id, environment, verifiedSnapshot));
        try {
            return readSalesOrderBody(body);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            throw new BadGatewayException("No fue posible consultar NetSuite. La orden no fue modificada.");
        }
    }

    /** El numero devuelto, en mayusculas y sin espacios, tiene que ser el pedido. Mas de una orden es conflicto. Otra respuesta no elige un id. */
    async findSalesOrderByTranId(tranid: string): Promise<string> {
        const body = await this.get(() => ({ module: "salesOrders", action: "findByTranId", tranid }));
        const payload = decodeLookup(body);
        assertProviderOrderExists(payload);
        if (z.object({ status: z.literal(409), error: z.object({ code: z.literal("SALES_ORDER_AMBIGUOUS") }) }).safeParse(payload).success) throw new ConflictException("NetSuite devolvió más de una orden con ese número.");
        const found = z.object({ status: z.literal(200), data: z.object({ id: z.string().regex(/^[1-9][0-9]{0,19}$/), tranid: z.string() }) }).safeParse(payload);
        if (found.success && found.data.data.tranid.trim().toUpperCase() === tranid) return found.data.data.id;
        throw new BadGatewayException("NetSuite no confirmó el número de orden. Verifica la versión del RESTlet.");
    }

    /** Trae solo los campos que la importacion usa. El id devuelto tiene que ser el pedido. */
    async readImportCustomer(id: string) {
        const body = await this.get(() => ({ module: "leads", action: "importCustomer", id }));
        const parsed = z
            .object({
                status: z.literal(200),
                data: z.object({
                    id: z.string(),
                    fullName: z.string().trim().min(1).max(250),
                    company: z.string().max(250).nullable(),
                    email: z.string().max(254).nullable(),
                    phone: z.string().max(80).nullable(),
                    campaign: z.string().nullable(),
                    campaignName: z.string().trim().min(1).max(180).nullable().optional(),
                }),
            })
            .safeParse(decodeLookup(body));
        if (!parsed.success || parsed.data.data.id !== id) throw new BadGatewayException("NetSuite no confirmó la ficha del cliente.");
        return parsed.data.data;
    }

    /** Un atributo acotado para conciliar una relacion que Habita todavia no tiene. */
    async readImportRelation(kind: "subsidiary" | "user", id: string) {
        const body = await this.get(() => ({ module: "salesOrders", action: "importRelation", kind, id }));
        const parsed = z.object({ status: z.literal(200), data: z.object({ id: z.string(), value: z.string().trim().min(1).max(254).nullable() }) }).safeParse(decodeLookup(body));
        if (!parsed.success || parsed.data.data.id !== id) throw new BadGatewayException("NetSuite no confirmó la relación " + kind + ".");
        return parsed.data.data.value;
    }

    /** Codigo del expediente y proyecto principal. El proyecto tiene que caber en un entero. */
    async readImportUnit(id: string) {
        const body = await this.get(() => ({ module: "salesOrders", action: "importRelation", kind: "unitFile", id }));
        const parsed = z
            .object({
                status: z.literal(200),
                data: z.object({
                    id: z.string(),
                    code: z.string().trim().min(1).max(255),
                    projectName: z.string().trim().min(1).max(180).nullable().optional(),
                    projectId: z
                        .string()
                        .regex(/^[1-9][0-9]{0,9}$/)
                        .refine((value) => Number(value) <= 2147483647),
                }),
            })
            .safeParse(decodeLookup(body));
        if (!parsed.success || parsed.data.data.id !== id) throw new BadGatewayException("NetSuite no confirmó el código y el proyecto principal del expediente " + id + ".");
        return parsed.data.data;
    }

    private async get(operation: (environment: "production" | "sandbox") => Record<string, string>): Promise<string> {
        const { credentials, url, environment } = this.connection();
        for (const [key, value] of Object.entries(operation(environment))) url.searchParams.set(key, value);
        const authorization = netsuiteGetAuthorization(url, credentials, randomBytes(16).toString("hex"), String(Math.floor(Date.now() / 1000)));
        try {
            const response = await fetch(url, { method: "GET", redirect: "error", headers: { Authorization: authorization, Accept: "application/json", "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000) });
            if (!response.ok) {
                await response.body?.cancel();
                throw new Error("upstream");
            }
            return await this.readBody(response);
        } catch {
            throw new BadGatewayException("No fue posible consultar NetSuite. La orden no fue modificada.");
        }
    }
    /** Sandbox usa el modulo. Produccion lee con el contrato configurado: `modules` o el `rType` legado. No se mezclan cuentas. */
    private salesOrderOperation(id: string, environment: "production" | "sandbox", verifiedSnapshot = false): Record<string, string> {
        if (verifiedSnapshot) return { module: "salesOrders", id, action: "syncSnapshot" };
        if (environment === "sandbox") return { module: "salesOrders", id };
        const mode = this.config.get<unknown>("NETSUITE_PRODUCTION_READ_MODE") ?? "legacy";
        if (mode === "modules") return { module: "salesOrders", id };
        if (mode === "legacy") return { rType: "salesordersExtraer", id };
        throw new ServiceUnavailableException("Contrato NetSuite incompatible.");
    }
    /** La URL y el realm se validan antes de armar la peticion. No hay fallback a la otra cuenta. */
    private connection(): { credentials: Credentials; url: URL; environment: "production" | "sandbox" } {
        const environment = this.environment();
        const sandbox = environment === "sandbox";
        const credentials = this.credentials(sandbox);
        const deploymentUrl = sandbox ? this.config.get<unknown>("NETSUITE_SANDBOX_RESTLET_URL") : this.config.get<unknown>("NETSUITE_PRODUCTION_RESTLET_URL");
        if (!isNetsuiteRestletUrl(deploymentUrl, environment)) throw new ServiceUnavailableException("Configuracion NetSuite incompatible.");
        const url = new URL(deploymentUrl);
        return { credentials, url, environment };
    }
    /** El frente configurado fija el entorno. Un loopback fuerza Sandbox aunque la variable diga produccion. Las cabeceras del navegador no eligen la cuenta. */
    private environment(): "production" | "sandbox" {
        try {
            return resolveNetsuiteEnvironment(this.config.get<unknown>("FRONTEND_ORIGIN"), this.config.get<unknown>("NETSUITE_ENVIRONMENT"));
        } catch {
            throw new ServiceUnavailableException("Configuracion NetSuite incompatible.");
        }
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

/** Un RESTlet puede entregar el JSON dos veces serializado. Un cuerpo con `error` no se devuelve como ficha. */
function parseRestletBody(body: string): unknown {
    const data = decodeRestletBody(body);
    if (!data || typeof data !== "object" || "error" in data) throw new Error("upstream-payload");
    return data;
}

/** La segunda vuelta se decodifica aqui. El texto del proveedor no se reenvia. */
function decodeRestletBody(body: string): unknown {
    const data: unknown = JSON.parse(body);
    return typeof data === "string" ? (JSON.parse(data) as unknown) : data;
}

/** Solo `SALES_ORDER_NOT_FOUND` prueba que la orden no esta. Un HTTP fallido no basta. */
function assertProviderOrderExists(payload: unknown): void {
    const missingOrder = z.object({ status: z.literal(404), error: z.object({ code: z.literal("SALES_ORDER_NOT_FOUND") }) }).safeParse(payload);
    if (missingOrder.success) throw new NotFoundException({ statusCode: 404, error: "Not Found", code: "NETSUITE_SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe en NetSuite en el entorno configurado." });
}

function readSalesOrderBody(body: string): unknown {
    assertProviderOrderExists(decodeRestletBody(body));
    return parseRestletBody(body);
}

/** Prerrequisitos o venta caida salen como 409 con mensaje propio. Cualquier otra falla sigue siendo desconocida. */
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

/** Una busqueda que no parsea no se trata como ausencia. Queda sin confirmar. */
function decodeLookup(body: string): unknown {
    try {
        return decodeRestletBody(body);
    } catch {
        return null;
    }
}
