import { expect, it, vi } from "vitest";

import { backfillReservationBatch } from "../../src/integrations/netsuite/netsuite-reservation-backfill.js";

it("procesa secuencialmente, deduplica y deja evidencia por orden", async () => {
    const synchronize = vi.fn().mockResolvedValueOnce("applied").mockResolvedValueOnce("unchanged");
    const record = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn().mockResolvedValue(undefined);
    expect(await backfillReservationBatch(["1", "1", "2"], { synchronize, record, pause })).toEqual([
        { id: "1", result: "updated", attempts: 1 },
        { id: "2", result: "omitted", attempts: 1 },
    ]);
    expect(synchronize.mock.calls).toEqual([["1"], ["2"]]);
    expect(record).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(1000);
});

it("reintenta un fallo transitorio y continúa después de un fallo definitivo", async () => {
    const synchronize = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce("applied").mockRejectedValueOnce(new Error("upstream")).mockRejectedValueOnce(new Error("upstream")).mockRejectedValueOnce(new Error("upstream")).mockResolvedValueOnce("unchanged");
    const result = await backfillReservationBatch(["1", "2", "3"], { synchronize, record: vi.fn().mockResolvedValue(undefined), pause: vi.fn().mockResolvedValue(undefined) });
    expect(result).toEqual([
        { id: "1", result: "updated", attempts: 2 },
        { id: "2", result: "failed", attempts: 3, reason: "sync_failed" },
        { id: "3", result: "omitted", attempts: 1 },
    ]);
});

it("un lote inválido no consulta ni escribe", async () => {
    const dependencies = { synchronize: vi.fn(), record: vi.fn(), pause: vi.fn() };
    const invalid = await backfillReservationBatch(["1 OR 1=1"], dependencies);
    expect(invalid).toMatchObject([{ result: "omitted", attempts: 0, reason: "invalid_id" }]);
    await expect(
        backfillReservationBatch(
            Array.from({ length: 51 }, () => "1"),
            dependencies,
        ),
    ).rejects.toThrow();
    expect(dependencies.synchronize).not.toHaveBeenCalled();
});

it("si falla el diario se detiene para no perder evidencia", async () => {
    const synchronize = vi.fn().mockResolvedValue("applied");
    await expect(backfillReservationBatch(["1", "2"], { synchronize, record: vi.fn().mockRejectedValue(new Error("disk")), pause: vi.fn().mockResolvedValue(undefined) })).rejects.toThrow("disk");
    expect(synchronize).toHaveBeenCalledTimes(1);
});
