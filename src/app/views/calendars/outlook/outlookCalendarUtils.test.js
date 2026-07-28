import assert from "node:assert/strict";
import test from "node:test";

import {
    buildEventSummaryPreview,
    buildCalendarMoveBlockedMessage,
    canAuthenticatedUserMoveCalendarEvent,
    normalizeEditableEventDescription,
    outlookHtmlToPlainText,
    plainTextToOutlookHtml,
    resolveCalendarEventOwner,
} from "./outlookCalendarUtils.js";

test("buildEventSummaryPreview limita el resumen de la tarjeta compacta", () => {
    assert.equal(
        buildEventSummaryPreview("Primero\n\nSegundo", 10),
        "Primero Se...",
    );
});

test("plainTextToOutlookHtml conserva saltos de linea y espacios", () => {
    assert.equal(
        plainTextToOutlookHtml("Primero\n\n  Segundo"),
        "Primero<br /><br />&nbsp;&nbsp;Segundo",
    );
});

test("outlookHtmlToPlainText evita acumular lineas vacias de Outlook", () => {
    assert.equal(
        outlookHtmlToPlainText("<div>1. Manual del Cliente.</div><div><br></div><div>2. Planos en expedientes.</div><div><br></div><div>3. Contrato de corredores.</div>"),
        "1. Manual del Cliente.\n2. Planos en expedientes.\n3. Contrato de corredores.",
    );
});

test("normalizeEditableEventDescription limpia HTML y blancos heredados antes de editar", () => {
    assert.equal(
        normalizeEditableEventDescription("<div>1. Manual del Cliente.</div><div><br></div><div>2. Planos en expedientes.</div>"),
        "1. Manual del Cliente.\n2. Planos en expedientes.",
    );
    assert.equal(
        normalizeEditableEventDescription("1. Manual del Cliente.\n\n\n2. Planos en expedientes."),
        "1. Manual del Cliente.\n2. Planos en expedientes.",
    );
});

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
