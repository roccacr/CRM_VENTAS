import { Module } from "@nestjs/common";

import { SecurityAuditService } from "./security-audit.service.js";

/**
 * Modulo de auditoria para eventos sensibles de identidad CRM.
 *
 * Auditoria queda aislada porque las acciones comerciales futuras deben
 * reutilizar el mismo patron append-only en vez de inventar bitacoras por
 * pantalla.
 */
@Module({
    providers: [SecurityAuditService],
    exports: [SecurityAuditService],
})
export class AuditModule {}
