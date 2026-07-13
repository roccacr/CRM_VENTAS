const assert = require("node:assert/strict");
const test = require("node:test");

const connectionPoolPath = require.resolve("../conectionPool/conectionPool");
const outlookEventPath = require.resolve("./outlookEvent");

const loadOutlookEventWithExecuteQuery = (executeQueryMock) => {
    delete require.cache[outlookEventPath];
    require.cache[connectionPoolPath] = {
        id: connectionPoolPath,
        filename: connectionPoolPath,
        loaded: true,
        exports: {
            executeQuery: executeQueryMock,
        },
    };

    return require("./outlookEvent");
};

test("deleteOutlookEvent bloquea la cancelación cuando el evento pertenece a otro asesor", async () => {
    const executeQueryCalls = [];
    const outlookEvent = loadOutlookEventWithExecuteQuery(async (query, params) => {
        executeQueryCalls.push({ query, params });

        return {
            ok: true,
            data: [{
                id_calendar: 991,
                id_admin: 653055,
                outlook_event_id: "AAMkAG-test",
                name_admin: "Roberto Carlos Zúñiga Altamirano",
                email_admin: "rzuniga@roccacr.com",
            }],
        };
    });

    const result = await outlookEvent.deleteOutlookEvent({
        id_calendar: 991,
        idnetsuite_admin: 252461,
        database: "produccion",
    });

    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 403);
    assert.equal(result.data.code, "EVENT_OWNER_MISMATCH");
    assert.equal(executeQueryCalls.length, 1);
});

test("deleteOutlookEvent marca el evento como cancelado cuando el dueño coincide", async () => {
    const executeQueryCalls = [];
    const outlookEvent = loadOutlookEventWithExecuteQuery(async (query, params) => {
        executeQueryCalls.push({ query, params });

        if (executeQueryCalls.length === 1) {
            return {
                ok: true,
                data: [{
                    id_calendar: 991,
                    id_admin: 653055,
                    outlook_event_id: "AAMkAG-test",
                    name_admin: "Roberto Carlos Zúñiga Altamirano",
                    email_admin: "rzuniga@roccacr.com",
                }],
            };
        }

        return {
            ok: true,
            data: {
                affectedRows: 1,
            },
        };
    });

    const result = await outlookEvent.deleteOutlookEvent({
        id_calendar: 991,
        idnetsuite_admin: 653055,
        database: "produccion",
    });

    assert.equal(result.ok, true);
    assert.equal(executeQueryCalls.length, 2);
    assert.match(executeQueryCalls[1].query, /accion_calendar = 'Cancelado'/);
    assert.deepEqual(executeQueryCalls[1].params, [991]);
});
