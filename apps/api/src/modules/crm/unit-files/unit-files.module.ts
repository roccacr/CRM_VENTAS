import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module.js";
import { UnitFilesController } from "./unit-files.controller.js";
import { UnitFilesRepository } from "./unit-files.repository.js";
import { UnitFilesService } from "./unit-files.service.js";

/** Unit Files owns its API and native data independently of the catalog repository. */
@Module({ imports: [IdentityModule], controllers: [UnitFilesController], providers: [UnitFilesRepository, UnitFilesService] })
export class UnitFilesModule {}
