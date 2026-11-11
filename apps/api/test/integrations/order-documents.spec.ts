import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DOCUMENT_CHUNK_SIZE, DOCUMENT_READ, DOCUMENT_WRITE } from "../../src/integrations/microsoft365/order-documents.contract.js";
import { OrderDocumentsGraph } from "../../src/integrations/microsoft365/order-documents.graph.js";
import { OrderDocumentsService } from "../../src/integrations/microsoft365/order-documents.service.js";
import { openUploadTicket, sealUploadTicket } from "../../src/integrations/microsoft365/order-documents.ticket.js";
const secret = "test-secret-order-documents-32-characters";
const order = { source: "legacy", id: "78" };
function fixture(codes = [DOCUMENT_READ, DOCUMENT_WRITE, "formalizacion.orders.read"], denies: string[] = []) {
    const profile = { user: { publicId: "user-a", displayName: "Usuario" }, roles: [{ code: "formalizacion", status: "active" }], permissions: [...codes.map((code) => ({ code, effect: "allow" })), ...denies.map((code) => ({ code, effect: "deny" }))] };
    const identity = { getCurrentUser: vi.fn().mockResolvedValue(profile), withMicrosoftAccess: vi.fn().mockImplementation((_session, _scopes, callback: (token: string) => unknown) => callback("test-token")) };
    const repository = {
        resolve: vi.fn().mockImplementation((_target, check: (order: unknown) => void) => {
            check({ active: true });
            return Promise.resolve({ ...order, netsuiteId: "10518461" });
        }),
    };
    const graph = {
        folder: vi.fn().mockResolvedValue({ id: "folder-78", name: "10518461" }),
        files: vi.fn().mockResolvedValue([{ id: "file-a", name: "contrato.pdf", size: 10, modifiedAt: null }]),
        createFolder: vi.fn().mockResolvedValue({}),
        link: vi.fn().mockResolvedValue("https://tenant.sharepoint.com/file"),
        startUpload: vi.fn().mockResolvedValue({ uploadUrl: "https://tenant.sharepoint.com/upload/secret", expirationDateTime: new Date(Date.now() + 3600000).toISOString() }),
        chunk: vi.fn().mockResolvedValue({ completed: true }),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const config = new ConfigService({ ENABLE_ORDER_DOCUMENTS: true, MICROSOFT_DOCUMENTS_GROUP_ID: "group", MICROSOFT_ORDER_DOCUMENTS_ROOT_ID: "root", COOKIE_SECRET: secret });
    return { profile, identity, repository, graph, audit, config, service: new OrderDocumentsService(identity as never, repository as never, config, graph as never, audit as never) };
}
afterEach(() => {
    vi.unstubAllGlobals();
});
describe("documentos autorizados de la orden", () => {
    it("resuelve 78 mediante NetSuite10518461, no por nombre ni ID local", async () => {
        const f = fixture();
        const result = await f.service.list("session", order);
        expect(f.repository.resolve).toHaveBeenCalledWith(order, expect.any(Function), true);
        expect(f.graph.folder).toHaveBeenCalledWith("test-token", "group", "root", "10518461");
        expect(result.files).toHaveLength(1);
        expect(result.canWrite).toBe(true);
    });
    it.each([DOCUMENT_READ, "formalizacion.orders.read"])("bloquea sin %s antes de Graph", async (missing) => {
        const f = fixture([DOCUMENT_READ, DOCUMENT_WRITE, "formalizacion.orders.read"].filter((code) => code !== missing));
        await expect(f.service.list("session", order)).rejects.toMatchObject({ status: 403 });
        expect(f.graph.folder).not.toHaveBeenCalled();
    });
    it("deny personal prevalece y un lector no puede crear carpetas", async () => {
        const f = fixture(undefined, [DOCUMENT_WRITE]);
        expect((await f.service.list("s", order)).canWrite).toBe(false);
        await expect(f.service.create("s", order)).rejects.toMatchObject({ status: 403 });
        expect(f.graph.createFolder).not.toHaveBeenCalled();
    });
    it("falta de sesión Microsoft no se confunde con carpeta inexistente", async () => {
        const f = fixture();
        f.identity.withMicrosoftAccess.mockResolvedValue(null);
        await expect(f.service.list("s", order)).rejects.toMatchObject({ status: 403 });
        expect(f.graph.folder).not.toHaveBeenCalled();
    });
    it("consultar una carpeta ausente no crea nada", async () => {
        const f = fixture();
        f.graph.folder.mockResolvedValue(null);
        expect(await f.service.list("s", order)).toMatchObject({ folder: null, files: [] });
        expect(f.graph.createFolder).not.toHaveBeenCalled();
    });
    it("crear carpeta conserva el nombre ERP y es idempotente", async () => {
        const f = fixture();
        await f.service.create("s", order);
        expect(f.graph.createFolder).not.toHaveBeenCalled();
        f.graph.folder.mockResolvedValue(null);
        await f.service.create("s", order);
        expect(f.graph.createFolder).toHaveBeenCalledExactlyOnceWith("test-token", "group", "root", "10518461");
        expect(f.audit.record).toHaveBeenCalled();
    });
    it("nunca devuelve el uploadUrl y valida rangos antes de enviar bytes", async () => {
        const f = fixture();
        const started = await f.service.start("s", order, { name: "test.pdf", size: 3, conflict: "rename" });
        expect(JSON.stringify(started)).not.toContain("https://");
        expect(started.chunkSize).toBe(DOCUMENT_CHUNK_SIZE);
        await expect(f.service.chunk("s", order, { ticket: started.ticket, offset: 1, content: "YWJj" })).rejects.toMatchObject({ status: 400 });
        expect(f.graph.chunk).not.toHaveBeenCalled();
        expect(await f.service.chunk("s", order, { ticket: started.ticket, offset: 0, content: "YWJj" })).toEqual({ completed: true, auditRecorded: true });
        expect(f.graph.chunk).toHaveBeenCalledWith("https://tenant.sharepoint.com/upload/secret", 0, 3, Buffer.from("abc"));
    });
    it("un ticket no permite cambiar de usuario, orden o carpeta", async () => {
        const f = fixture();
        const started = await f.service.start("s", order, { name: "test.pdf", size: 3 });
        f.profile.user.publicId = "other";
        await expect(f.service.chunk("s", order, { ticket: started.ticket, offset: 0, content: "YWJj" })).rejects.toMatchObject({ status: 400 });
        f.profile.user.publicId = "user-a";
        f.graph.folder.mockResolvedValue({ id: "other-folder", name: "10518461" });
        await expect(f.service.chunk("s", order, { ticket: started.ticket, offset: 0, content: "YWJj" })).rejects.toMatchObject({ status: 403 });
        expect(f.graph.chunk).not.toHaveBeenCalled();
    });
    it("una escritura confirmada con fallo de auditoría no se reporta como fallida", async () => {
        const f = fixture();
        const started = await f.service.start("s", order, { name: "test.pdf", size: 3 });
        f.audit.record.mockRejectedValue(new Error("audit failure"));
        expect(await f.service.chunk("s", order, { ticket: started.ticket, offset: 0, content: "YWJj" })).toEqual({ completed: true, auditRecorded: false });
    });
    it.each([
        { name: "../file", size: 1 },
        { name: "empty.pdf", size: 0 },
        { name: "large.pdf", size: 300 * 1024 * 1024 },
    ])("rechaza archivo inválido %j", async (input) => {
        const f = fixture();
        await expect(f.service.start("s", order, input)).rejects.toMatchObject({ status: 400 });
        expect(f.graph.startUpload).not.toHaveBeenCalled();
    });
});
it("tickets cifrados expiran y detectan alteración, clave, usuario y orden distintos", () => {
    const payload = { user: "a", order: "78", folder: "folder", name: "test.pdf", url: "https://tenant.sharepoint.com/upload", size: 1, expires: Date.now() + 10000 };
    const ticket = sealUploadTicket(payload, secret);
    expect(openUploadTicket(ticket, secret, "a", "78")).toEqual(payload);
    for (const [value, key, user, target] of [
        [ticket, "wrong-key", "a", "78"],
        [ticket, secret, "b", "78"],
        [ticket, secret, "a", "79"],
        [ticket.slice(0, -4) + "xxxx", secret, "a", "78"],
        [sealUploadTicket({ ...payload, expires: Date.now() - 1 }, secret), secret, "a", "78"],
    ])
        expect(() => openUploadTicket(value ?? "", key ?? "", user ?? "", target ?? "")).toThrow("La carga expiró o no pertenece a esta orden y usuario. Consulta los archivos antes de iniciar otra c");
});
describe("Graph aislado por carpeta", () => {
    const graph = new OrderDocumentsGraph();
    it("rechaza archivos de otra carpeta antes de emitir links", async () => {
        const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "item", name: "f.pdf", file: {}, parentReference: { id: "other" } })));
        vi.stubGlobal("fetch", fetch);
        await expect(graph.link("token", { group: "g", folder: "folder", item: "item", action: "preview" })).rejects.toMatchObject({ status: 403 });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("lista todas las páginas sin seguir hosts externos", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: "1", name: "a.pdf", size: 1, file: {} }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/groups/g/drive/items/folder/children?$skiptoken=next" })))
            .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: "2", name: "b.pdf", file: {} }] })));
        vi.stubGlobal("fetch", fetch);
        expect(await graph.files("token", "g", "folder")).toHaveLength(2);
        fetch.mockResolvedValueOnce(new Response(JSON.stringify({ value: [], "@odata.nextLink": "https://example.com/private" })));
        await expect(graph.files("token", "g", "folder")).rejects.toMatchObject({ status: 502 });
    });
    it("no acepta una URL arbitraria como destino de subida", async () => {
        const fetch = vi.fn();
        vi.stubGlobal("fetch", fetch);
        await expect(graph.chunk("http://127.0.0.1/private", 0, 1, Buffer.from("a"))).rejects.toMatchObject({ status: 502 });
        expect(fetch).not.toHaveBeenCalled();
    });
    it("sube el rango sin enviar el token OAuth a la URL preautorizada", async () => {
        const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
        vi.stubGlobal("fetch", fetch);
        expect(await graph.chunk("https://tenant.sharepoint.com/upload", 0, 3, Buffer.from("abc"))).toEqual({ completed: true });
        expect(fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual", method: "PUT", headers: { "Content-Range": "bytes 0-2/3" } });
        expect(new Headers((fetch.mock.calls[0]?.[1] as RequestInit).headers).has("Authorization")).toBe(false);
    });
});

it("acepta la paginación canónica solo para el mismo drive y carpeta", async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ value: [], "@odata.nextLink": "https://graph.microsoft.com/v1.0/drives/drive-a/items/folder/children?$skiptoken=next" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: "1", name: "a.pdf", file: {} }] })));
    vi.stubGlobal("fetch", fetch);
    const graph = new OrderDocumentsGraph();
    expect(await graph.files("token", "g", "folder", "drive-a")).toHaveLength(1);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ value: [], "@odata.nextLink": "https://graph.microsoft.com/v1.0/drives/other/items/folder/children?$skiptoken=next" })));
    await expect(graph.files("token", "g", "folder", "drive-a")).rejects.toMatchObject({ status: 502 });
});

it("reads inactive order documents but blocks creating folders", async () => {
    const f = fixture();
    f.repository.resolve.mockImplementation((_target, check: (order: unknown) => void) => {
        check({ active: false, deleted: false });
        return Promise.resolve({ ...order, netsuiteId: "10518461" });
    });
    await expect(f.service.list("session", order)).resolves.toHaveProperty("files");
    await expect(f.service.create("session", order)).rejects.toMatchObject({ status: 404 });
    expect(f.graph.createFolder).not.toHaveBeenCalled();
});
