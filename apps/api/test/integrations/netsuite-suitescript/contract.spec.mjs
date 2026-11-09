// Prueba de contrato emisor <-> receptor: el JSON que SuiteScript envia lo valida el controlador REAL de NestJS
// y el emisor valida el contrato del acuse. El servicio de persistencia es un doble sin BD en esta suite;
// la persistencia real y el rollback se verifican aparte en netsuite-order-events.local-sql.spec.ts.
import "reflect-metadata";

import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { NetsuiteLocalEventsController } from "../../../src/integrations/netsuite/netsuite-local-events.controller.js";
import { EVENT_PROVIDERS, loadAmd, logMock, recordMock, runtimeMock, searchMock } from "./amd-harness.mjs";

const ORDER_FIELDS = { tranid: "OV-214", total: 123456789.001, custbody90: true, custbody43: false, memo: "Nota" };
const ORDER_TEXTS = { trandate: "28/10/2026", entity: "Cliente", subsidiary: "Subsidiaria" };

/** Ejecuta el User Event real; el POST lo atiende el controlador real de NestJS. */
function runUserEvent({ lineCount = 2, eventType = "edit", id = 214, tamper } = {}) {
    const controller = new NetsuiteLocalEventsController({ receive: (payload) => ({ schemaVersion: 2, received: true, persisted: true, netsuiteId: payload.event.netsuiteId, eventId: payload.event.eventId }) });
    const received = [];
    const rejected = [];
    const record = recordMock({ fields: ORDER_FIELDS, texts: ORDER_TEXTS, lineCount });
    const log = logMock();
    const https = {
        createSecureString: ({ input }) => input,
        post: vi.fn(({ body }) => {
            const payload = tamper ? tamper(JSON.parse(body)) : JSON.parse(body);
            try {
                const receipt = controller.receive(payload);
                received.push(payload);
                return { code: 200, body: JSON.stringify(receipt) };
            } catch (error) {
                rejected.push(error);
                return { code: error instanceof BadRequestException ? 400 : 500, body: "" };
            }
        }),
    };
    const entry = loadAmd("SS2_1_UE_CRM_Habita.js", { ...EVENT_PROVIDERS, "N/runtime": runtimeMock(), "N/record": { load: record.load, submitFields: record.submitFields }, "N/search": searchMock(ORDER_FIELDS), "N/log": log, "N/https": https });
    entry.afterSubmit({ type: eventType, newRecord: { type: "salesorder", id } });
    return { received, rejected, log, https };
}

describe("emisor SuiteScript <-> receptor NestJS", () => {
    it("the receiver accepts the real payload and the emitter accepts the real receipt end to end", () => {
        const { received, rejected, log } = runUserEvent();
        expect(rejected).toEqual([]);
        expect(received).toHaveLength(1);
        expect(log.debug.mock.calls[0][0].details).toMatchObject({ status: "received_local", delivered: true });
        expect(log.error).not.toHaveBeenCalled();
    });
    it.each(["create", "edit", "xedit", "approve", "cancel", "reject"])("the %s event is accepted by the receiver", (eventType) => {
        const { rejected, log } = runUserEvent({ eventType });
        expect(rejected).toEqual([]);
        expect(log.debug.mock.calls[0][0].details.delivered).toBe(true);
    });
    it.each([0, 1, 250, 1000])("an order with %i item lines is accepted (lines travel as an array)", (lineCount) => {
        const { received, rejected } = runUserEvent({ lineCount });
        expect(rejected).toEqual([]);
        expect(received[0].snapshot.data.sublists.item).toHaveLength(lineCount);
    });
    it("a 15-digit NetSuite ID, the receiver maximum, is accepted", () => {
        const { rejected } = runUserEvent({ id: 999999999999999 });
        expect(rejected).toEqual([]);
    });
    it("the receiver really rejects the previous line-keyed shape (the contract check can fail)", () => {
        const { rejected, log } = runUserEvent({
            tamper: (payload) => {
                payload.snapshot.data.sublists.item = { "line 1": {}, "line 2": {} };
                return payload;
            },
        });
        expect(rejected).toHaveLength(1);
        expect(log.error.mock.calls[0][0].details).toMatchObject({ status: "receiver_rejected", delivered: false });
    });
    it("the receiver rejects an extra snapshot key, so the emitter must not add one", () => {
        const { received, rejected } = runUserEvent({
            tamper: (payload) => {
                payload.snapshot.extra = "x";
                return payload;
            },
        });
        expect(received).toEqual([]);
        expect(rejected).toHaveLength(1);
    });
    it("the real payload carries exactly the keys the strict receiver schema allows", () => {
        const { received } = runUserEvent();
        expect(Object.keys(received[0]).sort()).toEqual(["event", "schemaVersion", "snapshot", "source"]);
        expect(Object.keys(received[0].event).sort()).toEqual(["eventId", "eventType", "netsuiteId", "observedAt", "recordType", "snapshotReadCompletedAt", "snapshotReadStartedAt", "sourceModifiedAt"]);
        expect(Object.keys(received[0].snapshot.data).sort()).toEqual(["fields", "id", "sublists", "type"]);
    });
});
