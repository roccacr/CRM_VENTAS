import { Controller, Get, Header, Inject, Module, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { ApprovalSummaryRepository } from "./approval-summary.repository.js";
import { ApprovalSummaryService } from "./approval-summary.service.js";

/** Only the summary read endpoint is exposed, not lifecycle mutations. */
@Controller("formalization/approvals")
export class ApprovalSummaryController {
    /** Delegates authentication and authorization to the use case. */
    constructor(@Inject(ApprovalSummaryService) private readonly service: ApprovalSummaryService) {}

    /** Aggregate response shared by all configured sources. */
    @Get("summary")
    @RouteSecurity("permission")
    @Header("Cache-Control", "no-store")
    summary(@Req() request: CookieRequest) {
        return this.service.summary(request.cookies[SESSION_COOKIE_NAME]);
    }
}

/** Minimal wiring for the authorized approval banner. */
@Module({ imports: [IdentityModule], controllers: [ApprovalSummaryController], providers: [ApprovalSummaryService, ApprovalSummaryRepository] })
export class ApprovalSummaryModule {}
