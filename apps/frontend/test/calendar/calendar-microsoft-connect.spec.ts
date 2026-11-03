import { afterEach, expect, it, vi } from "vitest";

import { getIdentitySession } from "../../src/services/auth/auth-service";
import { waitForMicrosoftPopupSession } from "../../src/services/auth/microsoft-popup-login";
vi.mock("../../src/services/auth/auth-service", () => ({ getIdentitySession: vi.fn() }));
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
it("does not mistake the existing CRM session for completed calendar consent", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const popup = { closed: false, location: { origin: "https://login.microsoftonline.com", search: "" }, close } as unknown as Window;
    vi.mocked(getIdentitySession).mockResolvedValue({ authenticated: true, session: { publicId: "old" }, user: { publicId: "same-user" } } as never);
    let finished = false;
    const completion = waitForMicrosoftPopupSession(popup, "old").then(() => {
        finished = true;
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(finished).toBe(false);
    expect(close).not.toHaveBeenCalled();
    vi.mocked(getIdentitySession).mockResolvedValue({ authenticated: true, session: { publicId: "new" }, user: { publicId: "same-user" } } as never);
    await vi.advanceTimersByTimeAsync(750);
    await completion;
    expect(finished).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
});
