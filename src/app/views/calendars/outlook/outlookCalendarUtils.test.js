import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCalendarMoveBlockedMessage,
    canAuthenticatedUserMoveCalendarEvent,
    resolveCalendarEventOwner,
} from "./outlookCalendarUtils.js";

test("permite mover cuando admin autenticado es dueño CRM por id_admin", () => {
    const result = canAuthenticatedUserMoveCalendarEvent({
        crmEvent: {
            id_admin: 653055,
            name_admin: "Roberto Carlos Zúñiga Altamirano",
            email_admin: "rzuniga@roccacr.com",
        },
        outlookEvent: null,
        currentAdminId: 653055,
        currentUserEmail: "otro@roccacr.com",
    });

    assert.equal(result.canMove, true);
    assert.equal(result.owner.displayName, "Roberto Carlos Zúñiga Altamirano");
});

test("permite mover cuando usuario autenticado es organizer de Outlook", () => {
    const result = canAuthenticatedUserMoveCalendarEvent({
        crmEvent: null,
        outlookEvent: {
            organizer: {
                emailAddress: {
                    name: "Kenneth Martinez",
                    address: "kmartinez@roccacr.com",
                },
            },
        },
        currentAdminId: null,
        currentUserEmail: "KMARTINEZ@roccacr.com",
    });

    assert.equal(result.canMove, true);
    assert.equal(result.owner.displayName, "Kenneth Martinez");
});

test("bloquea mover cuando usuario solo es invitado y no dueño", () => {
    const result = canAuthenticatedUserMoveCalendarEvent({
        crmEvent: {
            id_admin: 653055,
            name_admin: "Roberto Carlos Zúñiga Altamirano",
            email_admin: "rzuniga@roccacr.com",
        },
        outlookEvent: {
            organizer: {
                emailAddress: {
                    name: "Roberto Carlos Zúñiga Altamirano",
                    address: "rzuniga@roccacr.com",
                },
            },
        },
        currentAdminId: 111111,
        currentUserEmail: "invitado@roccacr.com",
    });

    assert.equal(result.canMove, false);
    assert.equal(
        buildCalendarMoveBlockedMessage(result.owner),
        "Este evento no se puede mover porque pertenece a Roberto Carlos Zúñiga Altamirano.",
    );
});

test("resolveCalendarEventOwner usa fallback de Outlook cuando CRM no trae nombre", () => {
    const owner = resolveCalendarEventOwner(
        { id_admin: 12, email_admin: "" },
        {
            organizer: {
                emailAddress: {
                    name: "Claudio Córdoba Córdoba",
                    address: "ccordoba@roccacr.com",
                },
            },
        },
    );

    assert.equal(owner.displayName, "Claudio Córdoba Córdoba");
    assert.equal(owner.outlookOwnerEmail, "ccordoba@roccacr.com");
});
