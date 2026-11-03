import { BadGatewayException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { DocumentItem } from "./order-documents.contract.js";
const base = "https://graph.microsoft.com/v1.0";
const itemSchema = z.object({ id: z.string(), name: z.string(), size: z.number().default(0), lastModifiedDateTime: z.string().optional(), file: z.unknown().optional(), folder: z.unknown().optional(), parentReference: z.object({ id: z.string().optional(), driveId: z.string().optional() }).optional() });
const pageSchema = z.object({ value: z.array(itemSchema), "@odata.nextLink": z.string().optional() });
const pathId = encodeURIComponent;
/** Solo rutas Graph construidas por el servidor; la URL de subida se valida antes de usarla. */
@Injectable()
export class OrderDocumentsGraph {
    private root(group: string) {
        return `/groups/${pathId(group)}/drive/items/`;
    }
    private async checked(url: string, init: RequestInit) {
        let response: Response;
        try {
            response = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(45000) });
        } catch {
            throw new BadGatewayException("Microsoft no respondió. Consulta los archivos antes de reintentar una escritura.");
        }
        if ([401, 403].includes(response.status)) throw new ForbiddenException("Microsoft no autorizó el acceso a los documentos.");
        if (response.status === 404) throw new NotFoundException("Carpeta o archivo no encontrado en Microsoft.");
        if ([409, 412, 416].includes(response.status)) throw new ConflictException("Conflicto de archivo o carga. Actualiza el listado antes de reintentar.");
        if (!response.ok) throw new BadGatewayException("No fue posible completar la operación documental en Microsoft.");
        return response;
    }
    private async json(token: string, path: string, method = "GET", body?: unknown): Promise<unknown> {
        const response = await this.checked(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return response.json();
    }
    /** Busca la carpeta exacta por referencia NetSuite, sin confundirla con el ID local. */
    async folder(token: string, group: string, root: string, name: string) {
        try {
            const result = itemSchema.parse(await this.json(token, `${this.root(group)}${pathId(root)}:/${encodeURIComponent(name)}`));
            if (!result.folder || result.name !== name) throw new ConflictException("La carpeta documental de la orden no es válida.");
            return { id: result.id, name: result.name, driveId: result.parentReference?.driveId };
        } catch (error) {
            if (error instanceof NotFoundException) return null;
            throw error;
        }
    }
    /** Crea el hijo en la raíz configurada y rechaza duplicados. */
    async createFolder(token: string, group: string, root: string, name: string) {
        // Fallar ante duplicados evita crear carpetas con sufijos que romperían la asociación por NetSuite.
        return this.json(token, `${this.root(group)}${pathId(root)}/children`, "POST", { name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" });
    }
    /** Recorre todas las páginas autorizadas sin devolver un listado parcial. */
    async files(token: string, group: string, folder: string, driveId?: string): Promise<DocumentItem[]> {
        let path: string | undefined = `${this.root(group)}${pathId(folder)}/children?$select=id,name,size,lastModifiedDateTime,file,folder&$top=200`;
        const items: DocumentItem[] = [];
        let pages = 0;
        while (path) {
            if (++pages > 50) throw new BadGatewayException("La carpeta excede el límite de consulta; abre SharePoint para revisar su contenido.");
            const page = pageSchema.parse(await this.json(token, path));
            for (const item of page.value) if (item.file) items.push({ id: item.id, name: item.name, size: item.size, modifiedAt: item.lastModifiedDateTime ?? null });
            path = this.nextPage(page["@odata.nextLink"], [`${base}${this.root(group)}${pathId(folder)}/children?`, ...(driveId ? [`${base}/drives/${pathId(driveId)}/items/${pathId(folder)}/children?`] : [])]);
        }
        return items;
    }
    /** Impide seguir enlaces de paginación ajenos a la carpeta consultada. */
    private nextPage(value: string | undefined, prefixes: readonly string[]) {
        if (!value) return undefined;
        if (!prefixes.some((prefix) => value.startsWith(prefix))) throw new BadGatewayException("Microsoft devolvió una paginación no válida.");
        return value.slice(base.length);
    }
    /** Impide consultar un archivo que pertenezca a otra orden. */
    async assertChild(token: string, group: string, folder: string, item: string) {
        const result = itemSchema.parse(await this.json(token, `${this.root(group)}${pathId(item)}?$select=id,name,file,parentReference`));
        if (!result.file || result.parentReference?.id !== folder) throw new ForbiddenException("El archivo no pertenece a la carpeta de esta orden.");
    }
    /** Entrega un enlace temporal únicamente para un archivo de la carpeta autorizada. */
    async link(token: string, input: { group: string; folder: string; item: string; action: "preview" | "download" }) {
        const { group, folder, item, action } = input;
        await this.assertChild(token, group, folder, item);
        const path = `${this.root(group)}${pathId(item)}`;
        const result = action === "preview" ? await this.json(token, `${path}/preview`, "POST", {}) : await this.json(token, `${path}?$select=id,@microsoft.graph.downloadUrl`);
        const data = z.record(z.string(), z.unknown()).parse(result);
        const url = z.url().parse(data[action === "preview" ? "getUrl" : "@microsoft.graph.downloadUrl"]);
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password || ![".sharepoint.com", ".1drv.com", ".officeapps.live.com", ".office.com", ".onedrive.com"].some((host) => parsed.hostname.endsWith(host))) throw new BadGatewayException("Microsoft devolvió un enlace no válido.");
        return url;
    }
    /** Crea una carga con política explícita de duplicados y valida el destino. */
    async startUpload(token: string, input: { group: string; folder: string; name: string; conflict: string }) {
        const { group, folder, name, conflict } = input;
        const data = z.object({ uploadUrl: z.url(), expirationDateTime: z.string() }).parse(await this.json(token, `${this.root(group)}${pathId(folder)}:/${encodeURIComponent(name)}:/createUploadSession`, "POST", { item: { "@microsoft.graph.conflictBehavior": conflict, name } }));
        this.assertUploadUrl(data.uploadUrl);
        return data;
    }
    private assertUploadUrl(value: string) {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password || ![".up.1drv.com", ".sharepoint.com"].some((host) => url.hostname.endsWith(host))) throw new BadGatewayException("Microsoft devolvió un destino de carga no permitido.");
    }
    /** Envía un rango de bytes sin adjuntar OAuth a una URL preautorizada. */
    async chunk(url: string, offset: number, size: number, bytes: Buffer) {
        this.assertUploadUrl(url);
        const response = await this.checked(url, { method: "PUT", headers: { "Content-Type": "application/octet-stream", "Content-Range": `bytes ${String(offset)}-${String(offset + bytes.length - 1)}/${String(size)}` }, body: new Uint8Array(bytes) });
        await response.arrayBuffer();
        return { completed: response.status === 200 || response.status === 201 };
    }
}
