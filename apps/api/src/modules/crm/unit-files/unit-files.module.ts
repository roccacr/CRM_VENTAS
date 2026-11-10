import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module.js";
import { UnitFilesController } from "./unit-files.controller.js";
import { UnitFilesRepository } from "./unit-files.repository.js";
import { UnitFilesService } from "./unit-files.service.js";

/**
 * El expediente tiene su propia API y su tabla nativa. No usa el repositorio de catálogos.
 * Este módulo no registra el lector viejo y no exporta otro pool.
 */
@Module({ imports: [IdentityModule], controllers: [UnitFilesController], providers: [UnitFilesRepository, UnitFilesService] })
export class UnitFilesModule {}
