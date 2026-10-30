import { expect, it, vi } from "vitest";

import { createNotesRealtime, parseNoteActivity } from "../../src/services/notes/notes-realtime";
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
it("accepts only frozen metadata and rejects private payloads and invalid identities", () => {
    const event = { schemaVersion: 1, eventId: id, kind: "note.changed", occurredAt: "2026-10-28T10:00:00.000Z", noteId: id };
    expect(parseNoteActivity(event)).toEqual(event);
    expect(parseNoteActivity({ ...event, text: "secret" })).toBeNull();
    expect(parseNoteActivity({ ...event, noteId: "208" })).toBeNull();
});
it("prioritizes bell, deduplicates events, coalesces snapshots and cleans all listeners", async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const socket = { connected: false, on: vi.fn((name: string, fn: (...args: unknown[]) => void) => handlers.set(name, fn)), off: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), auth: {} };
    const client = createNotesRealtime(socket);
    const order: string[] = [];
    client.listen("notifications", () => {
        order.push("bell");
    });
    client.listen("snapshot", () => {
        order.push("snapshot");
    });
    const event = { schemaVersion: 1, eventId: id, kind: "notification.created", occurredAt: "2026-10-28T10:00:00.000Z", noteId: id };
    handlers.get("activity")?.(event);
    handlers.get("activity")?.(event);
    await vi.advanceTimersByTimeAsync(150);
    expect(order).toEqual(["bell", "snapshot"]);
    client.dispose();
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(socket.off).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
});

it.each(["forbidden", "access_denied", "revoked"])("revokes explicit %s acknowledgements and cancels timeout work", async (code) => {
    vi.useFakeTimers();
    const socket = { connected: true, on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const realtime = createNotesRealtime(socket);
    const revoked = vi.fn();
    realtime.listen("revoke", revoked);
    realtime.watch(id);
    const subscribe = socket.emit.mock.calls.find((args) => args[0] === "subscribe");
    const ack = subscribe?.[2] as (value: unknown) => void;
    ack({ ok: false, code });
    await Promise.resolve();
    expect(revoked).toHaveBeenCalledWith(expect.objectContaining({ kind: "note.access_revoked", noteId: id }));
    expect(socket.emit).toHaveBeenCalledWith("unsubscribe", { noteId: id });
    realtime.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
});

it.each(["rate_limited", "unavailable"])("retains transient %s rooms and rejoins with bounded backoff", async (code) => {
    vi.useFakeTimers();
    const socket = { connected: true, on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const realtime = createNotesRealtime(socket);
    const revoked = vi.fn(),
        snapshots = vi.fn();
    realtime.listen("revoke", revoked);
    realtime.listen("snapshot", snapshots);
    realtime.watch(id);
    (socket.emit.mock.calls[0]?.[2] as (value: unknown) => void)({ ok: false, code });
    await vi.advanceTimersByTimeAsync(150);
    expect(revoked).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalledWith("unsubscribe", { noteId: id });
    expect(snapshots).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(code === "rate_limited" ? 60000 : 1000);
    const subscriptions = socket.emit.mock.calls.filter((args) => args[0] === "subscribe");
    expect(subscriptions).toHaveLength(2);
    (subscriptions[1]?.[2] as (value: unknown) => void)({ ok: true });
    await vi.advanceTimersByTimeAsync(120000);
    expect(socket.emit.mock.calls.filter((args) => args[0] === "subscribe")).toHaveLength(2);
    realtime.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
});

it("cancels pending rejoin on unwatch and disposal", async () => {
    vi.useFakeTimers();
    const socket = { connected: true, on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const realtime = createNotesRealtime(socket);
    const unwatch = realtime.watch(id);
    (socket.emit.mock.calls[0]?.[2] as (value: unknown) => void)({ ok: false, code: "rate_limited" });
    unwatch();
    await vi.advanceTimersByTimeAsync(120000);
    expect(socket.emit.mock.calls.filter((args) => args[0] === "subscribe")).toHaveLength(1);
    realtime.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
});

it("backs off repeated unavailable acknowledgements and ignores late disposed callbacks", async () => {
    vi.useFakeTimers();
    const socket = { connected: true, on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const realtime = createNotesRealtime(socket);
    realtime.watch(id);
    const acknowledge = (index: number) => socket.emit.mock.calls.filter((args) => args[0] === "subscribe")[index]?.[2] as (value: unknown) => void;
    acknowledge(0)({ ok: false, code: "unavailable" });
    await vi.advanceTimersByTimeAsync(1000);
    acknowledge(1)({ ok: false, code: "unavailable" });
    await vi.advanceTimersByTimeAsync(1999);
    expect(socket.emit.mock.calls.filter((args) => args[0] === "subscribe")).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    const late = acknowledge(2);
    realtime.dispose();
    late({ ok: false, code: "rate_limited" });
    await vi.advanceTimersByTimeAsync(120000);
    expect(socket.emit.mock.calls.filter((args) => args[0] === "subscribe")).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
});
