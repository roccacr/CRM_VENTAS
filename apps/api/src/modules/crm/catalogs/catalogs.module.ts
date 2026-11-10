/**
 * Catálogos que todavía viven en las tablas compartidas.
 *
 * Los agregados propios no se registran aquí. Identidad resuelve la sesión y
 * la bitácora escribe el motivo en la misma transacción del cambio. El lector
 * del CRM viejo tampoco se registra en este módulo.
 */
import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { CatalogsController } from "./catalogs.controller.js";
import { CatalogsRepository } from "./catalogs.repository.js";
import { CatalogsService } from "./catalogs.service.js";

/** Registra los catalogos compartidos con identidad y auditoria. */
@Module({
    imports: [AuditModule, IdentityModule],
    controllers: [CatalogsController],
    providers: [CatalogsRepository, CatalogsService],
})
export class CatalogsModule {}
