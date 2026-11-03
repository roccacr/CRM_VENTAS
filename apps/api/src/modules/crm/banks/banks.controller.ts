import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query, Req, type Type, ValidationPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { BankAdvisorIdDto, BankContextDto, BankIdDto, BankStatusDto, CreateBankAdvisorDto, CreateBankDto, ListBanksQueryDto, UpdateBankAdvisorDto, UpdateBankDto } from "./banks.dto.js";
import { BanksService } from "./banks.service.js";
/** Explicit DTO types keep validation active under tsx/esbuild without emitted metadata. */
const validateInput = (expectedType: Type<unknown>) => new ValidationPipe({ expectedType, transform: true, whitelist: true, forbidNonWhitelisted: true });

/** Dedicated routes preserve the bank/advisor contract; no ERP fields or local PKs are exposed. */
@ApiTags("banks")
@Controller("catalogs/banks/items")
export class BanksController {
    /** Delegates session-bound operations to the bank application service. */
    constructor(@Inject(BanksService) private readonly banks: BanksService) {}
    /** Lists the requested server-filtered page. */
    @Get()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "read" })
    @ApiOperation({ summary: "Listar bancos." })
    list(@Query(validateInput(ListBanksQueryDto)) query: ListBanksQueryDto, @Req() request: CookieRequest) {
        return this.banks.listBanks(request.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Returns a bank by canonical public identity. */
    @Get(":bankId")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "read" })
    @ApiOperation({ summary: "Consultar banco." })
    get(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Query(validateInput(BankContextDto)) query: BankContextDto, @Req() request: CookieRequest) {
        return this.banks.getBank(request.cookies[SESSION_COOKIE_NAME], ids.bankId, query);
    }
    /** Creates a bank with its audited reason. */
    @Post()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "create" })
    @ApiOperation({ summary: "Crear banco." })
    create(@Body(validateInput(CreateBankDto)) body: CreateBankDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.createBank(request.cookies[SESSION_COOKIE_NAME], body, { ipAddress: request.ip, userAgent });
    }
    /** Edits a bank using optimistic concurrency. */
    @Patch(":bankId")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "update" })
    @ApiOperation({ summary: "Editar banco." })
    update(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Body(validateInput(UpdateBankDto)) body: UpdateBankDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.updateBank(request.cookies[SESSION_COOKIE_NAME], ids.bankId, body, { ipAddress: request.ip, userAgent });
    }
    /** Changes only the bank state; advisor states remain independent. */
    @Patch(":bankId/status")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "status" })
    @ApiOperation({ summary: "Cambiar estado de banco." })
    status(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Body(validateInput(BankStatusDto)) body: BankStatusDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.bankStatus(request.cookies[SESSION_COOKIE_NAME], ids.bankId, body, { ipAddress: request.ip, userAgent });
    }
    /** Lists advisors belonging to the route bank. */
    @Get(":bankId/advisors")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "read" })
    @ApiOperation({ summary: "Listar ejecutivos del banco." })
    advisors(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Query(validateInput(ListBanksQueryDto)) query: ListBanksQueryDto, @Req() request: CookieRequest) {
        return this.banks.listAdvisors(request.cookies[SESSION_COOKIE_NAME], ids.bankId, query);
    }
    /** Creates a contact only while its bank is active. */
    @Post(":bankId/advisors")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "create" })
    @ApiOperation({ summary: "Crear ejecutivo del banco." })
    createAdvisor(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Body(validateInput(CreateBankAdvisorDto)) body: CreateBankAdvisorDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.createAdvisor(request.cookies[SESSION_COOKIE_NAME], ids.bankId, body, { ipAddress: request.ip, userAgent });
    }
    /** Edits contact details without changing the parent bank. */
    @Patch(":bankId/advisors/:advisorId")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "update" })
    @ApiOperation({ summary: "Editar ejecutivo sin trasladarlo de banco." })
    updateAdvisor(@Param(validateInput(BankAdvisorIdDto)) ids: BankAdvisorIdDto, @Body(validateInput(UpdateBankAdvisorDto)) body: UpdateBankAdvisorDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.updateAdvisor(request.cookies[SESSION_COOKIE_NAME], ids, body, { ipAddress: request.ip, userAgent });
    }
    /** Changes only the advisor state with an expected version. */
    @Patch(":bankId/advisors/:advisorId/status")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "status" })
    @ApiOperation({ summary: "Cambiar estado de ejecutivo." })
    advisorStatus(@Param(validateInput(BankAdvisorIdDto)) ids: BankAdvisorIdDto, @Body(validateInput(BankStatusDto)) body: BankStatusDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.advisorStatus(request.cookies[SESSION_COOKIE_NAME], ids, body, { ipAddress: request.ip, userAgent });
    }
}
