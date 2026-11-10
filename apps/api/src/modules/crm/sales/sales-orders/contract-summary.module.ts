import { Controller, Get, Header, Inject, Module, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { ApprovalSummaryModule } from "./approval-summary.module.js";
import { ContractSummaryRepository } from "./contract-summary.repository.js";
import { ContractSummaryService } from "./contract-summary.service.js";

/** Solo conteos del inicio. En este corte no hay lista ni endpoints de mutación. */
@Controller("formalization/contracts")
export class ContractSummaryController {
    /** Delega en el caso de uso la membresía, que no depende del recurso. */
    constructor(@Inject(ContractSummaryService) private readonly service: ContractSummaryService) {}

    /** JSON agregado global del banner permitido. */
    @Get("summary")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-read" })
    @Header("Cache-Control", "no-store")
    summary(@Req() request: CookieRequest) {
        return this.service.summary(request.cookies[SESSION_COOKIE_NAME]);
    }
}

/** Reutiliza la búsqueda de aprobaciones en la que la identidad nativa tapa lo viejo. */
@Module({ imports: [IdentityModule, ApprovalSummaryModule], controllers: [ContractSummaryController], providers: [ContractSummaryRepository, ContractSummaryService] })
export class ContractSummaryModule {}
