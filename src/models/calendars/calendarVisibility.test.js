const test = require("node:test");
const assert = require("node:assert/strict");

const {
    ACTIVE_DEDUPED_ADMINS_SUBQUERY,
    EVENT_DIRECTOR_ADMIN_IDS,
    EVENT_SUPERVISOR_ADMIN_IDS,
    buildCalendarVisibilityScope,
    isDirectorEventAdmin,
    isSupervisorEventAdmin,
    normalizeIntegerValue,
} = require("./calendarVisibility");

test("normalizeIntegerValue devuelve fallback cuando el valor no es numérico", () => {
    assert.equal(normalizeIntegerValue(undefined, 99), 99);
    assert.equal(normalizeIntegerValue("abc", 7), 7);
});

test("ACTIVE_DEDUPED_ADMINS_SUBQUERY filtra admins activos y deduplica por idnetsuite_admin", () => {
    assert.match(ACTIVE_DEDUPED_ADMINS_SUBQUERY, /WHERE status_admin = 1/);
    assert.match(ACTIVE_DEDUPED_ADMINS_SUBQUERY, /GROUP BY idnetsuite_admin/);
});

test("isDirectorEventAdmin reconoce a Claudio y Roberto como directores", () => {
    assert.equal(isDirectorEventAdmin(252150), true);
    assert.equal(isDirectorEventAdmin(653055), true);
    assert.equal(isDirectorEventAdmin(2146844), false);
});

test("isSupervisorEventAdmin reconoce a Fabián como supervisor", () => {
    assert.equal(isSupervisorEventAdmin(2146844), true);
    assert.equal(isSupervisorEventAdmin(252150), false);
});

test("buildCalendarVisibilityScope para director devuelve alcance total de admins activos", () => {
    const visibilityScope = buildCalendarVisibilityScope(653055);

    assert.deepEqual(visibilityScope.params, []);
    assert.match(visibilityScope.cteSql, /WITH active_admin_scope AS/);
    assert.equal(
        visibilityScope.predicateSql("calendar_rows.id_admin"),
        "calendar_rows.id_admin IN (SELECT idnetsuite_admin FROM active_admin_scope)",
    );
});

test("buildCalendarVisibilityScope para supervisor excluye directores y deja asesores activos", () => {
    const visibilityScope = buildCalendarVisibilityScope(2146844);
    const predicateSql = visibilityScope.predicateSql("calendar_rows.id_admin");

    assert.deepEqual(visibilityScope.params, []);
    assert.match(predicateSql, /NOT IN/);

    for (const directorId of EVENT_DIRECTOR_ADMIN_IDS) {
        assert.match(predicateSql, new RegExp(`${directorId}`));
    }
});

test("buildCalendarVisibilityScope para asesor restringe a su propio id", () => {
    const visibilityScope = buildCalendarVisibilityScope(252461);

    assert.deepEqual(visibilityScope.params, [252461]);
    assert.match(visibilityScope.predicateSql("calendar_rows.id_admin"), /WHERE idnetsuite_admin = \?/);
});

test("constantes de negocio contienen solo los ids pactados", () => {
    assert.deepEqual(EVENT_DIRECTOR_ADMIN_IDS, [252150, 653055]);
    assert.deepEqual(EVENT_SUPERVISOR_ADMIN_IDS, [2146844]);
});
