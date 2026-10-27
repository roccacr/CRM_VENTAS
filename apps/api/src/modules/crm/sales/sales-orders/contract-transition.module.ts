import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { ContractTransitionController, FormalizationStageController } from "./contract-transition.controller.js";
import { ContractTransitionRepository } from "./contract-transition.repository.js";
import { ContractTransitionService } from "./contract-transition.service.js";

/** Wires the contract send/revert command; the legacy adapter is supplied by LegacyCrmModule. Session-authorized commands share audit and canonical persistence providers. */
@Module({ imports: [IdentityModule, AuditModule], controllers: [ContractTransitionController, FormalizationStageController], providers: [ContractTransitionService, ContractTransitionRepository] })
export class ContractTransitionModule {}
