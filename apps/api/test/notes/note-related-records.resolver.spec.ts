import { ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IdentityAuthorizationProfile } from "../../src/modules/crm/identity/identity.types.js";
import { relatedRecordsSchema, relatedReferenceSchema } from "../../src/modules/crm/notes/note-related-records.contract.js";
import type { NoteRelatedRecordsReader, RelatedResourceRow } from "../../src/modules/crm/notes/note-related-records.reader.js";
import { NoteRelatedRecordsResolver } from "../../src/modules/crm/notes/note-related-records.resolver.js";

const native = { kind: "lead" as const, source: "native" as const, id: "01K00000000000000000000000" };
const legacy = { kind: "lead" as const, source: "legacy" as const, id: "208" };
const row: RelatedResourceRow = { reference: native, aliases: [native, legacy], label: "Cliente", description: "Proyecto", active: true, ownerId: "actor", hasOrder: false };
function profile(code = "lead.read", scope = "self"): IdentityAuthorizationProfile {
    return { user: { publicId: "actor", displayName: "Actor", email: "actor@example.test", status: "active", permissionVersion: 1, profileImageUrl: null }, roles: [], orgUnits: [], permissions: [{ code, scope, effect: "allow", source: "role" }] };
}
const reader = { readNative: vi.fn(), readLegacy: vi.fn(), legacyOrderClients: vi.fn(), searchNative: vi.fn(), searchLegacy: vi.fn(), legacyEnabled: vi.fn() };
const resolver = new NoteRelatedRecordsResolver(reader as unknown as NoteRelatedRecordsReader);
beforeEach(() => {
    vi.resetAllMocks();
    reader.readNative.mockResolvedValue([row]);
    reader.readLegacy.mockResolvedValue([]);
    reader.legacyOrderClients.mockResolvedValue([]);
    reader.legacyEnabled.mockReturnValue(true);
    reader.searchNative.mockResolvedValue({ rows: [row], total: 1 });
    reader.searchLegacy.mockResolvedValue({ rows: [], total: 0 });
});
describe("related resource identity and privacy", () => {
    it("validates source-qualified IDs without confusing provider references", () => {
        expect(relatedReferenceSchema.safeParse({ ...native, id: "208" }).success).toBe(false);
        expect(relatedReferenceSchema.safeParse({ ...legacy, id: "000208" }).success).toBe(false);
        expect(relatedRecordsSchema.safeParse([legacy, legacy]).success).toBe(false);
    });
    it("prefers the confirmed native alias without touching legacy", async () => {
        const result = await resolver.resolve(profile(), legacy);
        expect(result.summary.reference).toEqual(native);
        expect(result.aliases).toEqual([native, legacy]);
        expect(reader.readLegacy).not.toHaveBeenCalled();
    });
    it("does not fall back when native lookup fails", async () => {
        reader.readNative.mockRejectedValue(new Error("native unavailable"));
        await expect(resolver.resolve(profile(), legacy)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(reader.readLegacy).not.toHaveBeenCalled();
    });
    it("does not revive inactive native aliases from legacy", async () => {
        reader.readNative.mockResolvedValue([{ ...row, active: false }]);
        await expect(resolver.resolve(profile(), legacy)).rejects.toBeInstanceOf(NotFoundException);
        expect(reader.readLegacy).not.toHaveBeenCalled();
    });
    it("uses the legacy PK only after native absence", async () => {
        reader.readNative.mockResolvedValue([]);
        reader.readLegacy.mockResolvedValue([{ ...row, reference: legacy, aliases: [legacy] }]);
        expect((await resolver.resolve(profile(), legacy)).summary.reference).toEqual(legacy);
        expect(reader.readLegacy).toHaveBeenCalledWith([legacy]);
    });
    it("redacts IDs, name and URL for a denied reader", async () => {
        const denied = profile();
        denied.permissions.push({ code: "lead.read", scope: null, effect: "deny", source: "override" });
        expect(await resolver.resolveMany(denied, [legacy])).toEqual([{ kind: "lead", label: null, description: null, url: null, restricted: true }]);
    });
    it("does not authorize a seller through another seller's lead", async () => {
        reader.readNative.mockResolvedValue([{ ...row, ownerId: "other" }]);
        await expect(resolver.resolve(profile(), native)).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("does not convert an aggregate Marketing grant into individual access", async () => {
        await expect(resolver.resolve(profile("mercadeo.leads.read", "all_areas"), native)).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("allows an unequivocal order's client through the existing Formalization read policy", async () => {
        const actor = profile("formalizacion.orders.read");
        actor.roles = [{ code: "formalizacion", name: "Formalización", status: "active" }];
        reader.readNative.mockResolvedValue([{ ...row, ownerId: "other", hasOrder: true }]);
        expect((await resolver.resolve(actor, native)).summary.label).toBe("Cliente");
        actor.permissions.push({ code: "lead.read", scope: null, effect: "deny", source: "override" });
        await expect(resolver.resolve(actor, native)).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("uses a confirmed legacy order relationship without replacing the authoritative native client", async () => {
        const actor = profile("formalizacion.orders.read");
        actor.roles = [{ code: "formalizacion", name: "Formalización", status: "active" }];
        reader.readNative.mockResolvedValue([{ ...row, ownerId: "other", hasOrder: false }]);
        reader.legacyOrderClients.mockResolvedValue([legacy.id]);
        expect((await resolver.resolve(actor, legacy)).summary.reference).toEqual(native);
        expect(reader.readLegacy).not.toHaveBeenCalled();
    });
    it("resolves a whole page in batches rather than one SQL lookup per chip", async () => {
        expect(await resolver.resolveMany(profile(), [native, legacy, native])).toHaveLength(3);
        expect(reader.readNative).toHaveBeenCalledTimes(1);
        expect(reader.readLegacy).not.toHaveBeenCalled();
    });
    it("marks temporary failure distinctly from a missing resource", async () => {
        reader.readNative.mockRejectedValue(new Error("offline"));
        expect(await resolver.resolveMany(profile(), [native])).toEqual([{ kind: "lead", label: null, description: null, url: null, restricted: true, unavailable: true }]);
    });
    it("keeps source-qualified equal integers separate unless an explicit alias proves equality", async () => {
        const order = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        reader.readNative.mockResolvedValue([]);
        reader.readLegacy.mockResolvedValue([{ ...row, reference: legacy, aliases: [legacy] }]);
        expect((await resolver.resolve(profile(), legacy)).aliases).not.toContainEqual(order);
    });
    it("returns explicit partial results when only optional legacy search fails", async () => {
        const actor = profile();
        actor.permissions.push({ code: "ventas.notes.read", effect: "allow", scope: "self", source: "role" });
        reader.searchLegacy.mockRejectedValue(new Error("legacy offline"));
        const result = await resolver.search(actor, "ventas", "lead", "Cliente", 1);
        expect(result.partial).toBe(true);
        expect(result.items[0]?.reference).toEqual(native);
    });
    it("does not disguise conflicting source identities as partial availability", async () => {
        const actor = profile();
        actor.permissions.push({ code: "ventas.notes.read", effect: "allow", scope: "self", source: "role" });
        reader.searchLegacy.mockRejectedValue(new ConflictException("ambiguous alias"));
        await expect(resolver.search(actor, "ventas", "lead", "Cliente", 1)).rejects.toBeInstanceOf(ConflictException);
    });
    it("does not call legacy search after native search failure", async () => {
        const actor = profile();
        actor.permissions.push({ code: "ventas.notes.read", effect: "allow", scope: "self", source: "role" });
        reader.searchNative.mockRejectedValue(new Error("native offline"));
        await expect(resolver.search(actor, "ventas", "lead", "Cliente", 1)).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(reader.searchLegacy).not.toHaveBeenCalled();
    });
    it("defends search presentation even if a reader returns an unauthorized row", async () => {
        const actor = profile();
        actor.permissions.push({ code: "ventas.notes.read", effect: "allow", scope: "self", source: "role" });
        reader.searchNative.mockResolvedValue({ rows: [{ ...row, ownerId: "other" }], total: 1 });
        await expect(resolver.search(actor, "ventas", "lead", "Cliente", 1)).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("does not require or warn about an intentionally disabled legacy deployment", async () => {
        const actor = profile();
        actor.permissions.push({ code: "ventas.notes.read", effect: "allow", scope: "self", source: "role" });
        reader.legacyEnabled.mockReturnValue(false);
        const result = await resolver.search(actor, "ventas", "lead", "Cliente", 1);
        expect(result.partial).toBe(false);
        expect(reader.searchLegacy).not.toHaveBeenCalled();
    });
});
