import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";

import { CsrfGuard } from "./common/security/csrf.guard.js";
import { validateEnv } from "./config/env.validation.js";
import { DatabaseModule } from "./database/database.module.js";
import { LegacyCrmModule } from "./integrations/legacy-crm/legacy-crm.module.js";
import { AuditModule } from "./modules/crm/audit/audit.module.js";
import { IdentityModule } from "./modules/crm/identity/identity.module.js";
import { PermissionsModule } from "./modules/crm/permissions/permissions.module.js";

/**
 * Modulo raiz del runtime de identidad aprobado.
 *
 * Importa solo la infraestructura necesaria para identidad P0-S1A. Los modulos
 * comerciales del CRM quedan fuera hasta que la ley de producto autorice su
 * corte.
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            // Los tests configuran process.env manualmente; no deben leer el .env real.
            ignoreEnvFile: process.env.NODE_ENV === "test",
            validate: validateEnv,
        }),
        DatabaseModule,
        LegacyCrmModule,
        AuditModule,
        PermissionsModule,
        IdentityModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: CsrfGuard,
        },
    ],
})
export class AppModule {}
