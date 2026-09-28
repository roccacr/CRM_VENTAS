import { createHmac } from "node:crypto";

import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAuditRecorder } from "../../src/modules/crm/identity/identity-audit-recorder.service.js";

const AUDIT_HASH_SECRET = "audit-hash-secret-for-tests-32-chars";

/**
 * Crea el recorder con dobles sin abrir MySQL.
 */
const createRecorder = () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const recorder = new IdentityAuditRecorder(
        { record } as unknown as SecurityAuditService,
        {
            getOrThrow: vi.fn().mockReturnValue(AUDIT_HASH_SECRET),
        } as unknown as ConfigService,
    );

    return { record, recorder };
};

describe("IdentityAuditRecorder", () => {
    it("audita reset local con HMAC y sin correo crudo", async () => {
        const { record, recorder } = createRecorder();
        const normalizedEmail = "usuario@roccacr.com";
        const expectedHmac = createHmac("sha256", AUDIT_HASH_SECRET).update(normalizedEmail).digest("hex");

        await recorder.recordLocalResetRequested(normalizedEmail, "127.0.0.1", "vitest");

        expect(record).toHaveBeenCalledWith({
            eventType: "local_reset_requested",
            summary: "Solicitud neutral de activacion/reset local recibida.",
            actorUserId: null,
            targetUserId: null,
            reason: "local_reset_request",
            ipAddress: "127.0.0.1",
            userAgent: "vitest",
            metadata: {
                emailHmac: expectedHmac,
                hmacKeyVersion: 1,
            },
        });
        expect(JSON.stringify(record.mock.calls)).not.toContain(normalizedEmail);
    });
});
