import { Controller, Get, Inject, Param, Query, Req, ValidationPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { UnitFilesContextDto, UnitFilesFacetsDto, UnitFilesOptionsDto, UnitFilesQueryDto } from "./unit-files.dto.js";
import { UnitFilesService } from "./unit-files.service.js";

/** Dedicated read surface; there is deliberately no delete or legacy mutation route. */
@ApiTags("unit-files")
@Controller("unit-files")
export class UnitFilesController {
    /** Cookie/session authorization is performed by the service for every request. */
    constructor(@Inject(UnitFilesService) private readonly units: UnitFilesService) {}

    /** Project choices do not load units. */
    @Get("projects")
    projects(@Query(new ValidationPipe({ expectedType: UnitFilesContextDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesContextDto, @Req() request: CookieRequest) {
        return this.units.projects(request.cookies[SESSION_COOKIE_NAME], query.moduleCode);
    }

    /** Searchable choices are project-scoped and never expose complete unit records. */
    @Get("options")
    options(@Query(new ValidationPipe({ expectedType: UnitFilesOptionsDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesOptionsDto, @Req() request: CookieRequest) {
        return this.units.options(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Full-scope aggregate choices are independently bounded and authenticated. */
    @Get("facets")
    facets(@Query(new ValidationPipe({ expectedType: UnitFilesFacetsDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesFacetsDto, @Req() request: CookieRequest) {
        return this.units.facets(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Unfiltered or excessive requests fail DTO validation. */
    @Get()
    list(@Query(new ValidationPipe({ expectedType: UnitFilesQueryDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesQueryDto, @Req() request: CookieRequest) {
        return this.units.list(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Full business data is fetched only when a specific record is opened. */
    @Get(":id")
    detail(@Param("id") id: string, @Query(new ValidationPipe({ expectedType: UnitFilesContextDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesContextDto, @Req() request: CookieRequest) {
        return this.units.detail(request.cookies[SESSION_COOKIE_NAME], id, query.moduleCode);
    }
}
