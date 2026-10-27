import { Controller, Get, Header, Inject, Module, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { FORMALIZATION_STAGE_READ_PERMISSION } from "../../../../common/security/route-permission.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { FollowUpRepository } from "./follow-up.repository.js";
import { FollowUpService } from "./follow-up.service.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { HomeSummaryService } from "./home-summary.service.js";
import { OrderTimingController } from "./order-timing.controller.js";
import { OrderTimingRepository } from "./order-timing.repository.js";
import { OrderTimingService } from "./order-timing.service.js";

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

/** Live follow-up is read-only; it never enables the simulated detail's commands. */
@Controller("formalization/home")
export class FollowUpController {
    /** The use case owns authorization, filtering and data access. */
    constructor(@Inject(FollowUpService) private readonly service: FollowUpService) {}

    /** Filters and pagination are validated by the use case before SQL. */
    @Get("follow-up")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "active-role", code: "formalizacion", permissionCodes: [FORMALIZATION_STAGE_READ_PERMISSION] })
    @Header("Cache-Control", "no-store")
    list(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.list(request.cookies[SESSION_COOKIE_NAME], query);
    }
}

/** Registers read-only Home summaries, follow-up and per-order timing. */
@Module({ imports: [IdentityModule], controllers: [HomeSummaryController, FollowUpController, OrderTimingController], providers: [HomeSummaryRepository, HomeSummaryService, FollowUpRepository, FollowUpService, OrderTimingRepository, OrderTimingService] })
export class HomeSummaryModule {}
