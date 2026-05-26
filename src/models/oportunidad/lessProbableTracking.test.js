const test = require("node:test");
const assert = require("node:assert/strict");

const {
    INACTIVATION_REASON_COLUMN,
    LESS_PROBABLE_TRACKING_COLUMN,
    buildExpiredLessProbableSelectionQuery,
    buildInactivateOpportunitiesByIdsQuery,
    buildUpdateOpportunityProbabilityParams,
    buildUpdateOpportunityProbabilityQuery,
    buildUpdateOpportunityStatusParams,
    buildUpdateOpportunityStatusQuery,
} = require("./lessProbableTracking");

test("buildUpdateOpportunityProbabilityQuery incluye tracking cuando columna existe", () => {
    const query = buildUpdateOpportunityProbabilityQuery(true);

    assert.match(query, new RegExp(LESS_PROBABLE_TRACKING_COLUMN));
    assert.match(query, /CASE/);
    assert.match(query, /CONVERT_TZ/);
});

test("buildUpdateOpportunityProbabilityQuery conserva update simple cuando columna no existe", () => {
    const query = buildUpdateOpportunityProbabilityQuery(false);

    assert.doesNotMatch(query, new RegExp(LESS_PROBABLE_TRACKING_COLUMN));
    assert.equal(
        query,
        "UPDATE oportunidades SET chek_oport = ?, chek2_oport = ? WHERE id_oportunidad_oport = ?",
    );
});

test("buildUpdateOpportunityProbabilityParams agrega parámetro extra para tracking", () => {
    assert.deepEqual(buildUpdateOpportunityProbabilityParams(0, 55, true), [0, 1, 0, 55]);
    assert.deepEqual(buildUpdateOpportunityProbabilityParams(1, 55, false), [1, 1, 55]);
});

test("buildExpiredLessProbableSelectionQuery filtra por 3 meses y columna dedicada", () => {
    const query = buildExpiredLessProbableSelectionQuery(3);

    assert.match(query, new RegExp(LESS_PROBABLE_TRACKING_COLUMN));
    assert.match(query, /INTERVAL 3 MONTH/);
    assert.match(query, /chek_oport = 0/);
    assert.match(query, /estatus_oport = 1/);
});

test("buildInactivateOpportunitiesByIdsQuery genera placeholders por cada id", () => {
    const { query, params } = buildInactivateOpportunitiesByIdsQuery([10, 20, 30]);

    assert.equal(params.length, 4);
    assert.match(query, /IN \(\?, \?, \?\)/);
    assert.match(query, new RegExp(INACTIVATION_REASON_COLUMN));
    assert.deepEqual(params, ["MENOS_PROBABLE_3_MESES", 10, 20, 30]);
});

test("buildUpdateOpportunityStatusQuery guarda motivo cuando columna existe", () => {
    const query = buildUpdateOpportunityStatusQuery(true);

    assert.match(query, new RegExp(INACTIVATION_REASON_COLUMN));
    assert.match(query, /CASE/);
});

test("buildUpdateOpportunityStatusParams limpia motivo al reactivar", () => {
    assert.deepEqual(buildUpdateOpportunityStatusParams(0, 77, true, "MANUAL"), [0, 0, "MANUAL", 77]);
    assert.deepEqual(buildUpdateOpportunityStatusParams(1, 77, false, "MANUAL"), [1, 77]);
});
