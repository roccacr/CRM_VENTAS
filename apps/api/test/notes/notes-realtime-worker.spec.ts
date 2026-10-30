import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import type { NotesRealtimeGateway } from "../../src/modules/crm/notes/notes-realtime.gateway.js";
import type { NotesRealtimeEventsRepository } from "../../src/modules/crm/notes/notes-realtime.repository.js";
import { NotesRealtimeSignal } from "../../src/modules/crm/notes/notes-realtime.signal.js";
import { NotesRealtimeWorker } from "../../src/modules/crm/notes/notes-realtime.worker.js";
const event = { id: 1, attempt: 1, recipientUserId: "01K00000000000000000000001", activity: { schemaVersion: 1 as const, eventId: "01K00000000000000000000002", kind: "notifications.changed" as const, occurredAt: new Date().toISOString() } };
function fixture() {
    const repository = { schemaReady: vi.fn().mockResolvedValue(true), claim: vi.fn().mockResolvedValueOnce(event).mockResolvedValue(null), complete: vi.fn().mockResolvedValue(undefined), retry: vi.fn().mockResolvedValue(undefined) };
    const gateway = { publish: vi.fn().mockResolvedValue(undefined) };
    const signal = new NotesRealtimeSignal();
    const worker = new NotesRealtimeWorker(repository as unknown as NotesRealtimeEventsRepository, gateway as unknown as NotesRealtimeGateway, signal, new ConfigService({ NOTES_REALTIME_ENABLED: true }));
    return { repository, gateway, signal, worker };
}
describe("realtime fenced dispatcher", () => {
    it("publishes stable envelope before acknowledging its lease", async () => {
        const f = fixture();
        await f.worker.tick();
        expect(f.gateway.publish).toHaveBeenCalledWith(event.recipientUserId, event.activity);
        expect(f.repository.complete).toHaveBeenCalledWith(event);
        expect(f.gateway.publish.mock.invocationCallOrder[0]).toBeLessThan(f.repository.complete.mock.invocationCallOrder[0] ?? 0);
    });
    it("retains failures as retryable durable work without false completion", async () => {
        const f = fixture();
        f.gateway.publish.mockRejectedValueOnce(new Error("Synthetic network failure"));
        await f.worker.tick();
        expect(f.repository.retry).toHaveBeenCalledWith(event);
        expect(f.repository.complete).not.toHaveBeenCalled();
    });
    it("respects migration gate and shutdown even when explicitly woken", async () => {
        const f = fixture();
        f.repository.schemaReady.mockResolvedValue(false);
        await f.worker.tick();
        expect(f.repository.claim).not.toHaveBeenCalled();
        f.worker.onModuleDestroy();
        await f.worker.tick();
        expect(f.repository.schemaReady).toHaveBeenCalledTimes(1);
    });
    it("wakes immediately after commit and removes its wake on shutdown", async () => {
        const f = fixture();
        f.worker.onModuleInit();
        f.signal.notify();
        await vi.waitFor(() => {
            expect(f.repository.complete).toHaveBeenCalledWith(event);
        });
        f.worker.onModuleDestroy();
        const calls = f.repository.schemaReady.mock.calls.length;
        f.signal.notify();
        expect(f.repository.schemaReady).toHaveBeenCalledTimes(calls);
    });
    it("isolates a failing wake so committed service commands stay successful", () => {
        const signal = new NotesRealtimeSignal();
        const later = vi.fn();
        signal.subscribe(() => {
            throw new Error("Synthetic wake failure");
        });
        signal.subscribe(later);
        expect(() => {
            signal.notify();
        }).not.toThrow();
        expect(later).toHaveBeenCalledOnce();
    });
});
