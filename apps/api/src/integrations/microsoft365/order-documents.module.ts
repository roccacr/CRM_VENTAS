import { Body, Controller, Get, Header, HttpCode, Inject, Module, Param, Post, Req } from "@nestjs/common";

import type { CookieRequest } from "../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../common/security/http-security.constants.js";
import { RequirePermission } from "../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../common/security/route-security.decorator.js";
import { AuditModule } from "../../modules/crm/audit/audit.module.js";
import { IdentityModule } from "../../modules/crm/identity/identity.module.js";
import { NetsuiteModule } from "../netsuite/netsuite.module.js";
import { OrderDocumentsGraph } from "./order-documents.graph.js";
import { OrderDocumentsService } from "./order-documents.service.js";
/** Frontera HTTP de documentos: sesión, permiso de orden y CSRF global en mutaciones. */
@Controller("formalization/orders/:source/:id/documents")
export class OrderDocumentsController {
    /** Delega las comprobaciones documentales y de recurso al caso de uso. */
    constructor(@Inject(OrderDocumentsService) private readonly service: OrderDocumentsService) {}
    /** Consulta los archivos de una orden autorizada. */
    @Get("")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    list(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.list(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** Crea la carpeta documental de la orden bajo demanda. */
    @Post("folder")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    create(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.create(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** Solicita vista previa o descarga de un archivo de esta carpeta. */
    @Post("link")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    link(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        return this.service.link(request.cookies[SESSION_COOKIE_NAME], { source, id }, body);
    }
    /** Inicia una carga fragmentada con una autorización cifrada. */
    @Post("uploads")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    start(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        return this.service.start(request.cookies[SESSION_COOKIE_NAME], { source, id }, body);
    }
    /** Sube un fragmento sin aceptar destinos externos aportados por el navegador. */
    @Post("uploads/chunk")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    chunk(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        return this.service.chunk(request.cookies[SESSION_COOKIE_NAME], { source, id }, body);
    }
}
/** Registra la integración documental con identidad y resolución de órdenes existentes. */
@Module({ imports: [IdentityModule, NetsuiteModule, AuditModule], controllers: [OrderDocumentsController], providers: [OrderDocumentsService, OrderDocumentsGraph] })
export class OrderDocumentsModule {}
