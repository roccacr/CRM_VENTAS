import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { IdentityController } from "./identity.controller.js";
import { IdentityRepository } from "./identity.repository.js";
import { IdentityService } from "./identity.service.js";
import { IdentityAccessManagementController } from "./identity-access-management.controller.js";
import { IdentityAccessManagementRepository } from "./identity-access-management.repository.js";
import { IdentityAccessManagementService } from "./identity-access-management.service.js";
import { IdentityAuditRecorder } from "./identity-audit-recorder.service.js";
import { IdentityLocalRepository } from "./identity-local.repository.js";
import { IdentityMicrosoftRepository } from "./identity-microsoft.repository.js";
import { IdentityMicrosoftSessionService } from "./identity-microsoft-session.service.js";
import { IdentityProfileRepository } from "./identity-profile.repository.js";
import { IdentitySessionRepository } from "./identity-session.repository.js";
import { IdentityTokenService } from "./identity-token.service.js";
import { IdentityUserDirectoryRepository } from "./identity-user-directory.repository.js";

/**
 * Modulo feature de identidad para P0-S1A.
 *
 * Expone endpoints HTTP de identidad y mantiene calculo de permisos como
 * colaborador importado. No incluye concerns de leads, ERP ni CRM comercial.
 */
@Module({
    imports: [AuditModule, PermissionsModule],
    controllers: [IdentityController, IdentityAccessManagementController],
    providers: [IdentityService, IdentityRepository, IdentityProfileRepository, IdentitySessionRepository, IdentityLocalRepository, IdentityMicrosoftRepository, IdentityUserDirectoryRepository, IdentityAccessManagementService, IdentityAccessManagementRepository, IdentityTokenService, IdentityAuditRecorder, IdentityMicrosoftSessionService],
})
export class IdentityModule {}
