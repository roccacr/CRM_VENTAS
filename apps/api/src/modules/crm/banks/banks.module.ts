import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { BanksController } from "./banks.controller.js";
import { BanksRepository } from "./banks.repository.js";
import { BanksService } from "./banks.service.js";
/**
 * Catálogo nativo con la identidad y la bitácora ya existentes.
 * El repositorio se exporta para no abrir otro pool. El espejo legado no se registra aquí.
 */
@Module({ imports: [AuditModule, IdentityModule], controllers: [BanksController], providers: [BanksRepository, BanksService], exports: [BanksRepository] })
export class BanksModule {}
