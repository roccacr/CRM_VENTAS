import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { SecurityAuditService } from "../../modules/crm/audit/security-audit.service.js";
import { IdentityService } from "../../modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../modules/crm/identity/identity.types.js";
import { assertFormalizationOrderReadable } from "../../modules/crm/sales/sales-orders/formalization-read.policy.js";
import { orderTimingIdentity } from "../../modules/crm/sales/sales-orders/order-timing.contract.js";
import { NetsuiteOrderRepository } from "../netsuite/netsuite-order.repository.js";
import { chunkInput, DOCUMENT_CHUNK_SIZE, DOCUMENT_READ, DOCUMENT_WRITE, itemInput, uploadInput } from "./order-documents.contract.js";
import { OrderDocumentsGraph } from "./order-documents.graph.js";
import { openUploadTicket, sealUploadTicket } from "./order-documents.ticket.js";

/** Orquesta la autorización CRM y las operaciones documentales delegadas en Microsoft. */
@Injectable()
export class OrderDocumentsService {
    /** Dependencias explícitas para resolver la orden antes de contactar al proveedor. */
    // Cinco dependencias explícitas conservan separados identidad, resolución de orden, configuración, proveedor y auditoría.
    // eslint-disable-next-line max-params
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NetsuiteOrderRepository) private readonly orders: NetsuiteOrderRepository,
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(OrderDocumentsGraph) private readonly graph: OrderDocumentsGraph,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
    ) {}
    private allowed(profile: IdentityProfile, permission: string) {
        return profile.permissions.some((p) => p.code === permission && p.effect === "allow") && !profile.permissions.some((p) => p.code === permission && p.effect === "deny");
    }
    /** Cada operación resuelve autoridad nativa/legacy y permisos vigentes antes de contactar Graph. */
    private async authorized(session: string | undefined, input: unknown, write: boolean) {
        const profile = await this.identity.getCurrentUser(session);
        if (!this.allowed(profile, DOCUMENT_READ) || (write && !this.allowed(profile, DOCUMENT_WRITE))) throw new ForbiddenException("No tienes permiso para esta operación documental.");
        const target = orderTimingIdentity.safeParse(input);
        if (!target.success) throw new BadRequestException("Identidad de orden inválida.");
        const order = await this.orders.resolve(target.data, (row) => {
            assertFormalizationOrderReadable(profile, row);
        });
        if (this.config.get<boolean>("ENABLE_ORDER_DOCUMENTS") !== true) throw new ServiceUnavailableException("La integración documental no está habilitada.");
        return { profile, order, group: this.config.getOrThrow<string>("MICROSOFT_DOCUMENTS_GROUP_ID"), root: this.config.getOrThrow<string>("MICROSOFT_ORDER_DOCUMENTS_ROOT_ID") };
    }
    private async delegated<T>(session: string | undefined, callback: (token: string) => Promise<T>): Promise<T> {
        const value = await this.identity.withMicrosoftAccess(session, ["Files.ReadWrite.All"], callback);
        if (value === null) throw new ForbiddenException("Conecta Microsoft con la misma cuenta del CRM y autoriza el acceso a archivos.");
        return value;
    }
    private async folder(token: string, context: Awaited<ReturnType<OrderDocumentsService["authorized"]>>) {
        const folder = await this.graph.folder(token, context.group, context.root, context.order.netsuiteId);
        if (!folder) throw new NotFoundException("Esta orden aún no tiene carpeta documental.");
        return folder;
    }
    private async auditIntent(context: Awaited<ReturnType<OrderDocumentsService["authorized"]>>, action: string, fileName?: string) {
        await this.audit.record({ eventType: "order_documents_operation_requested", summary: `Documentos de orden: ${action}`, metadata: { actor: { publicId: context.profile.user.publicId, name: context.profile.user.displayName }, order: context.order, action, ...(fileName ? { fileName } : {}) } });
    }
    /** Registra el resultado sin confundir un fallo de auditoría con un fallo de subida. */
    private async auditCompleted(context: Awaited<ReturnType<OrderDocumentsService["authorized"]>>, action: string, fileName?: string): Promise<boolean> {
        try {
            await this.audit.record({ eventType: "order_documents_operation_completed", summary: `Documentos de orden: ${action}`, metadata: { actor: { publicId: context.profile.user.publicId, name: context.profile.user.displayName }, order: context.order, action, ...(fileName ? { fileName } : {}) } });
            return true;
        } catch {
            // El proveedor ya confirmó la escritura: un fallo de auditoría nunca debe presentarse como archivo no subido.
            return false;
        }
    }
    /** Consulta la carpeta y sus archivos sin crear recursos externos. */
    async list(session: string | undefined, input: unknown) {
        const context = await this.authorized(session, input, false);
        return this.delegated(session, async (token) => {
            const folder = await this.graph.folder(token, context.group, context.root, context.order.netsuiteId);
            return { folder, reference: context.order.netsuiteId, files: folder ? await this.graph.files(token, context.group, folder.id, folder.driveId) : [], canWrite: this.allowed(context.profile, DOCUMENT_WRITE) };
        });
    }
    /** Crea una carpeta únicamente por petición expresa y mantiene el nombre de NetSuite. */
    async create(session: string | undefined, input: unknown) {
        const context = await this.authorized(session, input, true);
        await this.auditIntent(context, "create_folder");
        return this.delegated(session, async (token) => {
            const existing = await this.graph.folder(token, context.group, context.root, context.order.netsuiteId);
            if (!existing) await this.graph.createFolder(token, context.group, context.root, context.order.netsuiteId);
            return { created: !existing, auditRecorded: await this.auditCompleted(context, "folder_ready") };
        });
    }
    /** Obtiene un enlace temporal solo tras validar pertenencia a la carpeta. */
    async link(session: string | undefined, input: unknown, raw: unknown) {
        const request = itemInput.safeParse(raw);
        if (!request.success) throw new BadRequestException("Archivo o acción inválidos.");
        const context = await this.authorized(session, input, false);
        return this.delegated(session, async (token) => {
            const folder = await this.folder(token, context);
            return { url: await this.graph.link(token, { group: context.group, folder: folder.id, item: request.data.itemId, action: request.data.action }) };
        });
    }
    /** Inicia una carga y cifra su autorización para mantener el uploadUrl en el servidor. */
    async start(session: string | undefined, input: unknown, raw: unknown) {
        const parsed = uploadInput.safeParse(raw);
        if (!parsed.success) throw new BadRequestException("Archivo inválido. Máximo 250 MB y nombre sin caracteres reservados.");
        const request = parsed.data;
        const context = await this.authorized(session, input, true);
        await this.auditIntent(context, `upload_${request.conflict}`, request.name);
        return this.delegated(session, async (token) => {
            const folder = await this.folder(token, context);
            const upload = await this.graph.startUpload(token, { group: context.group, folder: folder.id, name: request.name, conflict: request.conflict });
            const expires = Math.min(Date.parse(upload.expirationDateTime), Date.now() + 60 * 60 * 1000);
            if (!Number.isFinite(expires) || expires <= Date.now()) throw new ServiceUnavailableException("Microsoft devolvió una sesión de carga vencida.");
            return { chunkSize: DOCUMENT_CHUNK_SIZE, ticket: sealUploadTicket({ user: context.profile.user.publicId, order: context.order.netsuiteId, folder: folder.id, name: request.name, url: upload.uploadUrl, size: request.size, expires }, this.config.getOrThrow<string>("COOKIE_SECRET")) };
        });
    }
    /** Revalida permisos, carpeta y rango antes de subir cada fragmento. */
    async chunk(session: string | undefined, input: unknown, raw: unknown) {
        const parsed = chunkInput.safeParse(raw);
        if (!parsed.success) throw new BadRequestException("Fragmento de archivo inválido.");
        const context = await this.authorized(session, input, true);
        const request = parsed.data;
        const ticket = openUploadTicket(request.ticket, this.config.getOrThrow<string>("COOKIE_SECRET"), context.profile.user.publicId, context.order.netsuiteId);
        const bytes = Buffer.from(request.content, "base64");
        const remaining = ticket.size - request.offset;
        if (bytes.toString("base64") !== request.content || request.offset % DOCUMENT_CHUNK_SIZE !== 0 || remaining <= 0 || bytes.length !== Math.min(DOCUMENT_CHUNK_SIZE, remaining)) throw new BadRequestException("El rango o tamaño del fragmento no es válido.");
        return this.delegated(session, async (token) => {
            const folder = await this.folder(token, context);
            if (folder.id !== ticket.folder) throw new ForbiddenException("La carpeta de la orden cambió.");
            const result = await this.graph.chunk(ticket.url, request.offset, ticket.size, bytes);
            return { ...result, auditRecorded: result.completed ? await this.auditCompleted(context, "upload_completed", ticket.name) : true };
        });
    }
}
