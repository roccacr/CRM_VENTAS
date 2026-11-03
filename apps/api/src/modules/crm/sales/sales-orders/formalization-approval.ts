import { BadRequestException, Body, Controller, ForbiddenException, Header, HttpCode, Inject, Injectable, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ulid } from "ulid";
import { z } from "zod";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { IdentityService } from "../../identity/identity.service.js";
import { formalizationPermissionScope } from "./follow-up.service.js";
import { FormalizationApprovalRepository } from "./formalization-approval.repository.js";
import { orderTimingIdentity } from "./order-timing.contract.js";

const approvalRequest = z.strictObject({ source: z.enum(["native", "legacy"]), id: z.string().max(26), expectedSequence: z.number().int().min(0).max(4294967294), operationId: z.uuid() });

/** Authorizes the live session before resolving either database or confirming the ERP check. */
@Injectable()
export class FormalizationApprovalService {
    /** Internal callers must also use a live session; neither role names nor client flags can grant approval. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(FormalizationApprovalRepository) private readonly repository: FormalizationApprovalRepository,
    ) {}

    /** The banner read grant never authorizes this mutation; individual denies still prevail. */
    async approve(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        if (!formalizationPermissionScope(profile, "formalizacion.orders.approve").allowed) throw new ForbiddenException("No tiene permiso para aprobar Formalización.");
        const request = approvalRequest.safeParse(input);
        if (!request.success || !orderTimingIdentity.safeParse(request.data).success) throw new BadRequestException("Solicitud de aprobación inválida.");
        const target = orderTimingIdentity.parse(request.data);
        const scope = formalizationPermissionScope(profile, "formalizacion.orders.approve");
        return this.repository.approve({ ...request.data, ...target, actorPublicId: profile.user.publicId, ownOnly: scope.ownOnly, correlationId: ulid() });
    }
}

/** Global session, CSRF and permission guards apply before the command service. */
@ApiTags("Formalization orders")
@Controller("formalization/orders")
export class FormalizationApprovalController {
    /** Reuses the live application authorization for HTTP and internal calls. */
    constructor(@Inject(FormalizationApprovalService) private readonly service: FormalizationApprovalService) {}

    /** Confirms the ERP check first, then commits the local approval and audit together. */
    @Post("approve")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.approve"] })
    @ApiOperation({ summary: "Approve Formalization after NetSuite confirmation", description: "Requires independent approval permission. Resolves native authority first, confirms custbodyid_firma_rc in NetSuite, then updates only the authoritative database and records audit." })
    @ApiResponse({ status: 503, description: "Integration unavailable or local reconciliation required. ERP and MySQL do not share a transaction." })
    approve(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.service.approve(request.cookies[SESSION_COOKIE_NAME], body);
    }
}
