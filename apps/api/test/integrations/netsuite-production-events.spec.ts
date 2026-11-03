import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import { persistedOrderEvent, productionOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";
import { orderFlagMappings } from "../../src/integrations/netsuite/netsuite-order-event.mapper.js";
import { NetsuiteOrderEventService } from "../../src/integrations/netsuite/netsuite-order-event.service.js";
const payload = {
    schemaVersion: 2,
    source: { system: "netsuite", accountId: "4552704", environment: "production" },
    event: { recordType: "salesorder", netsuiteId: "123", eventType: "edit", observedAt: "2026-11-02T20:00:00.000Z", eventId: "11111111-1111-4111-8111-111111111111", sourceModifiedAt: "2026-11-02T20:00:00.000Z" },
    snapshot: { status: 200, data: { type: "salesorder", id: "123", fields: Object.fromEntries(orderFlagMappings.map((mapping) => [mapping.netsuite, false])), sublists: { item: [] } } },
};
const config = { NODE_ENV: "production", FRONTEND_ORIGIN: "https://habita.roccacr.com", NETSUITE_ENVIRONMENT: "production", NETSUITE_PRODUCTION_EVENTS_ENABLED: true, NETSUITE_PRODUCTION_EVENTS_PERSIST: true };
describe("production event isolation", () => {
    it("binds account and environment to separate contracts", () => {
        expect(productionOrderEvent.safeParse(payload).success).toBe(true);
        expect(persistedOrderEvent.safeParse(payload).success).toBe(false);
        expect(productionOrderEvent.safeParse({ ...payload, source: { ...payload.source, accountId: "4552704_SB1" } }).success).toBe(false);
        expect(productionOrderEvent.safeParse({ ...payload, source: { ...payload.source, environment: "sandbox" } }).success).toBe(false);
    });
    it.each([{ NETSUITE_PRODUCTION_EVENTS_ENABLED: false }, { NETSUITE_PRODUCTION_EVENTS_PERSIST: false }, { NODE_ENV: "development" }, { FRONTEND_ORIGIN: "http://localhost:3000" }, { NETSUITE_ENVIRONMENT: "sandbox" }])("blocks direct writes before repository access: %j", async (override) => {
        const repository = { apply: vi.fn(), recordError: vi.fn() };
        const service = new NetsuiteOrderEventService(repository as never, new ConfigService({ ...config, ...override }));
        await expect(service.receive(productionOrderEvent.parse(payload))).rejects.toThrow();
        expect(repository.apply).not.toHaveBeenCalled();
        expect(repository.recordError).not.toHaveBeenCalled();
    });
    it("reuses the durable writer for production", async () => {
        const repository = { apply: vi.fn().mockResolvedValue({ result: "applied", destination: "native", duplicate: false }) };
        const service = new NetsuiteOrderEventService(repository as never, new ConfigService(config));
        expect((await service.receive(productionOrderEvent.parse(payload))).persisted).toBe(true);
        expect(repository.apply).toHaveBeenCalledOnce();
    });
});

it.each([{ NETSUITE_LOCAL_EVENTS_ENABLED: false }, { NETSUITE_LOCAL_EVENTS_PERSIST: false }, { NODE_ENV: "production" }])("blocks direct sandbox writes before repository access: %j", async (override) => {
    const repository = { apply: vi.fn(), recordError: vi.fn() };
    const service = new NetsuiteOrderEventService(repository as never, new ConfigService({ NODE_ENV: "development", NETSUITE_LOCAL_EVENTS_ENABLED: true, NETSUITE_LOCAL_EVENTS_PERSIST: true, ...override }));
    const event = persistedOrderEvent.parse({ ...payload, source: { system: "netsuite", accountId: "4552704_SB1", environment: "sandbox" } });
    await expect(service.receive(event)).rejects.toThrow();
    expect(repository.apply).not.toHaveBeenCalled();
    expect(repository.recordError).not.toHaveBeenCalled();
});
