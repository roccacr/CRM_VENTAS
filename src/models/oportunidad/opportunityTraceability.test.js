const test = require("node:test");
const assert = require("node:assert/strict");

const {
    formatDurationLabel,
    getActivationReason,
    normalizeActorType,
    normalizeSource,
} = require("./opportunityTraceability");

test("normalizeActorType usa fallback de sistema para valores desconocidos", () => {
    assert.equal(normalizeActorType("usuario"), "USUARIO");
    assert.equal(normalizeActorType("cron"), "CRON");
    assert.equal(normalizeActorType("desconocido"), "SISTEMA");
    assert.equal(normalizeActorType(null), "SISTEMA");
});

test("normalizeSource convierte a mayúsculas y usa fallback", () => {
    assert.equal(normalizeSource("lead_perdido_ui"), "LEAD_PERDIDO_UI");
    assert.equal(normalizeSource(""), "SISTEMA");
});

test("getActivationReason deriva motivo de reactivación por tipo de actor", () => {
    assert.equal(getActivationReason("USUARIO"), "REACTIVACION_MANUAL");
    assert.equal(getActivationReason("CRON"), "REACTIVACION_CRON");
    assert.equal(getActivationReason("SISTEMA"), "REACTIVACION_SISTEMA");
});

test("formatDurationLabel compacta duración de forma legible", () => {
    assert.equal(formatDurationLabel(60), "1m");
    assert.equal(formatDurationLabel(3660), "1h 1m");
    assert.equal(formatDurationLabel(90061), "1d 1h 1m");
    assert.equal(formatDurationLabel(null), "0m");
});
