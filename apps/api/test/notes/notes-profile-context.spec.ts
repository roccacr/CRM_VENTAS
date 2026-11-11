import { BadRequestException, ForbiddenException } from "@nestjs/common";
import fc from "fast-check";
import { expect, it } from "vitest";

import { authorizeNoteView, noteViewPermissions } from "../../src/modules/crm/notes/notes-context.js";

const profile = {
    roles: [],
    permissions: [
        { code: "formalizacion.notes.read", effect: "allow" },
        { code: "lead.profile.read", effect: "allow" },
    ],
};

it("registers the customer profile only in Formalization with its own permission", () => {
    expect(noteViewPermissions("formalizacion", "lead-profile")).toEqual(["lead.profile.read"]);
    expect(() => {
        authorizeNoteView(profile as never, "formalizacion", "lead-profile");
    }).not.toThrow();
    expect(() => {
        authorizeNoteView({ ...profile, permissions: [profile.permissions[0]] } as never, "formalizacion", "lead-profile");
    }).toThrow(ForbiddenException);
    expect(() => {
        authorizeNoteView({ ...profile, permissions: [...profile.permissions, { code: "lead.profile.read", effect: "deny" }] } as never, "formalizacion", "lead-profile");
    }).toThrow(ForbiddenException);
});

it("rejects generated unregistered views and cross-module profile access", () => {
    fc.assert(
        fc.property(
            fc.string().filter((value) => value !== "lead-profile"),
            (value) => {
                expect(() => {
                    authorizeNoteView(profile as never, "formalizacion", `invalid-${value}`);
                }).toThrow(BadRequestException);
            },
        ),
        { seed: 20261111, numRuns: 100 },
    );
    expect(() => {
        authorizeNoteView(profile as never, "mercadeo", "lead-profile");
    }).toThrow(BadRequestException);
});
