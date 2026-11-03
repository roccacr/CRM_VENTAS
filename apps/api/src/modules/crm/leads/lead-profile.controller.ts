import { Controller, Get, Header, Inject, Query, Req } from "@nestjs/common";
import { ApiBadRequestResponse, ApiConflictResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { LEAD_PROFILE_PERMISSION, LEAD_PROFILE_RESPONSE_SCHEMA, LeadProfileQueryDto } from "./lead-profile.contract.js";
import { LeadProfileService } from "./lead-profile.service.js";

/** Frontera HTTP del perfil completo, protegida antes de acceder a sus fuentes. */
@ApiTags("Leads")
@Controller("leads")
export class LeadProfileController {
    /** Inyección explícita compatible con el runtime tsx y las pruebas. */
    constructor(@Inject(LeadProfileService) private readonly service: LeadProfileService) {}

    /** La autorización y no-store impiden usar esta consulta como acceso alternativo al lead. */
    @Get("profile")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: [LEAD_PROFILE_PERMISSION] })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Consultar el perfil completo del lead", description: "Lectura federada sin importación. Valores nativos prevalecen; legacyValue conserva discrepancias. Historial por cursor; órdenes, oportunidades y estimaciones reales por página de 50. Las colecciones comerciales informan total y disponibilidad por origen. Requiere lead.profile.read global, con deny prevaleciente." })
    @ApiQuery({ name: "source", enum: ["native", "legacy"], required: true })
    @ApiQuery({ name: "id", type: String, description: "PublicId nativo o PK legacy sin prefijo", required: true })
    @ApiQuery({ name: "cursor", type: String, required: false })
    @ApiQuery({ name: "orderPage", type: String, required: false, description: "Página de órdenes, oportunidades y estimaciones desde 1" })
    @ApiOkResponse({ description: "Perfil canónico unificado v1", schema: LEAD_PROFILE_RESPONSE_SCHEMA })
    @ApiBadRequestResponse({ description: "Origen, identificador o paginación inválidos" })
    @ApiForbiddenResponse({ description: "Acceso denegado" })
    @ApiNotFoundResponse({ description: "Lead no encontrado" })
    @ApiConflictResponse({ description: "La relación entre fuentes es ambigua" })
    @ApiServiceUnavailableResponse({ description: "Una fuente no está disponible; no se entrega un perfil parcial" })
    read(@Req() request: CookieRequest, @Query() query: LeadProfileQueryDto) {
        return this.service.read(request.cookies[SESSION_COOKIE_NAME], query);
    }
}
