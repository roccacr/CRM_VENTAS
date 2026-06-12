const assert = require("node:assert/strict");
const test = require("node:test");

const {
    normalizeComparableId,
    validateCrmCalendarOwnership,
} = require("./outlookEventOwnership");

test("normalizeComparableId retorna null con valores inválidos", () => {
    assert.equal(normalizeComparableId(undefined), null);
    assert.equal(normalizeComparableId("abc"), null);
    assert.equal(normalizeComparableId(0), null);
});

test("validateCrmCalendarOwnership permite update cuando dueño coincide", () => {
    const result = validateCrmCalendarOwnership(
        {
            id_calendar: 5201,
            id_admin: 653055,
            name_admin: "Roberto Carlos Zúñiga Altamirano",
            email_admin: "rzuniga@roccacr.com",
        },
        653055,
    );

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 200);
});

test("validateCrmCalendarOwnership bloquea update cuando dueño no coincide", () => {
    const result = validateCrmCalendarOwnership(
        {
            id_calendar: 5201,
            id_admin: 653055,
            name_admin: "Roberto Carlos Zúñiga Altamirano",
            email_admin: "rzuniga@roccacr.com",
        },
        123456,
    );

    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 403);
    assert.equal(result.code, "EVENT_OWNER_MISMATCH");
    assert.match(result.message, /pertenece a Roberto Carlos Zúñiga Altamirano/);
});

test("validateCrmCalendarOwnership responde not found cuando no existe evento", () => {
    const result = validateCrmCalendarOwnership(null, 653055);

    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 404);
    assert.equal(result.code, "EVENT_NOT_FOUND");
});
