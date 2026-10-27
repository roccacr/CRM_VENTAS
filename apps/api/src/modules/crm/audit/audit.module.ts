import { Module } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service.js";
import { LeadHistoryCommands } from "../leads/lead-history-commands.js";
import { RecordAuditService } from "./record-audit.service.js";
import { SecurityAuditService } from "./security-audit.service.js";

/**
 * Auditoria de seguridad y bitacora de registros compartida.
 * La escritura central requiere activacion explicita y la transaccion del negocio.
 */
@Module({
    providers: [RecordAuditService, SecurityAuditService, { provide: LeadHistoryCommands, useFactory: (database: DatabaseService, records: RecordAuditService) => new LeadHistoryCommands(database, records), inject: [DatabaseService, RecordAuditService] }],
    exports: [RecordAuditService, SecurityAuditService, LeadHistoryCommands],
})
export class AuditModule {}
