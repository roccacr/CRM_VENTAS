import { apiRequest } from "../api/api-client";
import type { NetsuiteOrderIdentity } from "./netsuite-order-service";
export interface OrderDocument {
    readonly id: string;
    readonly name: string;
    readonly size: number;
    readonly modifiedAt: string | null;
}
export interface OrderDocuments {
    readonly reference: string;
    readonly folder: { readonly id: string; readonly name: string } | null;
    readonly files: readonly OrderDocument[];
    readonly canWrite: boolean;
}
export const documentsPath = (identity: NetsuiteOrderIdentity) => `/formalization/orders/${identity.source}/${encodeURIComponent(identity.id)}/documents`;
export const readOrderDocuments = (identity: NetsuiteOrderIdentity, signal?: AbortSignal) => apiRequest<OrderDocuments>(documentsPath(identity), signal ? { signal } : {});
export const createOrderFolder = (identity: NetsuiteOrderIdentity) => apiRequest<{ created: boolean; auditRecorded: boolean }>(documentsPath(identity) + "/folder", { method: "POST", retryOnUnauthorized: false });
export const orderDocumentLink = (identity: NetsuiteOrderIdentity, itemId: string, action: "preview" | "download") => apiRequest<{ url: string }>(documentsPath(identity) + "/link", { method: "POST", body: { itemId, action } });
const base64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                reject(new Error("No fue posible leer el archivo."));
                return;
            }
            resolve(reader.result.split(",")[1] ?? "");
        };
        reader.onerror = () => {
            reject(new Error("No fue posible leer el archivo."));
        };
        reader.readAsDataURL(blob);
    });
/** Los fragmentos pasan por BFF; React nunca recibe tokens ni el uploadUrl de Microsoft. No se repiten escrituras automáticamente. */
export async function uploadOrderDocument(identity: NetsuiteOrderIdentity, file: File, { conflict, onProgress, signal }: { conflict: "fail" | "rename" | "replace"; onProgress: (percent: number) => void; signal: AbortSignal }) {
    const path = documentsPath(identity) + "/uploads";
    const name = file.name.replace(/[\\/:*?"<>|#%]/gu, "").trim();
    const start = await apiRequest<{ ticket: string; chunkSize: number }>(path, { method: "POST", body: { name, size: file.size, conflict }, signal, retryOnUnauthorized: false });
    if (start.chunkSize !== 327680) throw new Error("Tamaño de fragmento no válido.");
    let completed = false;
    let auditRecorded = true;
    for (let offset = 0; offset < file.size; offset += start.chunkSize) {
        signal.throwIfAborted();
        const content = await base64(file.slice(offset, Math.min(file.size, offset + start.chunkSize)));
        const result = await apiRequest<{ completed: boolean; auditRecorded: boolean }>(path + "/chunk", { method: "POST", body: { ticket: start.ticket, offset, content }, signal, retryOnUnauthorized: false });
        completed = result.completed;
        auditRecorded = result.auditRecorded;
        onProgress(Math.round((Math.min(file.size, offset + start.chunkSize) / file.size) * 100));
    }
    if (!completed) throw new Error("Microsoft no confirmó la carga. Actualiza los archivos antes de reintentar.");
    return { auditRecorded };
}
