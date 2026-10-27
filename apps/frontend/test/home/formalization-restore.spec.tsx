import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useRestoredFormalizationOrder } from "../../src/modules/home/useRestoredFormalizationOrder";
import { ApiClientError } from "../../src/services/api/api-client";
import { getFollowUp } from "../../src/services/formalization/follow-up-service";

vi.mock("../../src/services/formalization/follow-up-service", () => ({ getFollowUp: vi.fn() }));
const restore = vi.fn();
function Harness({ enabled = true, refreshVersion = 0 }: { enabled?: boolean; refreshVersion?: number }) {
    const status = useRestoredFormalizationOrder(enabled, restore, { refreshVersion });
    return <output>{status}</output>;
}
beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, "", "/home/formalization?orderSource=legacy&orderId=208");
});
afterEach(cleanup);
it("restores the exact identity from a refreshed URL, without provider identity or pagination scans", async () => {
    const item = { source: "legacy", id: "legacy:208" };
    vi.mocked(getFollowUp).mockResolvedValue({ items: [item] } as never);
    render(<Harness />);
    await waitFor(() => {
        expect(restore).toHaveBeenCalledWith(item);
    });
    expect(getFollowUp).toHaveBeenCalledWith(expect.objectContaining({ recordId: "legacy:208", pageSize: 1 }));
    expect(window.location.search).toBe("?orderSource=legacy&orderId=208");
});
it("does not request without permission", () => {
    render(<Harness enabled={false} />);
    expect(getFollowUp).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("denied");
});
it("removes access when the API rejects authorization", async () => {
    vi.mocked(getFollowUp).mockRejectedValue(new ApiClientError("Denied", 403, null));
    render(<Harness />);
    await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe("denied");
    });
    expect(restore).not.toHaveBeenCalled();
});
it("rejects malformed identities before requesting", () => {
    window.history.replaceState({}, "", "/home/formalization?orderSource=legacy&orderId=bad");
    render(<Harness />);
    expect(getFollowUp).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("missing");
});

it("re-reads the current database stage on a transaction refresh", async () => {
    vi.mocked(getFollowUp).mockResolvedValueOnce({ items: [{ id: "legacy:208", state: { code: "contract_pending_send" } }] } as never);
    const view = render(<Harness />);
    await waitFor(() => {
        expect(restore).toHaveBeenCalledTimes(1);
    });
    vi.mocked(getFollowUp).mockResolvedValueOnce({ items: [{ id: "legacy:208", state: { code: "contract_pending_signature" } }] } as never);
    view.rerender(<Harness refreshVersion={1} />);
    await waitFor(() => {
        expect(restore).toHaveBeenLastCalledWith(expect.objectContaining({ state: { code: "contract_pending_signature" } }));
    });
    expect(getFollowUp).toHaveBeenCalledTimes(2);
});
