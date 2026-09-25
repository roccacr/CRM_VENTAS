import { createHmac } from "node:crypto";

import { NotImplementedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import type { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";

const AUDIT_HASH_SECRET = "audit-hash-secret-for-tests-32-chars";

/**
 * Crea el servicio de identidad con dobles mínimos.
 *
 * El objetivo de estas pruebas no es abrir MySQL: es fijar decisiones de
 * seguridad del caso de uso antes de que exista login real.
 */
const createIdentityService = () => {
    const auditRecord = vi.fn().mockResolvedValue(undefined);
    const audit = {
        record: auditRecord,
    } as unknown as SecurityAuditService;

    const config = {
        getOrThrow: vi.fn().mockReturnValue(AUDIT_HASH_SECRET),
    } as unknown as ConfigService;

    const repository = {} as IdentityRepository;

    return {
        audit,
        auditRecord,
        service: new IdentityService(repository, audit, config),
    };
};

/**
 * Calcula el HMAC esperado sin reutilizar la implementacion productiva.
 */
const hmacEmail = (email: string): string => createHmac("sha256", AUDIT_HASH_SECRET).update(email.trim().toLowerCase()).digest("hex");

describe("IdentityService", () => {
    it("mantiene refresh como stub no implementado hasta existir rotacion segura", () => {
        const { service } = createIdentityService();

        expect(() => service.refresh()).toThrow(NotImplementedException);
    });

    it("audita la solicitud de reset local sin exponer el correo crudo", async () => {
        const { auditRecord, service } = createIdentityService();

        await service.requestLocalReset({ email: " Usuario@RoccaCR.com " }, "127.0.0.1", "vitest");

        expect(auditRecord).toHaveBeenCalledWith({
            eventType: "local_reset_requested",
            summary: "Solicitud neutral de activacion/reset local recibida.",
            actorUserId: null,
            targetUserId: null,
            reason: "local_reset_request",
            ipAddress: "127.0.0.1",
            userAgent: "vitest",
            metadata: {
                emailHmac: hmacEmail("Usuario@RoccaCR.com"),
                hmacKeyVersion: 1,
            },
        });
    });
});
