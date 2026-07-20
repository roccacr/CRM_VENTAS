const assert = require("node:assert/strict");
const test = require("node:test");

const {
    buildPreReserveEstimatesListQuery,
} = require("./ordenVenta");

test("la consulta de pre-reserva usa estimaciones como tabla base", () => {
    const { query, params } = buildPreReserveEstimatesListQuery({
        rol_admin: "1",
        idnetsuite_admin: "3646210",
    });

    assert.match(query, /FROM estimaciones AS e/);
    assert.match(query, /LEFT JOIN ordenventa AS o/);
    assert.match(query, /e\.pre_reserva = 1/);
    assert.match(query, /COALESCE\(e\.pre_caida, 0\) = 0/);
    assert.match(query, /NOT EXISTS \(\s*SELECT 1\s*FROM ordenventa AS ov_any/s);
    assert.match(query, /EXISTS \(\s*SELECT 1\s*FROM ordenventa AS ov_pre/s);
    assert.match(query, /COALESCE\(ov_pre\.reserva_ov, 0\) = 0/);
    assert.doesNotMatch(query, /o\.reserva_ov = 0\s+AND/);
    assert.deepEqual(params, []);
});

test("la consulta de pre-reserva filtra por asesor cuando no es admin", () => {
    const { query, params } = buildPreReserveEstimatesListQuery({
        rol_admin: "2",
        idnetsuite_admin: "3646210",
    });

    assert.match(query, /e\.idAdmin_est = \?/);
    assert.deepEqual(params, ["3646210"]);
});
