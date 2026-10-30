import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getNoteNotifications, getNoteUnreadCount, markAllNoteNotificationsRead, markNoteNotificationRead } from "../../src/services/notes/note-notifications-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
});
it.each([{ count: -1 }, { count: 1.5 }, { count: "1" }, { count: 1, countIsLowerBound: "true" }, null])("rejects malformed counts instead of showing a fabricated zero", async (value) => {
    vi.mocked(apiRequest).mockResolvedValue(value);
    await expect(getNoteUnreadCount()).rejects.toThrow("Invalid note notifications response");
});
it("retains an explicitly false lower-bound flag", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ count: 3, countIsLowerBound: false });
    await expect(getNoteUnreadCount()).resolves.toEqual({ count: 3, countIsLowerBound: false });
});
it("requests the chosen notification filter/page without marking anything read", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 2, size: 25, total: 0 }, unreadCount: 0, observedAt: "2026-10-27T11:00:00.000Z" });
    await getNoteNotifications("mentions", 2);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/notifications?filter=mentions&page=2&pageSize=25");
});
it("rejects invalid IDs and date cutoffs before issuing a write", async () => {
    await expect(markNoteNotificationRead("99")).rejects.toThrow();
    await expect(markAllNoteNotificationsRead("2026-10-27")).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
});
it("propagates read command errors without automatic replay", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("network failed"));
    await expect(markAllNoteNotificationsRead("2026-10-27T11:00:00.000Z")).rejects.toThrow("network failed");
    expect(apiRequest).toHaveBeenCalledTimes(1);
});
