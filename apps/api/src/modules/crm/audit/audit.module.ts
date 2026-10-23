import { Module } from "@nestjs/common";

import { RecordAuditService } from "./record-audit.service.js";
import { SecurityAuditService } from "./security-audit.service.js";

/**
 * Auditoria de seguridad y bitacora de registros compartida.
 * La escritura central requiere activacion explicita y la transaccion del negocio.
 */
@Module({
    providers: [RecordAuditService, SecurityAuditService],
    exports: [RecordAuditService, SecurityAuditService],
})
export class AuditModule {}
