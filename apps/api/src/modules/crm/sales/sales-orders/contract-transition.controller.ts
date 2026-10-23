import { Body, Controller, Header, HttpCode, Inject, Post, Req, ValidationPipe } from "@nestjs/common";
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
