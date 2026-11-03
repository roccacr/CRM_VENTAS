import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { BanksController } from "./banks.controller.js";
import { BanksRepository } from "./banks.repository.js";
import { BanksService } from "./banks.service.js";
/** Registers the bank slice with the existing identity and atomic audit services. */
@Module({ imports: [AuditModule, IdentityModule], controllers: [BanksController], providers: [BanksRepository, BanksService], exports: [BanksRepository] })
export class BanksModule {}
