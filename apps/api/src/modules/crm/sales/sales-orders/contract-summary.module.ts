import { Controller, Get, Header, Inject, Module, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { FORMALIZATION_STAGE_READ_PERMISSION } from "../../../../common/security/route-permission.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { ApprovalSummaryModule } from "./approval-summary.module.js";
import { ContractSummaryRepository } from "./contract-summary.repository.js";
import { ContractSummaryService } from "./contract-summary.service.js";

/** Home counts only; no list or mutation endpoints are enabled in this cut. */
@Controller("formalization/contracts")
export class ContractSummaryController {
    /** Delegates resource-independent membership checks to the use case. */
    constructor(@Inject(ContractSummaryService) private readonly service: ContractSummaryService) {}

    /** Global aggregate JSON for the permitted banner. */
    @Get("summary")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "active-role", code: "formalizacion", permissionCodes: [FORMALIZATION_STAGE_READ_PERMISSION] })
    @Header("Cache-Control", "no-store")
    summary(@Req() request: CookieRequest) {
        return this.service.summary(request.cookies[SESSION_COOKIE_NAME]);
    }
}

/** Reuses native identity-shadow lookup from approvals. */
@Module({ imports: [IdentityModule, ApprovalSummaryModule], controllers: [ContractSummaryController], providers: [ContractSummaryRepository, ContractSummaryService] })
export class ContractSummaryModule {}
