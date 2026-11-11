import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import fc from "fast-check";
import { afterEach, expect, it, vi } from "vitest";

import { IdentityPresenceService } from "../../src/modules/crm/identity/identity-presence.service.js";

const owner = { roles: [{ code: "owner", status: "active" }], session: { publicId: "session-1" } };
const identity = { getCurrentUser: vi.fn() };
const profiles = { findPresentUsers: vi.fn() };
afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
});

it("tracks only authenticated sessions, deduplicates users and expires absent browsers", async () => {
    vi.useFakeTimers();
    const service = new IdentityPresenceService(identity as never, profiles as never);
    identity.getCurrentUser.mockResolvedValue(owner);
    await service.heartbeat("token");
    profiles.findPresentUsers.mockResolvedValue([
        { publicId: "person", displayName: "Prueba" },
        { publicId: "person", displayName: "Prueba" },
    ]);
    expect((await service.list("token")).users).toHaveLength(1);
    expect(profiles.findPresentUsers).toHaveBeenCalledWith(["session-1"]);
    vi.advanceTimersByTime(90001);
    expect((await service.list("token")).users).toEqual([]);
    expect(profiles.findPresentUsers).toHaveBeenCalledTimes(1);
});

it("denies every generated non-Owner role before reading other users", async () => {
    const service = new IdentityPresenceService(identity as never, profiles as never);
    await fc.assert(
        fc.asyncProperty(
            fc.string().filter((code) => code !== "owner"),
            async (code) => {
                identity.getCurrentUser.mockResolvedValue({ ...owner, roles: [{ code, status: "active" }] });
                await expect(service.list("token")).rejects.toBeInstanceOf(ForbiddenException);
            },
        ),
        { seed: 20261111, numRuns: 100 },
    );
    expect(profiles.findPresentUsers).not.toHaveBeenCalled();
    identity.getCurrentUser.mockResolvedValue({ ...owner, roles: [{ code: "owner", status: "inactive" }] });
    await expect(service.list("token")).rejects.toBeInstanceOf(ForbiddenException);
});

it("rejects anonymous or revoked credentials without publishing a presence", async () => {
    const service = new IdentityPresenceService(identity as never, profiles as never);
    identity.getCurrentUser.mockRejectedValue(new UnauthorizedException());
    await expect(service.heartbeat(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.list("revoked-token")).rejects.toBeInstanceOf(UnauthorizedException);
    identity.getCurrentUser.mockResolvedValue(owner);
    expect((await service.list("owner-token")).users).toEqual([]);
    expect(profiles.findPresentUsers).not.toHaveBeenCalled();
});
