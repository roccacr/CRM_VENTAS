import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { retryNoteDeadlock } from "../../src/modules/crm/notes/notes-transaction.js";

describe("native note transaction deadlock retry", () => {
    it("retries guaranteed rollbacks with the identical command payload and operation id", async () => {
        const input = { operationId: "operation_00000001", dueAt: "2026-10-30T00:00:00Z" };
        const write = vi
            .fn<(command: typeof input) => Promise<{ replayed: boolean }>>()
            .mockRejectedValueOnce(Object.assign(new Error("deadlock"), { code: "ER_LOCK_DEADLOCK" }))
            .mockRejectedValueOnce({ cause: { errno: 1213 } })
            .mockResolvedValue({ replayed: false });
        expect(await retryNoteDeadlock(() => write(input))).toEqual({ replayed: false });
        expect(write.mock.calls).toEqual([[input], [input], [input]]);
    });
    it("stops after three deadlock victims and preserves the original error", async () => {
        const error = { errno: 1213 },
            run = vi.fn().mockRejectedValue(error);
        await expect(retryNoteDeadlock(run)).rejects.toBe(error);
        expect(run).toHaveBeenCalledTimes(3);
    });
    it.each([{ code: "ER_LOCK_WAIT_TIMEOUT", errno: 1205 }, { code: "ECONNRESET" }, new ConflictException(), new Error("unknown outcome"), { cause: { cause: { cause: { errno: 1213 } } } }])("never retries timeouts, uncertain outcomes, conflicts or unbounded causes", async (error) => {
        const run = vi.fn().mockRejectedValue(error);
        await expect(retryNoteDeadlock(run)).rejects.toBe(error);
        expect(run).toHaveBeenCalledOnce();
    });
});
