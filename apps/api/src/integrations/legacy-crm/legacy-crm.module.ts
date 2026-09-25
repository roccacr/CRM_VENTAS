import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { createLegacyCrmDatabase, LEGACY_CRM_DATABASE } from "./legacy-crm.config.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

/**
 * Modulo adapter para el CRM viejo.
 *
 * No contiene reglas de negocio nuevas. Solo expone infraestructura aislada
 * para readers/mappers legacy que una futura sync autorizada pueda usar.
 */
@Module({
    providers: [
        {
            provide: LEGACY_CRM_DATABASE,
            inject: [ConfigService],
            useFactory: createLegacyCrmDatabase,
        },
        LegacyCrmDatabaseService,
    ],
    exports: [LegacyCrmDatabaseService],
})
export class LegacyCrmModule {}
