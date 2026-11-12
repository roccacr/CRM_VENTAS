import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import fc from "fast-check";
import { expect, it, vi } from "vitest";

function restlet(accountId: string, envType: string, overrides: Record<string, unknown> = {}, persist = true) {
    const flags: Record<string, unknown> = { custbody43: false, custbody_aprueba_jefe_ventas: true, custbodyid_firma_rocca: true, custbodyid_firma_rc: false, ...overrides };
    const workflow = {
        trigger: vi.fn(() => 789),
        initiate: vi.fn(() => {
            if (persist) flags.custbodyid_firma_rc = true;
            return 456;
        }),
    };
    const record = {
        submitFields: vi.fn(() => {
            if (persist) flags.custbodyid_firma_rc = true;
        }),
    };
    const search = { lookupFields: vi.fn(() => ({ ...flags })) };
    const runtime = { accountId, envType, EnvType: { PRODUCTION: "PRODUCTION", SANDBOX: "SANDBOX" }, getCurrentScript: () => ({ getParameter: () => (envType === "SANDBOX" ? "4552704_SB1" : "4552704") }) };
    const logger = { debug: vi.fn(), error: vi.fn() };
    let library: unknown;
    runInNewContext(readFileSync(new URL("../../src/integrations/netsuite/suitescript/SS2_1_LIB_CRM_habita.js", import.meta.url), "utf8"), {
        define: (_deps: string[], factory: (...args: unknown[]) => unknown) => {
            library = factory(runtime, {}, {}, logger, record, search, {}, workflow);
        },
    });
    let handlers: { put(request: unknown): unknown } | undefined;
    runInNewContext(readFileSync(new URL("../../src/integrations/netsuite/suitescript/SS2_1_RL_CRM_Habita.js", import.meta.url), "utf8"), {
        define: (_deps: string[], factory: (dependency: unknown) => typeof handlers) => {
            handlers = factory(library);
        },
    });
    if (!handlers) throw new Error("RESTlet no cargado");
    return { handlers, record, search, workflow, logger };
}

const request = { module: "salesOrders", action: "approveFormalization", id: "123" };
it("rejects generated malformed unit-transfer identifiers before reading or triggering", () => {
    fc.assert(
        fc.property(
            fc.string().filter((id) => !/^[1-9][0-9]*$/.test(id)),
            (id) => {
                const f = restlet("4552704_SB1", "SANDBOX", { custbodyid_firma_rc: true, custbody91: true });
                expect(f.handlers.put({ ...request, action: "transferUnit", id })).toMatchObject({ status: 400 });
                expect(f.search.lookupFields).not.toHaveBeenCalled();
                expect(f.workflow.trigger).not.toHaveBeenCalled();
            },
        ),
        { numRuns: 50, seed: 2202780 },
    );
});
it("runs only the requested unit-transfer workflow and returns its instance", () => {
    const f = restlet("4552704_SB1", "SANDBOX", { custbodyid_firma_rc: true, custbody91: true });
    expect(f.handlers.put({ ...request, action: "transferUnit" })).toMatchObject({ status: 200, data: { id: "123", action: "transferUnit", workflowId: "customworkflow220", stateId: "workflowstate2780", executed: true, instanceId: "789" } });
    expect(f.workflow.trigger).toHaveBeenCalledExactlyOnceWith({ recordType: "salesorder", recordId: "123", workflowId: "customworkflow220", stateId: "workflowstate2780" });
    expect(f.workflow.initiate).not.toHaveBeenCalled();
    expect(f.record.submitFields).not.toHaveBeenCalled();
});
it.each([false, true, null, undefined])("runs the requested unit-transfer action without requiring prior physical delivery (%s)", (delivery) => {
    const f = restlet("4552704_SB1", "SANDBOX", { custbodyid_firma_rc: true, custbody91: delivery });
    expect(f.handlers.put({ ...request, action: "transferUnit" })).toMatchObject({ status: 200 });
    expect(f.workflow.trigger).toHaveBeenCalledOnce();
});
it.each([{ custbody43: true }, { custbody43: null }, { custbodyid_firma_rc: false }, { custbodyid_firma_rc: null }])("rejects invalid transfer prerequisites before workflow execution: %j", (flags) => {
    const f = restlet("4552704_SB1", "SANDBOX", { custbodyid_firma_rc: true, ...flags });
    expect(f.handlers.put({ ...request, action: "transferUnit" })).toMatchObject({ status: 409 });
    expect(f.workflow.trigger).not.toHaveBeenCalled();
});
it("does not confirm or retry a failed unit-transfer workflow", () => {
    const f = restlet("4552704_SB1", "SANDBOX", { custbodyid_firma_rc: true, custbody91: true });
    f.workflow.trigger.mockImplementation(() => {
        throw new Error("PRIVATE_DETAIL");
    });
    const result = f.handlers.put({ ...request, action: "transferUnit" });
    expect(result).toMatchObject({ status: 502, error: { code: "UNIT_TRANSFER_OUTCOME_UNKNOWN" } });
    expect(f.workflow.trigger).toHaveBeenCalledOnce();
    expect(f.workflow.initiate).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("PRIVATE_DETAIL");
});
it.each(["initiate", "verify"])("records a safe diagnostic for %s failures without leaking the exception", (phase) => {
    const { handlers, workflow, search, logger, record } = restlet("4552704", "PRODUCTION");
    const error = Object.assign(new Error("PRIVATE_PROVIDER_DETAIL"), { name: "SSS_INVALID_WORKFLOW_ID" });
    if (phase === "initiate")
        workflow.initiate.mockImplementation(() => {
            throw error;
        });
    else
        search.lookupFields
            .mockImplementationOnce(() => ({ custbody43: false, custbody_aprueba_jefe_ventas: true, custbodyid_firma_rocca: true, custbodyid_firma_rc: false }))
            .mockImplementationOnce(() => {
                throw error;
            });
    expect(handlers.put(request)).toMatchObject({ status: 502, error: { code: "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN" } });
    const details: unknown = expect.objectContaining({ phase, providerCode: "SSS_INVALID_WORKFLOW_ID", netsuiteId: "123", workflowId: "customworkflow219" });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ title: "CRM: diagnostico aprobacion workflow", details }));
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("PRIVATE_PROVIDER_DETAIL");
    expect(record.submitFields).not.toHaveBeenCalled();
    expect(workflow.initiate).toHaveBeenCalledOnce();
});
it.each([
    ["4552704", "PRODUCTION"],
    ["4552704_SB1", "SANDBOX"],
])("triggers the corporate workflow and confirms its approval in %s", (account, environment) => {
    const { handlers, record, search, workflow } = restlet(account, environment);
    expect(handlers.put(request)).toEqual({ status: 200, data: { type: "salesorder", id: "123", approval: "formalization", approved: true, alreadyApproved: false } });
    expect(workflow.initiate).toHaveBeenCalledExactlyOnceWith({ recordType: "salesorder", recordId: "123", workflowId: "customworkflow219" });
    expect(record.submitFields).not.toHaveBeenCalled();
    expect(search.lookupFields).toHaveBeenCalledTimes(2);
    expect(handlers.put(request)).toMatchObject({ status: 200, data: { alreadyApproved: true } });
    expect(workflow.initiate).toHaveBeenCalledOnce();
});
it.each([{ custbody43: true }, { custbody_aprueba_jefe_ventas: false }, { custbodyid_firma_rocca: false }])("does not write when business requirements fail: %j", (flags) => {
    const { handlers, record, workflow } = restlet("4552704", "PRODUCTION", flags);
    expect(handlers.put(request)).toMatchObject({ status: 409 });
    expect(record.submitFields).not.toHaveBeenCalled();
    expect(workflow.initiate).not.toHaveBeenCalled();
});
it("does not fall back to a direct write when the workflow fails", () => {
    const { handlers, record, workflow } = restlet("4552704", "PRODUCTION");
    workflow.initiate.mockImplementation(() => {
        throw new Error("private workflow failure");
    });
    const result = handlers.put(request);
    expect(result).toMatchObject({ status: 502, error: { code: "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN" } });
    expect(JSON.stringify(result)).not.toContain("private workflow failure");
    expect(workflow.initiate).toHaveBeenCalledOnce();
    expect(record.submitFields).not.toHaveBeenCalled();
});
it("does not trigger another workflow when the approval already exists", () => {
    const { handlers, record, workflow } = restlet("4552704", "PRODUCTION", { custbodyid_firma_rc: true });
    expect(handlers.put(request)).toMatchObject({ status: 200, data: { alreadyApproved: true } });
    expect(workflow.initiate).not.toHaveBeenCalled();
    expect(record.submitFields).not.toHaveBeenCalled();
});
it("does not report success if the checkbox was not persisted", () => {
    const { handlers } = restlet("4552704", "PRODUCTION", {}, false);
    expect(handlers.put(request)).toMatchObject({ status: 502, error: { code: "FORMALIZATION_APPROVAL_UNCONFIRMED" } });
});
it("rejects a different account before looking up or writing an order", () => {
    const { handlers, record, search } = restlet("9999999", "PRODUCTION");
    expect(handlers.put(request)).toMatchObject({ status: 403 });
    expect(record.submitFields).not.toHaveBeenCalled();
    expect(search.lookupFields).not.toHaveBeenCalled();
});
