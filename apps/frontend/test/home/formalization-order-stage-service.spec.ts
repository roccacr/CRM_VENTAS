import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { type StageCommand, updateOrderStage } from "../../src/services/formalization/order-stage-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const command: StageCommand = { source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", expectedSequence: 0, operationId: "operation", targetState: "closed" };
beforeEach(() => vi.mocked(apiRequest).mockReset());
it("preserves native ID and strips noncanonical response fields", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "native", id: command.id, state: "closed", sequence: 1, replayed: false, secret: "discard" });
    const result = await updateOrderStage(command);
    expect(result).toEqual({ source: "native", id: command.id, state: "closed", sequence: 1, replayed: false });
    expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/stage", { method: "POST", body: command, retryOnUnauthorized: false });
});
it.each([null, { source: "provider", id: "1", state: "closed", sequence: 1, replayed: false }, { source: "native", id: "1", state: "bank_management", sequence: 1, replayed: false }, { source: "native", id: "1", state: "closed", sequence: -1, replayed: false }])("rejects malformed success response %j", async (result) => {
    vi.mocked(apiRequest).mockResolvedValue(result);
    await expect(updateOrderStage(command)).rejects.toThrow("Invalid order stage response");
});
