import { Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Query, Req, ValidationPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { ContractTransitionDto } from "./contract-transition.dto.js";
import { ContractTransitionService } from "./contract-transition.service.js";

/** Strict body validation: unknown properties are rejected, not silently dropped. */
// Explicit type preserves validation in tsx/esbuild paths without emitted param metadata.
const bodyValidation = new ValidationPipe({ expectedType: ContractTransitionDto, transform: true, whitelist: true, forbidNonWhitelisted: true });

/** Requires the application's existing session, permission and CSRF guards when wired. */
@ApiTags("Formalization contracts")
@Controller("formalization/contracts")
export class ContractTransitionController {
    /** All mutations pass through the session-authorized application service. */
    constructor(@Inject(ContractTransitionService) private readonly service: ContractTransitionService) {}

    /** Records CRM send evidence only; does not send email or invoke ERP. */
    @Post("send")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.contracts.send"] })
    @ApiOperation({ summary: "Record contract send" })
    send(@Req() request: CookieRequest, @Body(bodyValidation) body: ContractTransitionDto) {
        return this.service.transition(request.cookies[SESSION_COOKIE_NAME], "send", body, this.context(request));
    }

    /** Appends a reasoned reversal without erasing any previous event. */
    @Post("revert")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.contracts.revert"] })
    @ApiOperation({ summary: "Revert contract send" })
    revert(@Req() request: CookieRequest, @Body(bodyValidation) body: ContractTransitionDto) {
        return this.service.transition(request.cookies[SESSION_COOKIE_NAME], "revert", body, this.context(request));
    }

    /** Network metadata for the audit trail; the user agent is truncated to bound stored size. */
    private context(request: CookieRequest) {
        const userAgent = request.headers["user-agent"];
        return { ipAddress: request.ip, ...(typeof userAgent === "string" ? { userAgent: userAgent.slice(0, 500) } : {}) };
    }
}

/** Selected CRM stage changes share the existing transactional writer and global guards. */
@ApiTags("Formalization orders")
@Controller("formalization/orders")
export class FormalizationStageController {
    /** The independent branch leaves the commercial stage and its timing unchanged. */
    @Get("finiquito")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @ApiOperation({ summary: "Read the independent lost-sale finiquito branch" })
    finiquito(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.finiquito(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Records preparation, dispatch or signature; does not send an email. */
    @Post("finiquito")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.stage.update"] })
    @ApiOperation({ summary: "Advance finiquito with confirmed lost-sale and signed-contract checks" })
    updateFiniquito(@Req() request: CookieRequest, @Body() body: unknown) {
        const userAgent = request.headers["user-agent"];
        return this.service.finiquito(request.cookies[SESSION_COOKIE_NAME], body, true, { ipAddress: request.ip, ...(typeof userAgent === "string" ? { userAgent: userAgent.slice(0, 500) } : {}) });
    }

    /** Supplies a fresh central audit version before editing. */
    @Get(":source/:id/purchase-funds")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.stage.update"] })
    purchaseFundsSnapshot(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.purchaseFundsSnapshot(request.cookies[SESSION_COOKIE_NAME], source, id);
    }
    /** Saves funding classification without sending a contract or advancing the workflow. */
    @Post("purchase-funds")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.stage.update"] })
    @ApiOperation({ summary: "Update purchase funds without changing stage" })
    updatePurchaseFunds(@Req() request: CookieRequest, @Body() body: unknown) {
        const userAgent = request.headers["user-agent"];
        return this.service.updatePurchaseFunds(request.cookies[SESSION_COOKIE_NAME], body, { ipAddress: request.ip, ...(typeof userAgent === "string" ? { userAgent: userAgent.slice(0, 500) } : {}) });
    }
    /** Reuses authenticated stage commands without a second persistence path. */
    constructor(@Inject(ContractTransitionService) private readonly service: ContractTransitionService) {}

    /** Never sends communications or changes ERP approval flags. */
    @Post("stage")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.stage.update"] })
    @ApiOperation({ summary: "Change the selected Formalization stage" })
    setStage(@Req() request: CookieRequest, @Body(bodyValidation) body: ContractTransitionDto) {
        const userAgent = request.headers["user-agent"];
        return this.service.transition(request.cookies[SESSION_COOKIE_NAME], "set", body, { ipAddress: request.ip, ...(typeof userAgent === "string" ? { userAgent: userAgent.slice(0, 500) } : {}) });
    }
}
