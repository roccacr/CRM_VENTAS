const test = require("node:test");
const assert = require("node:assert/strict");

const calendars = require("./calendars");

test("getAll_ListEvent binds date range before advisor visibility params", () => {
    assert.deepEqual(
        calendars._private.buildGetAllListEventParams([3197221], {
            dateStart: "2026-07-01T00:00:00",
            dateEnd: "2026-07-31",
        }),
        ["2026-07-01T00:00:00", "2026-07-31", 3197221],
    );
});
