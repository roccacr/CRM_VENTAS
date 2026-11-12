import { Body, Controller, Get, Header, HttpCode, Inject, Param, Post, Query, Req, ValidationPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { ContractTransitionDto } from "./contract-transition.dto.js";
import { ContractTransitionService } from "./contract-transition.service.js";

/** El cuerpo es estricto. Una propiedad desconocida se rechaza; no se descarta en silencio. */
// El tipo explícito conserva la validación en tsx y esbuild, que no emiten los metadatos del parámetro.
const bodyValidation = new ValidationPipe({ expectedType: ContractTransitionDto, transform: true, whitelist: true, forbidNonWhitelisted: true });

/** Exige los guards ya existentes de sesión, permiso y CSRF cuando el módulo está cableado. */
@ApiTags("Formalization contracts")
@Controller("formalization/contracts")
export class ContractTransitionController {
    /** Toda mutación pasa por el servicio de aplicación autorizado con la sesión. */
    constructor(@Inject(ContractTransitionService) private readonly service: ContractTransitionService) {}

    /** Registra solo la evidencia de envío del CRM. No manda correo ni llama al ERP. */
    @Post("send")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.contracts.send"] })
    @ApiOperation({ summary: "Record contract send" })
    send(@Req() request: CookieRequest, @Body(bodyValidation) body: ContractTransitionDto) {
        return this.service.transition(request.cookies[SESSION_COOKIE_NAME], "send", body, this.context(request));
    }

    /** Agrega una reversa con motivo. No borra ningún evento anterior. */
    @Post("revert")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.contracts.revert"] })
    @ApiOperation({ summary: "Revert contract send" })
    revert(@Req() request: CookieRequest, @Body(bodyValidation) body: ContractTransitionDto) {
        return this.service.transition(request.cookies[SESSION_COOKIE_NAME], "revert", body, this.context(request));
    }

    /** Metadatos de red para la bitácora. El user agent se recorta para acotar lo que se guarda. */
    private context(request: CookieRequest) {
        const userAgent = request.headers["user-agent"];
        return { ipAddress: request.ip, ...(typeof userAgent === "string" ? { userAgent: userAgent.slice(0, 500) } : {}) };
    }
}

/** Los cambios de etapa elegidos comparten el escritor transaccional existente y los guards globales. */
@ApiTags("Formalization orders")
@Controller("formalization/orders")
export class FormalizationStageController {
    /** Las cifras son agregados reales; un error de esquema no se presenta como cero. */
    @Get("finiquito/overview")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    finiquitoOverview(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.finiquitoOverview(request.cookies[SESSION_COOKIE_NAME], query);
    }
    /** La rama independiente deja igual la etapa comercial y sus tiempos. */
    @Get("finiquito")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @ApiOperation({ summary: "Read the independent lost-sale finiquito branch" })
    finiquito(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.finiquito(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Registra pasos ordinarios o una reconciliación manual de etapa con motivo; no manda correos. */
    @Post("finiquito")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.stage.update"] })
    @ApiOperation({ summary: "Record finiquito steps or manually reconcile its stage with a reason" })
    updateFiniquito(@Req() request: CookieRequest, @Body() body: unknown) {
        const userAgent = request.headers["user-agent"];
        return this.service.finiquito(request.cookies[SESSION_COOKIE_NAME], body, true, { ipAddress: request.ip, ...(typeof userAgent === "string" ? { userAgent: userAgent.slice(0, 500) } : {}) });
    }

    /** Entrega una versión fresca de la bitácora central antes de editar. */
    @Get(":source/:id/purchase-funds")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.stage.update"] })
    purchaseFundsSnapshot(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.purchaseFundsSnapshot(request.cookies[SESSION_COOKIE_NAME], source, id);
    }
    /** Guarda la clasificación de fondos. No envía el contrato ni avanza el flujo. */
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
    /** Reutiliza los comandos de etapa autenticados. No abre un segundo camino de persistencia. */
    constructor(@Inject(ContractTransitionService) private readonly service: ContractTransitionService) {}

    /** No envía comunicaciones ni cambia las banderas de aprobación del ERP. */
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
