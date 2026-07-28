const assert = require("node:assert/strict");
const test = require("node:test");

const estimacion = require("./estimacion");

test("la caida de pre-reserva actualiza estado_lead, no una columna status inexistente", () => {
    assert.match(estimacion._private.UPDATE_LEAD_STATUS_AFTER_PRE_RESERVE_LOSS_QUERY, /estado_lead=\?/);
    assert.doesNotMatch(estimacion._private.UPDATE_LEAD_STATUS_AFTER_PRE_RESERVE_LOSS_QUERY, /SET status=\?/);
});
