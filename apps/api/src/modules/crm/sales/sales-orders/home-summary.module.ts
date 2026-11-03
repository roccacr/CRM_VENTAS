import { Controller, Get, Header, Inject, Module, Param, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
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

    /** Bounded own-actor activity; independent order permission and live session are mandatory. */
    @Get("recent-activity")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    recentActivity(@Req() request: CookieRequest) {
        return this.service.recentActivity(request.cookies[SESSION_COOKIE_NAME]);
    }

    /** Returns fresh global aggregates without enabling lists or mutations. */
    @Get("summary")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-read" })
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

    /** Fresh global project aggregates; query filters are deliberately unsupported. */
    @Get("project-distribution")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-read" })
    @Header("Cache-Control", "no-store")
    projectDistribution(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.projectDistribution(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Filters and pagination are validated by the use case before SQL. */
    @Get("follow-up")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-read" })
    @Header("Cache-Control", "no-store")
    list(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.list(request.cookies[SESSION_COOKIE_NAME], query);
    }
}

/** Restores a detail identity independently of the visible banner queues. */
@Controller("formalization/orders")
export class FormalizationOrderRecordController {
    /** Reuses the existing projection service with independent detail authorization. */
    constructor(@Inject(FollowUpService) private readonly service: FollowUpService) {}
    /** Returns one direct FollowUpItem without exposing list metadata. */
    @Get(":source/:id/record")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    read(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.record(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
}

/** Registers read-only Home summaries, follow-up and per-order timing. */
@Module({ imports: [IdentityModule], controllers: [HomeSummaryController, FollowUpController, FormalizationOrderRecordController, OrderTimingController], exports: [OrderTimingService], providers: [HomeSummaryRepository, HomeSummaryService, FollowUpRepository, FollowUpService, OrderTimingRepository, OrderTimingService] })
export class HomeSummaryModule {}
