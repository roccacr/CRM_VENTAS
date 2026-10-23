import { describe, expect, it } from "vitest";

import { MFA_LABELS, MFA_TAG_COLORS } from "../../src/modules/administration/system-users.model";
import { parseUpdatedSystemUser } from "../../src/services/auth/identity-contracts";

describe("MFA no verificado", () => {
    it("conserva unknown desde el contrato API hasta la etiqueta administrativa", () => {
        const user = parseUpdatedSystemUser({ email: "target@example.test", externalReferences: [], invitedBy: null, isCurrentUser: false, lastActivityAt: null, mfaStatus: "unknown", name: "Target", orgUnit: null, profileImageUrl: null, provider: "microsoft", publicId: "target", roleChangedAt: null, roles: [], status: "active" });
        expect(user.mfaStatus).toBe("unknown");
        expect(Reflect.get(MFA_LABELS, user.mfaStatus)).toBe("No verificado");
        expect(Reflect.get(MFA_TAG_COLORS, user.mfaStatus)).toBe("default");
    });
});
