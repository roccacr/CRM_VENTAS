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

/** Autoriza la sesión viva antes de resolver cualquiera de las dos bases o confirmar la marca del ERP. */
@Injectable()
export class FormalizationApprovalService {
    /** Un llamador interno también usa la sesión viva. Ni el nombre del rol ni una bandera del cliente conceden la aprobación. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(FormalizationApprovalRepository) private readonly repository: FormalizationApprovalRepository,
    ) {}

    /** El permiso de leer el banner no autoriza esta mutación. Un deny individual sigue ganando. */
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

/** Sesión, CSRF y permiso globales corren antes del servicio del comando. */
@ApiTags("Formalization orders")
@Controller("formalization/orders")
export class FormalizationApprovalController {
    /** Reutiliza la autorización viva de la aplicación para HTTP y para llamadas internas. */
    constructor(@Inject(FormalizationApprovalService) private readonly service: FormalizationApprovalService) {}

    /** Confirma primero la marca del ERP y después confirma juntas la aprobación local y la bitácora. */
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
