import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { CatalogsController } from "./catalogs.controller.js";
import { CatalogsRepository } from "./catalogs.repository.js";
import { CatalogsService } from "./catalogs.service.js";

/**
 *
 */
@Module({
    imports: [AuditModule, IdentityModule],
    controllers: [CatalogsController],
    providers: [CatalogsRepository, CatalogsService],
})
export class CatalogsModule {}
