import { Body, Controller, Get, Header, HttpCode, Inject, Module, Param, Patch, Post, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { CalendarRepository } from "./calendar.repository.js";
import { CalendarService } from "./calendar.service.js";
import { CalendarLookupService } from "./calendar-lookup.service.js";

/** One protected contract for every module; event ownership is never inferred from a browser role. */
@Controller("calendar")
export class CalendarController {
    /** Injects the existing identity, persistence or audit dependencies. */
    constructor(@Inject(CalendarService) private readonly service: CalendarService) {}
    /** Returns calendars and type forms allowed by the authenticated profile. */
    @Get("calendars")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    calendars(@Req() request: CookieRequest) {
        return this.service.calendars(request.cookies[SESSION_COOKIE_NAME]);
    }
    /** Lists authorized overlays for a bounded visible interval. */
    @Get("events")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    events(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.list(request.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Bounded suggestions recheck note, lead and order permissions independently. */
    @Get("lookup")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    lookup(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.lookup(request.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Creates a native event with server actor and atomic audit. */
    @Post("events")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "create" })
    create(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.service.save(request.cookies[SESSION_COOKIE_NAME], body);
    }
    /** Edits a native event using its expected version. */
    @Patch("events/:id")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "update" })
    update(@Req() request: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.service.save(request.cookies[SESSION_COOKIE_NAME], body, id);
    }
}
/** Wires the shared calendar API to existing identity and audit modules. */
@Module({ imports: [IdentityModule, AuditModule], controllers: [CalendarController], providers: [CalendarRepository, CalendarService, CalendarLookupService] })
export class CalendarModule {}
