import { Module } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service.js";
import { LeadHistoryCommands } from "../leads/lead-history-commands.js";
import { RecordAuditService } from "./record-audit.service.js";
import { SecurityAuditService } from "./security-audit.service.js";

/**
 * Una sola bitacora para seguridad y para registros. La historia de leads se
 * arma aqui para que escriba por el mismo servicio, no por otro escritor.
 * La bitacora de registros solo corre si esta encendida y dentro de la
 * transaccion del negocio.
 */
@Module({
    providers: [RecordAuditService, SecurityAuditService, { provide: LeadHistoryCommands, useFactory: (database: DatabaseService, records: RecordAuditService) => new LeadHistoryCommands(database, records), inject: [DatabaseService, RecordAuditService] }],
    exports: [RecordAuditService, SecurityAuditService, LeadHistoryCommands],
})
export class AuditModule {}
