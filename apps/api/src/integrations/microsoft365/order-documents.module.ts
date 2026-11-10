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
/** Frontera HTTP. La ruta exige permiso de orden; el caso de uso exige ademas el permiso documental. Mutar pasa por el CSRF global. La respuesta no se guarda. */
@Controller("formalization/orders/:source/:id/documents")
export class OrderDocumentsController {
    /** La sesion sale de la cookie. El cuerpo no se valida aqui. */
    constructor(@Inject(OrderDocumentsService) private readonly service: OrderDocumentsService) {}
    /** Listar no crea la carpeta. */
    @Get("")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    list(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.list(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** Alta expresa. Responde 200, no 201: la carpeta puede ya existir. */
    @Post("folder")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    create(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.create(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** El enlace es una lectura. El POST no escribe el archivo, por eso no pide el permiso de escritura documental. */
    @Post("link")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    link(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        return this.service.link(request.cookies[SESSION_COOKIE_NAME], { source, id }, body);
    }
    /** Devuelve un ticket cifrado. La URL de carga no sale en claro. */
    @Post("uploads")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    start(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        return this.service.start(request.cookies[SESSION_COOKIE_NAME], { source, id }, body);
    }
    /** El navegador no elige el destino. El ticket ya trae la URL que el servidor acepto. */
    @Post("uploads/chunk")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    chunk(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        return this.service.chunk(request.cookies[SESSION_COOKIE_NAME], { source, id }, body);
    }
}
/** Identidad, NetSuite y auditoria entran porque la orden se resuelve antes de llamar a Graph. */
@Module({ imports: [IdentityModule, NetsuiteModule, AuditModule], controllers: [OrderDocumentsController], providers: [OrderDocumentsService, OrderDocumentsGraph] })
export class OrderDocumentsModule {}
