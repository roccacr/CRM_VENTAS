const test = require("node:test");
const assert = require("node:assert/strict");

const {
    __testables,
} = require("./outlookCalendarSync");

test("normalizeOutlookEventPayload extrae campos editables para CRM", () => {
    const payload = __testables.normalizeOutlookEventPayload({
        id: "event-123",
        subject: "Reunión de prueba",
        bodyPreview: "Detalle corto",
        start: { dateTime: "2026-06-11T10:00:00.0000000" },
        end: { dateTime: "2026-06-11T11:30:00.0000000" },
    });

    assert.deepEqual(payload, {
        outlookEventId: "event-123",
        nombreCalendar: "Reunión de prueba",
        descripcionCalendar: "Detalle corto",
        fechaInicioCalendar: "2026-06-11T10:00",
        fechaFinCalendar: "2026-06-11T11:30",
        horaInicioCalendar: "10:00",
        horaFinalCalendar: "11:30",
    });
});

test("buildClientState genera valor estable por admin y correo", () => {
    const clientState = __testables.buildClientState(653055, "rzuniga@roccacr.com");

    assert.match(clientState, /^crm-sync-653055-/);
});

test("isSubscriptionExpiringSoon detecta suscripción cercana a vencer", () => {
    const expiringSoon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const healthySubscription = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    assert.equal(__testables.isSubscriptionExpiringSoon(expiringSoon), true);
    assert.equal(__testables.isSubscriptionExpiringSoon(healthySubscription), false);
});
