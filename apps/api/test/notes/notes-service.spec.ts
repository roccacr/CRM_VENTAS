import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { NotesRepository } from "../../src/modules/crm/notes/notes.repository.js";
import { NotesService } from "../../src/modules/crm/notes/notes.service.js";
import type { OrderTimingService } from "../../src/modules/crm/sales/sales-orders/order-timing.service.js";
import { anyOf } from "../support/throws.js";
const id = "01K00000000000000000000000";
const note = { internalId: 7, publicId: id, authorId: 1, authorPublicId: "actor", authorName: "Actor", moduleCode: "mercadeo", title: null, text: "Privado", color: "#FFFF88", priority: "normal", status: "open", visibility: "private", version: 1, createdAt: "2026-10-27T00:00:00Z", updatedAt: "2026-10-27T00:00:00Z", completedAt: null, archivedAt: null };
const profile = { user: { publicId: "actor" }, roles: [{ code: "owner", status: "active" }], permissions: ["read", "create", "edit_own", "resolve_own", "archive_own"].map((action) => ({ code: `mercadeo.notes.${action}`, effect: "allow", scope: "assigned" })) };
const identity = { getCurrentUser: vi.fn() };
const repo = { find: vi.fn(), context: vi.fn(), list: vi.fn(), create: vi.fn(), edit: vi.fn(), lifecycle: vi.fn(), move: vi.fn(), placement: vi.fn(), placements: vi.fn(), history: vi.fn() };
const timing = { read: vi.fn() };
const related = { summariesForNotes: vi.fn(), authorizeReferences: vi.fn(), resourceAliases: vi.fn() };
let service: NotesService;
beforeEach(() => {
    vi.clearAllMocks();
    related.summariesForNotes.mockResolvedValue(new Map());
    related.authorizeReferences.mockResolvedValue(undefined);
    related.resourceAliases.mockImplementation((_profile: unknown, reference: unknown) => Promise.resolve([reference]));
    identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [...profile.permissions, { code: "mercadeo.home.read", scope: "assigned", effect: "allow" }] });
    repo.find.mockResolvedValue(note);
    repo.context.mockResolvedValue({ kind: "view" });
    repo.placement.mockResolvedValue([]);
    repo.placements.mockResolvedValue(new Map());
    repo.list.mockResolvedValue({ items: [note], total: 1 });
    service = new NotesService(identity as unknown as IdentityService, repo as unknown as NotesRepository, timing as unknown as OrderTimingService, { notify: () => {} } as never, related as never);
});
describe("protected notes service", () => {
    it("denies before repository access when permission is absent or denied", async () => {
        identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [] });
        await expect(service.read("session", id, { moduleCode: "mercadeo" })).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.find).not.toHaveBeenCalled();
    });
    it("does not allow Owner to edit another author's note", async () => {
        repo.find.mockResolvedValue({ ...note, authorPublicId: "someone-else", visibility: "shared" });
        await expect(service.edit("session", id, { moduleCode: "mercadeo", operationId: "operation_00000001", expectedVersion: 1, text: "Changed" })).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.edit).not.toHaveBeenCalled();
    });
    it("does not trust a different persisted module", async () => {
        repo.find.mockResolvedValue({ ...note, moduleCode: "ventas" });
        await expect(service.read("session", id, { moduleCode: "mercadeo" })).rejects.toBeInstanceOf(NotFoundException);
    });
    it("lets an explicitly invited participant with self baseline read without gaining authorship", async () => {
        identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: profile.permissions.map((p) => ({ ...p, scope: "self" })) });
        repo.find.mockResolvedValue({ ...note, authorPublicId: "other", visibility: "shared" });
        repo.context.mockResolvedValue({ kind: "personal" });
        const result = await service.read("session", id, { moduleCode: "mercadeo" });
        expect(result.note.capabilities.canEdit).toBe(false);
        await expect(service.edit("session", id, { moduleCode: "mercadeo", operationId: "operation_00000001", expectedVersion: 1, text: "replace" })).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("returns canonical fields without internal IDs and without stage4 capabilities", async () => {
        const value = await service.read("session", id, { moduleCode: "mercadeo" });
        expect(value.note).toMatchObject({ id, content: { format: "plain_text", text: "Privado" }, capabilities: { canShare: false, canReply: false, canEdit: true } });
        expect(JSON.stringify(value)).not.toContain("internalId");
        expect(JSON.stringify(value)).not.toContain("authorId");
    });
    it("redacts inaccessible order while retaining owner read and edit", async () => {
        const grants = profile.permissions.map((p) => ({ ...p, code: p.code.replace("mercadeo", "formalizacion") }));
        identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: grants });
        repo.find.mockResolvedValue({ ...note, moduleCode: "formalizacion" });
        repo.context.mockResolvedValue({ kind: "sales_order", source: "native", id });
        timing.read.mockRejectedValue(new ForbiddenException());
        expect((await service.read("session", id, { moduleCode: "formalizacion" })).note.context).toBeNull();
        await service.edit("session", id, { moduleCode: "formalizacion", operationId: "operation_00000001", expectedVersion: 1, text: "Changed" });
        expect(repo.edit).toHaveBeenCalledTimes(1);
    });
    it("creates private Home notes without contacting legacy or changing other entities", async () => {
        await service.create("session", { moduleCode: "mercadeo", operationId: "operation_00000001", text: "Llamar" });
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ actorPublicId: "actor", moduleCode: "mercadeo" }), expect.objectContaining({ text: "Llamar", context: { kind: "view" } }), { kind: "view" });
        expect(timing.read).not.toHaveBeenCalled();
    });
    it("deduplicates the primary order alias inside create without changing the receipt payload", async () => {
        const legacy = { kind: "sales_order", source: "legacy", id: "208" };
        const native = { kind: "sales_order", source: "native", id };
        const command = { moduleCode: "mercadeo", operationId: "operation_alias_create_001", text: "Test", context: { kind: "sales_order", source: "legacy", id: "208" }, relatedRecords: [native] };
        timing.read.mockResolvedValue({ order: { source: "legacy", id: "legacy:208" } });
        related.resourceAliases.mockResolvedValue([legacy, native]);
        repo.create.mockImplementationOnce(async (_access: unknown, input: { relatedRecords: unknown[] }, _context: unknown, guard: () => Promise<unknown>) => {
            expect(input.relatedRecords).toEqual([native]);
            expect(await guard()).toEqual([]);
            expect(input.relatedRecords).toEqual([native]);
            return { noteId: id, version: 1, replayed: false };
        });
        await expect(service.create("session", command)).resolves.toMatchObject({ noteId: id });
    });
    it("uses the caller's layout access without letting a participant edit content", async () => {
        repo.find.mockResolvedValue({ ...note, authorPublicId: "other", visibility: "shared" });
        await service.move("session", id, { moduleCode: "mercadeo", operationId: "operation_00000002", expectedLayoutVersion: 0, x: 0, y: 0, width: 280, height: 200 });
        expect(repo.move).toHaveBeenCalledWith(expect.objectContaining({ actorPublicId: "actor" }), id, expect.any(Object));
        expect(repo.edit).not.toHaveBeenCalled();
    });
});

describe("registered context authorization", () => {
    it("creates unlinked personal notes without order access", async () => {
        await service.create("session", { moduleCode: "mercadeo", operationId: "operation_00000001", text: "Personal", context: { kind: "personal" } });
        expect(repo.create).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), { kind: "personal" });
        expect(timing.read).not.toHaveBeenCalled();
    });
    it("denies an unknown view and a known view without its current read permission", async () => {
        for (const code of ["marketing-unknown", "marketing-leads", "sales-home"]) {
            await expect(service.create("session", { moduleCode: "mercadeo", operationId: "operation_00000001", text: "Test", context: { kind: "view", code } })).rejects.toThrow(anyOf("Vista de notas no registrada en el modulo.", "Permiso de vista insuficiente."));
        }
        expect(repo.create).not.toHaveBeenCalled();
    });
    it("authorizes the registered view using current effective permission including denies", async () => {
        const read = { code: "mercadeo.leads.read", scope: "assigned", effect: "allow" };
        identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [...profile.permissions, read] });
        const command = { moduleCode: "mercadeo", operationId: "operation_00000001", text: "Test", context: { kind: "view", code: "marketing-leads" } };
        await service.create("session", command);
        expect(repo.create).toHaveBeenCalledTimes(1);
        identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [...profile.permissions, read, { ...read, effect: "deny" }] });
        await expect(service.create("session", command)).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("rechecks legacy order identity and fails closed on native-first aliases", async () => {
        identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: profile.permissions.map((p) => ({ ...p, code: p.code.replace("mercadeo", "formalizacion") })) });
        const command = { moduleCode: "formalizacion", operationId: "operation_00000001", text: "Test", context: { kind: "sales_order", source: "legacy", id: "208" } };
        timing.read.mockResolvedValue({ order: { source: "legacy", id: "legacy:208" } });
        await service.create("session", command);
        expect(timing.read).toHaveBeenCalledWith("session", { source: "legacy", id: "208" }, { page: 1, pageSize: 1 });
        repo.create.mockClear();
        timing.read.mockResolvedValue({ order: { source: "native", id } });
        related.resourceAliases.mockRejectedValueOnce(new NotFoundException());
        await expect(service.create("session", command)).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.create).not.toHaveBeenCalled();
        timing.read.mockRejectedValue(new ForbiddenException());
        await expect(service.create("session", command)).rejects.toBeInstanceOf(ForbiddenException);
    });
});

describe("note context list isolation and compatibility", () => {
    it("normalizes named Home to existing omitted-code context before persistence", async () => {
        identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [...profile.permissions, { code: "mercadeo.home.read", scope: "assigned", effect: "allow" }] });
        await service.create("session", { moduleCode: "mercadeo", operationId: "operation_00000001", text: "Home", context: { kind: "view", code: "marketing-home" } });
        expect(repo.create).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ context: { kind: "view" } }), { kind: "view" });
    });
    it("keeps personal listing separate and never invokes order reads", async () => {
        await service.list("session", { moduleCode: "mercadeo", contextType: "personal" });
        expect(repo.list).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), { kind: "personal" }, expect.any(Array), []);
        expect(timing.read).not.toHaveBeenCalled();
    });
    it("redacts persisted linked view without its read permission", async () => {
        repo.context.mockResolvedValue({ kind: "view", code: "marketing-leads" });
        expect((await service.read("session", id, { moduleCode: "mercadeo" })).note.context).toBeNull();
    });
});

describe("Home context read gates", () => {
    it.each([{ kind: "view" }, { kind: "view", code: "marketing-home" }])("rejects Home linking when its permission is absent or denied: %j", async (context) => {
        const command = { moduleCode: "mercadeo", operationId: "operation_00000001", text: "Home", context };
        for (const permissions of [profile.permissions, [...profile.permissions, { code: "mercadeo.home.read", scope: "assigned", effect: "allow" }, { code: "mercadeo.home.read", scope: "assigned", effect: "deny" }]]) {
            identity.getCurrentUser.mockResolvedValue({ ...profile, permissions });
            await expect(service.create("session", command)).rejects.toBeInstanceOf(ForbiddenException);
        }
        expect(repo.create).not.toHaveBeenCalled();
    });
    it("redacts inaccessible Home while permitting personal notes", async () => {
        identity.getCurrentUser.mockResolvedValue(profile);
        repo.context.mockResolvedValue({ kind: "view" });
        expect((await service.read("session", id, { moduleCode: "mercadeo" })).note.context).toBeNull();
        await service.create("session", { moduleCode: "mercadeo", operationId: "operation_00000001", text: "Personal", context: { kind: "personal" } });
        expect(repo.create).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), { kind: "personal" });
    });
});

it("owner retains by-id read and history with another module read capability but no origin writes or listings", async () => {
    identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: profile.permissions.map((p) => ({ ...p, code: p.code.replace("mercadeo", "ventas") })) });
    repo.history.mockResolvedValue([]);
    expect((await service.read("session", id, { moduleCode: "mercadeo" })).note).toMatchObject({ context: null, capabilities: { canEdit: false } });
    expect((await service.history("session", id, { moduleCode: "mercadeo" })).items).toEqual([]);
    await expect(service.edit("session", id, { moduleCode: "mercadeo", operationId: "operation_00000001", expectedVersion: 1, text: "Changed" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list("session", { moduleCode: "mercadeo" })).rejects.toBeInstanceOf(ForbiddenException);
});

it("by-id cross-module read keeps origin deny and repository invitation ACL authoritative", async () => {
    const read = { code: "ventas.notes.read", effect: "allow", scope: "self" };
    identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [read, { code: "mercadeo.notes.read", effect: "deny", scope: null }] });
    await expect(service.read("session", id, { moduleCode: "mercadeo" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.find).not.toHaveBeenCalled();
    identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [read] });
    repo.find.mockRejectedValue(new NotFoundException());
    await expect(service.read("session", id, { moduleCode: "mercadeo" })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.history).not.toHaveBeenCalled();
});

describe("sales order notes across workspaces", () => {
    it("returns an invited note from its origin module on the same authorized order", async () => {
        repo.list.mockResolvedValue({ items: [{ ...note, moduleCode: "formalizacion", authorPublicId: "other", visibility: "shared" }], total: 1 });
        timing.read.mockResolvedValue({ order: { source: "legacy", id: "legacy:208" } });
        const result = await service.list("session", { moduleCode: "mercadeo", contextType: "sales_order", recordSource: "legacy", recordId: "208" });
        expect(result.items[0]).toMatchObject({ moduleCode: "formalizacion", capabilities: { canEdit: false, canMove: true } });
        expect(repo.list).toHaveBeenCalledWith(expect.anything(), expect.anything(), { kind: "sales_order", source: "legacy", id: "208" }, expect.arrayContaining(["formalizacion", "mercadeo"]), [{ kind: "sales_order", source: "legacy", id: "208" }]);
    });
    it("never queries record notes when the independent order permission is denied", async () => {
        timing.read.mockRejectedValue(new ForbiddenException());
        await expect(service.list("session", { moduleCode: "mercadeo", contextType: "sales_order", recordSource: "legacy", recordId: "208" })).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.list).not.toHaveBeenCalled();
    });
});

it("allows an invited cross-module reader to save only their personal placement", async () => {
    repo.find.mockResolvedValue({ ...note, moduleCode: "formalizacion", authorPublicId: "other", visibility: "shared" });
    repo.context.mockResolvedValue({ kind: "personal" });
    await service.move("session", id, { moduleCode: "formalizacion", operationId: "operation_00000002", expectedLayoutVersion: 0, x: 0, y: 0, width: 280, height: 200 });
    expect(repo.move).toHaveBeenCalledWith(expect.objectContaining({ actorPublicId: "actor", moduleCode: "formalizacion" }), id, expect.any(Object));
    expect(repo.edit).not.toHaveBeenCalled();
});
