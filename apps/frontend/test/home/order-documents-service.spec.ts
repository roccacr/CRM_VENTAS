import { afterEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { uploadOrderDocument } from "../../src/services/formalization/order-documents-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
afterEach(() => {
    vi.resetAllMocks();
});
it("fragmenta a320KiB, informa progreso y no repite escrituras", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ ticket: "opaque", chunkSize: 327680 }).mockResolvedValueOnce({ completed: false, auditRecorded: true }).mockResolvedValueOnce({ completed: true, auditRecorded: true });
    const progress = vi.fn();
    const controller = new AbortController();
    expect(await uploadOrderDocument({ source: "legacy", id: "78" }, new File([new Uint8Array(327681)], "a.pdf"), { conflict: "fail", signal: controller.signal, onProgress: progress })).toEqual({ auditRecorded: true });
    expect(apiRequest).toHaveBeenCalledTimes(3);
    expect(vi.mocked(apiRequest).mock.calls[1]?.[1]).toMatchObject({ body: { offset: 0 }, retryOnUnauthorized: false });
    expect(vi.mocked(apiRequest).mock.calls[2]?.[1]).toMatchObject({ body: { offset: 327680 }, retryOnUnauthorized: false });
    expect(progress).toHaveBeenLastCalledWith(100);
});
it("un fragmento fallido no se vuelve a enviar automáticamente", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ ticket: "opaque", chunkSize: 327680 }).mockRejectedValueOnce(new Error("network"));
    await expect(uploadOrderDocument({ source: "legacy", id: "78" }, new File(["abc"], "a.pdf"), { conflict: "fail", signal: new AbortController().signal, onProgress: vi.fn() })).rejects.toThrow();
    expect(apiRequest).toHaveBeenCalledTimes(2);
});

it("abortar detiene los fragmentos pendientes", async () => {
    const controller = new AbortController();
    vi.mocked(apiRequest)
        .mockResolvedValueOnce({ ticket: "opaque", chunkSize: 327680 })
        .mockImplementationOnce(() => {
            controller.abort();
            return Promise.resolve({ completed: false, auditRecorded: true });
        });
    await expect(uploadOrderDocument({ source: "legacy", id: "78" }, new File([new Uint8Array(327681)], "a.pdf"), { conflict: "fail", signal: controller.signal, onProgress: vi.fn() })).rejects.toThrow();
    expect(apiRequest).toHaveBeenCalledTimes(2);
});
