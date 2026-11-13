import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getFollowUp, getFollowUpSelection, getFormalizationOrderRecord } from "../../src/services/formalization/follow-up-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const filters = { search: "", projectId: "", queue: "all" as const, page: 1, pageSize: 25 };
const payload = () => ({
    schemaVersion: 1,
    observedAt: "2026-10-26T12:00:00Z",
    filters: { search: "", projectId: "", queue: "all" },
    page: { number: 1, size: 25, total: 1, totalPages: 1 },
    counts: { all: 1, approvals: 0, contracts: 1, send: 1, signature: 0, bank: 0, balance: 0, transfer: 0, signed: 0, closed: 0 },
    projects: [{ id: "legacy-project:12", name: "Proyecto" }],
    items: [{ id: "native:1", source: "native", number: "OV-1", nativeCode: "code", client: null, project: null, unit: null, responsible: null, state: { code: "pending", label: "Por enviar", since: null, days: null }, nextStep: "Adjuntar contrato", completedThisYear: false }],
    sources: { native: { total: 1 }, legacy: { total: 0, enabled: true } },
});
beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});
it("rejects malformed follow-up JSON rather than returning zero counts", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1 });
    await expect(getFollowUp(filters)).rejects.toThrow();
});

it("selects a fully loaded list immediately without reading it again", async () => {
    vi.mocked(apiRequest).mockResolvedValue(payload());
    const current = await getFollowUp(filters);
    vi.mocked(apiRequest).mockClear();
    expect(await getFollowUpSelection(current, new AbortController().signal, vi.fn())).toEqual(current.items);
    expect(apiRequest).not.toHaveBeenCalled();
});

it("selects 449 filtered orders with progress and serial requests to respect the SQL time limit", async () => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, page: { ...data.page, total: 449, totalPages: 18 } });
    const current = await getFollowUp({ ...filters, projectIds: ["project:1"] });
    let active = 0;
    let maximum = 0;
    const seen: number[] = [];
    vi.mocked(apiRequest).mockImplementation(async (path) => {
        active += 1;
        maximum = Math.max(maximum, active);
        const page = Number(new URL(path, "https://example.test").searchParams.get("page"));
        seen.push(page);
        await Promise.resolve();
        active -= 1;
        const offset = (page - 1) * 100;
        return { ...data, page: { number: page, size: 100, total: 449, totalPages: 5 }, items: Array.from({ length: Math.min(100, 449 - offset) }, (_, index) => ({ ...data.items[0], id: String(offset + index + 1) })) };
    });
    const progress = vi.fn();
    const selected = await getFollowUpSelection(current, new AbortController().signal, progress);
    expect(selected).toHaveLength(449);
    expect(new Set(selected.map((entry) => entry.id)).size).toBe(449);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    expect(maximum).toBe(1);
    expect(progress).toHaveBeenLastCalledWith(449, 449);
});
it("encodes opaque IDs and server filters without sorting native-first results locally", async () => {
    vi.stubEnv("DEV", false);
    vi.mocked(apiRequest).mockResolvedValue(payload());
    const result = await getFollowUp({ ...filters, search: "OV & 1", projectId: "legacy-project:12", queue: "send", page: 2 });
    expect(apiRequest).toHaveBeenCalledWith("/formalization/home/follow-up?search=OV+%26+1&projectId=legacy-project%3A12&queue=send&page=2&pageSize=25");
    expect(result.items[0]?.number).toBe("OV-1");
});
it.each([
    (data: ReturnType<typeof payload>) => {
        data.counts.all = -1;
    },
    (data: ReturnType<typeof payload>) => {
        data.page.size = 101;
    },
    (data: ReturnType<typeof payload>) => {
        data.observedAt = "yesterday";
    },
    (data: ReturnType<typeof payload>) => {
        data.filters.queue = "unknown";
    },
    (data: ReturnType<typeof payload>) => {
        for (const item of data.items) item.source = "provider";
    },
    (data: ReturnType<typeof payload>) => {
        for (const item of data.items) item.completedThisYear = "true" as unknown as boolean;
    },
])("rejects malformed nested contract fields %#", async (mutate) => {
    const data = payload();
    mutate(data);
    vi.mocked(apiRequest).mockResolvedValue(data);
    await expect(getFollowUp(filters)).rejects.toThrow("Invalid formalization follow-up");
});
it("logs canonical JSON only in DEV and drops unexpected provider/contact fields", async () => {
    vi.stubEnv("DEV", true);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(apiRequest).mockResolvedValue({ ...payload(), credentials: "secret", email: "private", items: payload().items.map((item) => ({ ...item, phone: "private", rawProvider: { secret: true } })) });
    const result = await getFollowUp(filters);
    expect(log).toHaveBeenCalledWith("[Formalization API: home/follow-up]", JSON.stringify({ ...result, items: result.items.map(({ clientEmail: _clientEmail, ...item }) => item) }));
    expect(JSON.stringify(result)).not.toMatch(/private|secret|rawProvider|credentials/);
    vi.stubEnv("DEV", false);
    log.mockClear();
    await getFollowUp(filters);
    expect(log).not.toHaveBeenCalled();
});
it.each([0, 101])("rejects invalid page size %s before requesting", async (pageSize) => {
    await expect(getFollowUp({ ...filters, pageSize })).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
});
it.each(["seller", "changedBy"] as const)("validates and strips extra fields from %s", async (field) => {
    vi.stubEnv("DEV", true);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, [field]: { id: null, name: "Persona", token: "secret" } })) });
    const result = await getFollowUp(filters);
    expect(result.items[0]).toHaveProperty(field, { id: null, name: "Persona" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
});
it.each(["seller", "changedBy"] as const)("accepts null %s and older fixtures", async (field) => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, [field]: null })) });
    expect((await getFollowUp(filters)).items[0]).toHaveProperty(field, null);
    vi.mocked(apiRequest).mockResolvedValue(payload());
    await expect(getFollowUp(filters)).resolves.toBeDefined();
});
it.each(["seller", "changedBy"] as const)("rejects malformed %s without logging raw data", async (field) => {
    vi.stubEnv("DEV", true);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    for (const person of [{ id: 7, name: "secret" }, { id: null }, [], "secret"]) {
        const data = payload();
        vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, [field]: person })) });
        await expect(getFollowUp(filters)).rejects.toThrow("Invalid formalization follow-up");
    }
    expect(log).not.toHaveBeenCalled();
});
it("preserves stage edit eligibility and rejects malformed optional metadata", async () => {
    const data = payload();
    vi.stubEnv("DEV", false);
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((entry) => ({ ...entry, approvalsComplete: true, stateVersion: 0 })) });
    expect((await getFollowUp(filters)).items[0]).toMatchObject({ approvalsComplete: true, stateVersion: 0 });
    for (const metadata of [{ approvalsComplete: "true" }, { stateVersion: -1 }, { stateVersion: null }, { stateVersion: 0.5 }]) {
        vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((entry) => ({ ...entry, ...metadata })) });
        await expect(getFollowUp(filters)).rejects.toThrow("Invalid formalization follow-up");
    }
});

it("keeps the explicit client email in the contract but removes it from DEV logs", async () => {
    vi.stubEnv("DEV", true);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, clientEmail: "cliente@example.com" })) });
    const result = await getFollowUp(filters);
    expect(result.items[0]?.clientEmail).toBe("cliente@example.com");
    expect(JSON.stringify(log.mock.calls)).not.toContain("cliente@example.com");
});

it.each([true, false])("preserves contractSigned from the canonical response (%s)", async (contractSigned) => {
    vi.stubEnv("DEV", false);
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, contractSigned })) });
    expect((await getFollowUp(filters)).items[0]?.contractSigned).toBe(contractSigned);
});
it("rejects a nonboolean contract signature instead of enabling banking", async () => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, contractSigned: "yes" })) });
    await expect(getFollowUp(filters)).rejects.toThrow();
});

it.each([
    ["legacy", "208"],
    ["native", "01ARZ3NDEKTSV4RRFFQ69G5FAV"],
] as const)("reads a direct validated %s projection without list metadata", async (source, id) => {
    const data = { ...payload().items[0], source, id: source === "legacy" ? "legacy:" + id : id, secret: "excluded" };
    vi.mocked(apiRequest).mockResolvedValue(data);
    const result = await getFormalizationOrderRecord(source, id);
    expect(apiRequest).toHaveBeenCalledWith(`/formalization/orders/${source}/${id}/record`);
    expect(result).not.toHaveProperty("secret");
});
it("rejects malformed record identity and projection", async () => {
    await expect(getFormalizationOrderRecord("legacy", "legacy:208")).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
    vi.mocked(apiRequest).mockResolvedValue({ id: "208" });
    await expect(getFormalizationOrderRecord("legacy", "208")).rejects.toThrow();
});

it.each(["own_funds", "bank_financing", null])("retains the canonical purchase funds origin %s", async (purchaseFundsOrigin) => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, counts: { ...data.counts, bankInProgress: 2 }, items: data.items.map((item) => ({ ...item, purchaseFundsOrigin })) });
    const result = await getFollowUp(filters);
    expect(result.items[0]?.purchaseFundsOrigin).toBe(purchaseFundsOrigin);
    expect(result.counts.bankInProgress).toBe(2);
});
it("rejects an unknown funds origin instead of choosing a route", async () => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, purchaseFundsOrigin: "unknown" })) });
    await expect(getFollowUp(filters)).rejects.toThrow("Invalid formalization follow-up");
});

it.each([true, false, null, undefined])("preserves paid installments evidence %s in canonical follow-up", async (installmentsFullyPaid) => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, installmentsFullyPaid })) });
    expect((await getFollowUp(filters)).items[0]?.installmentsFullyPaid).toBe(installmentsFullyPaid);
});
it.each(["true", 1, {}])("rejects malformed paid installments evidence %s", async (installmentsFullyPaid) => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, installmentsFullyPaid })) });
    await expect(getFollowUp(filters)).rejects.toThrow("Invalid formalization follow-up");
});

it.each(["unitTransferred", "keysDelivered", "unitDelivered"] as const)("strictly preserves optional nullable %s", async (field) => {
    for (const value of [true, false, null, undefined]) {
        const data = payload();
        vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, [field]: value })) });
        expect((await getFollowUp(filters)).items[0]?.[field]).toBe(value);
    }
});
it.each(["unitTransferred", "keysDelivered", "unitDelivered"])("rejects malformed %s", async (field) => {
    for (const value of ["true", 1, {}, "false"]) {
        const data = payload();
        vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, [field]: value })) });
        await expect(getFollowUp(filters)).rejects.toThrow("Invalid formalization follow-up");
    }
});
