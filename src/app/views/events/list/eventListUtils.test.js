import assert from "node:assert/strict";
import test from "node:test";

import {
    filterTodayPendingEvents,
    getEventListRequestRange,
} from "./eventListUtils.js";

test("getEventListRequestRange usa hoy para eventos pendientes aunque existan fechas guardadas", () => {
    assert.deepEqual(
        getEventListRequestRange({
            dataParam: "1",
            defaultStartDate: "2026-06-01",
            defaultEndDate: "2026-06-30",
            todayDate: "2026-07-28",
        }),
        {
            dateStart: "2026-07-28",
            dateEnd: "2026-07-28",
        },
    );
});

test("filterTodayPendingEvents conserva solo pendientes de hoy cuando viene data=1", () => {
    const result = filterTodayPendingEvents(
        [
            { fechaIni_calendar: "2026-07-28T08:00:00", accion_calendar: "Pendiente" },
            { fechaIni_calendar: "2026-07-28T09:00:00", accion_calendar: "Completado" },
            { fechaIni_calendar: "2026-07-29T08:00:00", accion_calendar: "Pendiente" },
        ],
        "1",
        "2026-07-28",
    );

    assert.equal(result.length, 1);
    assert.equal(result[0].accion_calendar, "Pendiente");
});
