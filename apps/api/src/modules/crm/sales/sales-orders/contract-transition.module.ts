import { Module } from "@nestjs/common";

import { AuditModule } from "../../audit/audit.module.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { ContractTransitionController, FormalizationStageController } from "./contract-transition.controller.js";
import { ContractTransitionRepository } from "./contract-transition.repository.js";
import { ContractTransitionService } from "./contract-transition.service.js";
import { FormalizationApprovalController, FormalizationApprovalService } from "./formalization-approval.js";
import { FormalizationApprovalRepository } from "./formalization-approval.repository.js";

/** Cablea el comando de envío y reversa del contrato. El adaptador viejo lo aporta el módulo legacy. Los comandos de sesión comparten la bitácora y la persistencia canónica. */
@Module({ imports: [IdentityModule, AuditModule], controllers: [ContractTransitionController, FormalizationStageController, FormalizationApprovalController], providers: [ContractTransitionService, ContractTransitionRepository, FormalizationApprovalService, FormalizationApprovalRepository] })
export class ContractTransitionModule {}
