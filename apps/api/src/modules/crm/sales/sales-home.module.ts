import { Controller, ForbiddenException, Get, Header, Inject, Module, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../identity/identity.module.js";
import { IdentityService } from "../identity/identity.service.js";
import { canEnterSales, SALES_HOME_PERMISSION } from "./sales-access.js";

/** Inicio vacío de Ventas; no habilita lectores ni comandos del CRM anterior. */
@Controller("sales/home")
export class SalesHomeController {
    /** Reutiliza la identidad BFF, sin otro pool ni sesión. */
    constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

    /** Confirma el acceso efectivo a la única sección de Ventas. */
    @Get()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: [SALES_HOME_PERMISSION] })
    @Header("Cache-Control", "no-store")
    async read(@Req() request: CookieRequest) {
        const profile = await this.identity.getCurrentUser(request.cookies[SESSION_COOKIE_NAME]);
        if (!canEnterSales(profile)) throw new ForbiddenException("No tienes acceso al módulo Ventas.");
        return { module: "ventas", sections: ["home"] } as const;
    }
}

/** Composición del Inicio de Ventas, independiente de las órdenes de Formalización. */
@Module({ imports: [IdentityModule], controllers: [SalesHomeController] })
export class SalesHomeModule {}
