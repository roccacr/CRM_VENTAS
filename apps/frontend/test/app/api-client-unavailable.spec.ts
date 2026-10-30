import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

it("recovers one temporary unavailable read without renewing the session", async () => {
    const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 503 }))
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("../../src/services/api/api-client");
    expect(await apiRequest("/notifications/unread-count")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith("/notifications/unread-count"))).toBe(true);
});

it("bounds unavailable reads to two attempts", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", { status: 503 })));
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("../../src/services/api/api-client");
    await expect(apiRequest("/notes")).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("never automatically replays an uncertain reply write", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.endsWith("/identity/session") ? new Response('{"csrfToken":"synthetic-proof"}', { headers: { "Content-Type": "application/json" } }) : new Response("{}", { status: 503 })));
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("../../src/services/api/api-client");
    await expect(apiRequest("/note-collaboration/notes/note/replies", { method: "POST", body: { text: "synthetic", operationId: "stable-operation-key" } })).rejects.toMatchObject({ status: 503 });
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/replies"))).toHaveLength(1);
});

it("does not carry a pending read retry across logout", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.endsWith("/notes") ? new Response("{}", { status: 503 }) : new Response('{"csrfToken":"synthetic-proof","ok":true}', { headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);
    const { apiRequest } = await import("../../src/services/api/api-client");
    const read = apiRequest("/notes");
    const assertion = expect(read).rejects.toMatchObject({ status: 503 });
    await apiRequest("/identity/logout", { method: "POST" });
    await assertion;
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/notes"))).toHaveLength(1);
});
