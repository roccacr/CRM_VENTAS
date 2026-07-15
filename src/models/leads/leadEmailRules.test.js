const assert = require("node:assert/strict");
const test = require("node:test");

const {
    normalizeRecipients,
    shouldSendIndividualReport,
} = require("./leadEmailRules");

test("normaliza y elimina destinatarios repetidos sin importar mayusculas", () => {
    assert.deepEqual(
        normalizeRecipients([
            "ccordoba@roccacr.com",
            "CCORDOBA@ROCCACR.COM",
            " fmata@roccacr.com ",
            "",
            null,
        ]),
        ["ccordoba@roccacr.com", "fmata@roccacr.com"],
    );
});

test("no envia reporte individual a destinatarios gerenciales", () => {
    const managementRecipients = [
        "ccordoba@roccacr.com",
        "fmata@roccacr.com",
    ];

    assert.equal(
        shouldSendIndividualReport(
            { vendedor_email: "ccordoba@roccacr.com" },
            managementRecipients,
        ),
        false,
    );
    assert.equal(
        shouldSendIndividualReport(
            { vendedor_email: "asesor@roccacr.com" },
            managementRecipients,
        ),
        true,
    );
});
