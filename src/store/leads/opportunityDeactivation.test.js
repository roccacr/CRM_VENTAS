import assert from "node:assert/strict";
import test from "node:test";

import { deactivateLeadOpportunities } from "./opportunityDeactivationCore.js";

test("deactivateLeadOpportunities returns backend response when request succeeds", async () => {
    const response = { ok: true, statusCode: 200 };
    const requestInactivation = async (leadId) => ({ ...response, leadId });

    const result = await deactivateLeadOpportunities(requestInactivation, 12345);

    assert.equal(result.ok, true);
    assert.equal(result.leadId, 12345);
});

test("deactivateLeadOpportunities throws backend error message when request fails", async () => {
    const requestInactivation = async () => ({ ok: false, errorMessage: "fallo controlado" });

    await assert.rejects(
        () => deactivateLeadOpportunities(requestInactivation, 12345),
        /fallo controlado/,
    );
});

test("deactivateLeadOpportunities throws default error message when backend omits details", async () => {
    const requestInactivation = async () => ({ ok: false });

    await assert.rejects(
        () => deactivateLeadOpportunities(requestInactivation, 12345),
        /No se pudieron inactivar las oportunidades del lead/,
    );
});
