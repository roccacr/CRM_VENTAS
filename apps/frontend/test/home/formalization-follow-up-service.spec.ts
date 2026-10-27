import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getFollowUp } from "../../src/services/formalization/follow-up-service";
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
