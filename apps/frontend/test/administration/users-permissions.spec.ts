import { expect, it } from "vitest";

import { canChangeUserStatus, getUsersPermissions, NO_USERS_PERMISSIONS } from "../../src/modules/administration/users-permissions";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";

const effective = (codes: readonly string[]): IdentityProfile["permissions"] => codes.map((code) => ({ code, effect: "allow", scope: "self", source: "role" }));

it.each([
    ["user.view_list", "list"],
    ["user.view_detail", "detail"],
    ["user.update", "update"],
    ["user.activate", "activate"],
    ["user.deactivate", "deactivate"],
    ["user.assign_password", "assignPassword"],
    ["role.assign", "assignRoles"],
] as const)("grants %s alone without granting other Users actions", (code, key) => {
    expect(getUsersPermissions(effective([code]))).toEqual({ ...NO_USERS_PERMISSIONS, [key]: true });
});
it("requires create plus role.assign, and deny wins independently of order", () => {
    expect(getUsersPermissions(effective(["user.create"])).create).toBe(false);
    expect(getUsersPermissions(effective(["user.create", "role.assign"])).create).toBe(true);
    const denied = { code: "user.create", effect: "deny", scope: null, source: "override" } as const;
    expect(getUsersPermissions([denied, ...effective(["user.create", "role.assign"])]).create).toBe(false);
    expect(getUsersPermissions([...effective(["user.create", "role.assign"]), denied]).create).toBe(false);
});
it("maps each status destination to the exact grant and preserves self restrictions", () => {
    const target = { isCurrentUser: false } as Parameters<typeof canChangeUserStatus>[1];
    const activate = getUsersPermissions(effective(["user.activate"]));
    const deactivate = getUsersPermissions(effective(["user.deactivate"]));
    expect(canChangeUserStatus(activate, target, "active")).toBe(true);
    expect(canChangeUserStatus(activate, target, "blocked")).toBe(false);
    expect(canChangeUserStatus(deactivate, target, "inactive")).toBe(true);
    expect(canChangeUserStatus(deactivate, target, "blocked")).toBe(true);
    expect(canChangeUserStatus(deactivate, target, "active")).toBe(false);
    expect(canChangeUserStatus(activate, { ...target, isCurrentUser: true }, "active")).toBe(false);
});
