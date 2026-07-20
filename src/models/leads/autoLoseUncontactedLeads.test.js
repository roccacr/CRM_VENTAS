const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";

const {
    CONFIG,
    applyAutomaticLossForExpiredNewLeads,
} = require("./autoLoseUncontactedLeads");

test("pasa leads nuevos vencidos a perdido e inserta bitacora", async () => {
    const calls = [];
    const connection = {
        execute: async (query, params = []) => {
            calls.push({ query, params });

            if (query.includes("SELECT") && query.includes("FOR UPDATE")) {
                return [[{
                    id_lead: 10,
                    idinterno_lead: 6244433,
                    id_empleado_lead: 3646210,
                }]];
            }

            if (query.includes("UPDATE leads")) {
                return [{ affectedRows: 1 }];
            }

            if (query.includes("INSERT INTO bitacoras")) {
                return [{ affectedRows: 1 }];
            }

            throw new Error(`Consulta no esperada: ${query}`);
        },
    };

    const result = await applyAutomaticLossForExpiredNewLeads(connection);

    assert.equal(result.selectedCount, 1);
    assert.equal(result.updatedCount, 1);
    assert.deepEqual(result.leadIds, [6244433]);

    const updateCall = calls.find((call) => call.query.includes("UPDATE leads"));
    assert.ok(updateCall);
    assert.deepEqual(updateCall.params.slice(0, 5), [
        CONFIG.LOST_LEAD_STATUS,
        CONFIG.LOST_LEAD_ACTION,
        CONFIG.LOST_TRACKING,
        CONFIG.LOSS_REASON_ID,
        CONFIG.LOST_TRACKING_VALUE,
    ]);

    const bitacoraCall = calls.find((call) => call.query.includes("INSERT INTO bitacoras"));
    assert.ok(bitacoraCall);
    assert.deepEqual(bitacoraCall.params.slice(0, 3), [
        6244433,
        3646210,
        CONFIG.LOSS_REASON_ID,
    ]);
    assert.equal(bitacoraCall.params[5], CONFIG.LOST_TRACKING);
});

test("no inserta bitacora si el update no afecta filas", async () => {
    const calls = [];
    const connection = {
        execute: async (query, params = []) => {
            calls.push({ query, params });

            if (query.includes("SELECT") && query.includes("FOR UPDATE")) {
                return [[{
                    id_lead: 11,
                    idinterno_lead: 6244434,
                    id_empleado_lead: 3646211,
                }]];
            }

            if (query.includes("UPDATE leads")) {
                return [{ affectedRows: 0 }];
            }

            throw new Error(`Consulta no esperada: ${query}`);
        },
    };

    const result = await applyAutomaticLossForExpiredNewLeads(connection);

    assert.equal(result.selectedCount, 1);
    assert.equal(result.updatedCount, 0);
    assert.equal(calls.some((call) => call.query.includes("INSERT INTO bitacoras")), false);
});
