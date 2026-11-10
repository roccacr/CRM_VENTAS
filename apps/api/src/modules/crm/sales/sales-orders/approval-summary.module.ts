import { Controller, Get, Header, Inject, Module, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { ApprovalSummaryRepository } from "./approval-summary.repository.js";
import { ApprovalSummaryService } from "./approval-summary.service.js";

/** Solo se expone la lectura del resumen. No hay mutaciones del ciclo de vida. */
@Controller("formalization/approvals")
export class ApprovalSummaryController {
    /** Delega autenticación y autorización en el caso de uso. */
    constructor(@Inject(ApprovalSummaryService) private readonly service: ApprovalSummaryService) {}

    /** Respuesta agregada que comparten todas las fuentes configuradas. */
    @Get("summary")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.home.approvals.read"] })
    @Header("Cache-Control", "no-store")
    summary(@Req() request: CookieRequest) {
        return this.service.summary(request.cookies[SESSION_COOKIE_NAME]);
    }
}

/** Cableado mínimo del banner de aprobación ya autorizado. */
@Module({ imports: [IdentityModule], controllers: [ApprovalSummaryController], providers: [ApprovalSummaryService, ApprovalSummaryRepository], exports: [ApprovalSummaryRepository] })
export class ApprovalSummaryModule {}
