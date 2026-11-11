import { Controller, Get, Inject, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { IdentityPresenceService } from "./identity-presence.service.js";

/** La presencia usa sesión BFF y el POST conserva la protección CSRF global. */
@ApiTags("identity")
@Controller("identity/presence")
export class IdentityPresenceController {
    /** Servicio de presencia separado del inicio de sesión. */
    constructor(@Inject(IdentityPresenceService) private readonly presence: IdentityPresenceService) {}

    /** No acepta IDs de usuario ni sesión en el cuerpo. */
    @Post("heartbeat")
    @RouteSecurity("authenticated")
    @ApiOperation({ summary: "Confirmar actividad del navegador autenticado." })
    heartbeat(@Req() request: CookieRequest) {
        return this.presence.heartbeat(request.cookies[SESSION_COOKIE_NAME]);
    }

    /** La autorización Owner se revalida en cada consulta, también por acceso directo. */
    @Get()
    @RouteSecurity("authenticated")
    @ApiOperation({ summary: "Consultar personas en línea; exclusivo de Owner." })
    list(@Req() request: CookieRequest) {
        return this.presence.list(request.cookies[SESSION_COOKIE_NAME]);
    }
}
