import "reflect-metadata";

import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { NetsuiteLocalEventsController } from "../../src/integrations/netsuite/netsuite-local-events.controller.js";
import { EVENT_PROVIDERS, loadAmd, logMock, READY, recordMock, runtimeMock, searchMock } from "./netsuite-suitescript/amd-harness.mjs";

// Diagnostic audit: expected failures remain visible without modifying runtime.
// IDs and long memo values are synthetic contract probes, not observed account data.
// This does not establish Oracle's field limits or that this account permits a 16001-character memo.
// Concurrent invalidation probes expose documented non-atomicity, not a promised version/CAS contract.

/** NetSuite APIs and persistence are simulated here; mapping, DTO validation and receipt handling are real. */
function dispatch({ id = "214", memo = "audit", lineCount = 0, itemText } = {}) {
    const controller = new NetsuiteLocalEventsController({ receive: (payload) => ({ schemaVersion: 2, received: true, persisted: true, netsuiteId: payload.event.netsuiteId, eventId: payload.event.eventId }) });
    const rejected = [];
    const record = recordMock({ fields: { memo }, lineCount });
    if (itemText !== undefined) record.rec.getSublistText.mockImplementation(({ fieldId }) => (fieldId === "item" ? itemText : null));
    const log = logMock();
    const https = {
        createSecureString: ({ input }) => input,
        post: vi.fn(({ body }) => {
            try {
                return { code: 200, body: JSON.stringify(controller.receive(JSON.parse(body))) };
            } catch (error) {
                if (!(error instanceof BadRequestException)) throw error;
                rejected.push(error.getStatus());
                return { code: error.getStatus(), body: "" };
            }
        }),
    };
    const entry = loadAmd("SS2_1_UE_CRM_Habita.js", { ...EVENT_PROVIDERS, "N/runtime": runtimeMock(), "N/record": record, "N/search": searchMock(), "N/log": log, "N/https": https });
    entry.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id } });
    expect(record.submitFields).not.toHaveBeenCalled();
    return { https, rejected, log };
}

describe("SuiteScript adversarial producer/consumer contract audit (offline)", () => {
    it.each([
        [400, "invalid_payload"],
        [401, "authentication_rejected"],
        [403, "access_rejected"],
        [503, "receiver_unavailable"],
    ])("logs safe HTTP diagnostics for %i without exposing the response body", (code, reason) => {
        const log = logMock();
        const https = { createSecureString: ({ input }) => input, post: vi.fn(() => ({ code, body: "PRIVATE_RESPONSE_TOKEN" })) };
        const entry = loadAmd("SS2_1_UE_CRM_Habita.js", { ...EVENT_PROVIDERS, "N/runtime": runtimeMock(), "N/record": recordMock(), "N/search": searchMock(), "N/log": log, "N/https": https });
        entry.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: "214" } });
        expect(log.error.mock.calls[0][0].details).toMatchObject({ status: "receiver_rejected", delivered: false, httpStatus: code, failureReason: reason });
        expect(JSON.stringify(log.error.mock.calls)).not.toContain("PRIVATE_RESPONSE_TOKEN");
    });
    it.each(["1", "214", "999999999999999"])("every emitted ID satisfies the real receiver: %s", (id) => {
        const { https, rejected, log } = dispatch({ id });
        expect(https.post).toHaveBeenCalledOnce();
        expect(JSON.parse(https.post.mock.calls[0][0].body).event.netsuiteId).toBe(id);
        expect(rejected, "An emitted ID must satisfy the receiver's ID contract").toEqual([]);
        expect(log.debug.mock.calls[0][0].details).toMatchObject({ delivered: true, status: "received_local" });
    });

    // A2: emisor y receptor comparten el limite de 15 digitos; un ID mayor nunca se emite.
    it.each(["1000000000000000", "9007199254740991"])("IDs above the receiver's 15-digit limit are never emitted: %s", (id) => {
        const { https, rejected } = dispatch({ id });
        expect(https.post).not.toHaveBeenCalled();
        expect(rejected).toEqual([]);
    });

    it.each([16000])("an emitted scalar at the receiver's limit is accepted: %i characters", (length) => {
        const { https, rejected, log } = dispatch({ memo: "a".repeat(length) });
        expect(https.post).toHaveBeenCalledOnce();
        const body = https.post.mock.calls[0][0].body;
        expect(Buffer.byteLength(body, "utf8")).toBeLessThan(500000);
        expect(JSON.parse(body).snapshot.data.fields.memo).toHaveLength(length);
        // Total-body validation alone does not establish compatibility with scalar constraints.
        expect(rejected, "An emitted scalar must satisfy the receiver's length contract").toEqual([]);
        expect(log.debug.mock.calls[0][0].details.delivered).toBe(true);
    });

    // A3: un texto que el receptor rechazaria no se envia ni se trunca; se informa con un estado propio.
    it("a scalar above the receiver's 16000-character limit is not sent and not truncated", () => {
        const { https, rejected, log } = dispatch({ memo: "a".repeat(16001) });
        expect(https.post).not.toHaveBeenCalled();
        expect(rejected).toEqual([]);
        expect(log.error.mock.calls[0][0].details).toMatchObject({ status: "value_too_long", delivered: false });
    });

    it("preserves a multibyte scalar at the receiver's exact UTF-16 length boundary", () => {
        const memo = "😀".repeat(8000);
        const { https, rejected } = dispatch({ memo });
        expect(rejected).toEqual([]);
        expect(https.post).toHaveBeenCalledOnce();
        expect(JSON.parse(https.post.mock.calls[0][0].body).snapshot.data.fields.memo).toBe(memo);
    });

    it("blocks a real 1000-line snapshot above the byte budget before posting", () => {
        // Each scalar is within the receiver's limit; aggregate payload size is the only violation.
        const { https, log } = dispatch({ lineCount: 1000, itemText: "a".repeat(1000) });
        expect(https.post).not.toHaveBeenCalled();
        expect(log.error.mock.calls[0][0].details).toMatchObject({ status: "payload_too_large", delivered: false });
    });

    it("contains a native script-parameter failure inside the transport's never-throw contract", () => {
        const runtime = runtimeMock();
        runtime.getCurrentScript.mockImplementation(() => {
            throw new Error("SCRIPT_PARAMETER_UNAVAILABLE");
        });
        const https = { createSecureString: vi.fn(), post: vi.fn() };
        const readSnapshot = vi.fn();
        const { delivery } = loadAmd("SS2_1_LIB_CRM_habita.js", { ...EVENT_PROVIDERS, "N/runtime": runtime, "N/https": https });
        const { sendRecordEvent } = delivery;
        expect(() => sendRecordEvent({ recordType: "salesorder", netsuiteId: "214", eventType: "edit" }, readSnapshot, "order-events")).not.toThrow();
        expect(readSnapshot).not.toHaveBeenCalled();
        expect(https.post).not.toHaveBeenCalled();
    });

    it("contains an environment-gate exception inside afterSubmit's never-throw contract", () => {
        const runtime = runtimeMock();
        // Fault injection, not a claim that NetSuite normally exposes a throwing getter.
        Object.defineProperty(runtime, "envType", {
            get() {
                throw new Error("ENVIRONMENT_UNAVAILABLE");
            },
        });
        const record = recordMock();
        const https = { createSecureString: vi.fn(), post: vi.fn() };
        const entry = loadAmd("SS2_1_UE_CRM_Habita.js", { ...EVENT_PROVIDERS, "N/runtime": runtime, "N/record": record, "N/search": searchMock(), "N/log": logMock(), "N/https": https });
        expect(() => entry.afterSubmit({ type: "edit", newRecord: { type: "salesorder", id: "214" } })).not.toThrow();
        expect(record.load).not.toHaveBeenCalled();
        expect(https.post).not.toHaveBeenCalled();
    });

    // A1: NetSuite no ofrece escritura condicional, asi que no hay atomicidad; la relectura completa detecta el
    // cambio de otro escritor y la aprobacion no se confirma como exito.
    it.each([
        ["custbody43", true],
        ["custbody_aprueba_jefe_ventas", false],
        ["custbodyid_firma_rocca", false],
    ])("does not confirm business approval after concurrent invalidation of %s", (field, value) => {
        const current = { ...READY };
        const search = searchMock({}, ({ columns }) => Object.fromEntries(columns.map((column) => [column, current[column]])));
        const record = recordMock();
        const workflow = {
            initiate: vi.fn(() => {
                // Models another writer between initial validation and post-write confirmation.
                current[field] = value;
                current.custbodyid_firma_rc = true;
            }),
        };
        const handlers = loadAmd("SS2_1_RL_CRM_Habita.js", { "N/runtime": runtimeMock(), "N/record": record, "N/search": search, "N/log": logMock(), "N/workflow": workflow });
        const response = handlers.put({ module: "salesOrders", action: "approveFormalization", id: "214" });
        expect(workflow.initiate).toHaveBeenCalledOnce();
        expect(record.submitFields).not.toHaveBeenCalled();
        expect(search.lookupFields).toHaveBeenCalledTimes(2);
        // Reproduces the documented non-atomicity; no version/CAS guarantee is assumed from NetSuite.
        expect(response).toMatchObject({ status: 409, error: { code: "APPROVAL_STATE_CHANGED" } });
    });
});
