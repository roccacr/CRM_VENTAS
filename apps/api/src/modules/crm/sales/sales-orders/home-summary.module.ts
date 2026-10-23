import { Controller, Get, Header, Inject, Module, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { FORMALIZATION_STAGE_READ_PERMISSION } from "../../../../common/security/route-permission.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { HomeSummaryService } from "./home-summary.service.js";

/** Home aggregates only; existing contract and approval routes retain their contracts. */
@Controller("formalization/home")
export class HomeSummaryController {
    /** Delegates current membership and read orchestration to the service. */
    constructor(@Inject(HomeSummaryService) private readonly service: HomeSummaryService) {}

    /** Returns fresh global aggregates without enabling lists or mutations. */
    @Get("summary")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "active-role", code: "formalizacion", permissionCodes: [FORMALIZATION_STAGE_READ_PERMISSION] })
    @Header("Cache-Control", "no-store")
    summary(@Req() request: CookieRequest) {
        return this.service.summary(request.cookies[SESSION_COOKIE_NAME]);
    }
}

/** Registers only the Home read endpoint. */
@Module({ imports: [IdentityModule], controllers: [HomeSummaryController], providers: [HomeSummaryRepository, HomeSummaryService] })
export class HomeSummaryModule {}
