import { Controller, Get, Header, Inject, Module, Param, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { FollowUpRepository } from "./follow-up.repository.js";
import { FollowUpService } from "./follow-up.service.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { HomeSummaryService } from "./home-summary.service.js";
import { OrderTimingController } from "./order-timing.controller.js";
import { OrderTimingRepository } from "./order-timing.repository.js";
import { OrderTimingService } from "./order-timing.service.js";

/** Solo agregados del inicio. Las rutas de contrato y de aprobación conservan su contrato. */
@Controller("formalization/home")
export class HomeSummaryController {
    /** Delega en el servicio la membresía actual y la orquestación de la lectura. */
    constructor(@Inject(HomeSummaryService) private readonly service: HomeSummaryService) {}

    /** Actividad acotada del propio actor. Exige el permiso independiente de la orden y una sesión viva. */
    @Get("recent-activity")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    recentActivity(@Req() request: CookieRequest) {
        return this.service.recentActivity(request.cookies[SESSION_COOKIE_NAME]);
    }

    /** Devuelve agregados globales frescos. No habilita listas ni mutaciones. */
    @Get("summary")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-read" })
    @Header("Cache-Control", "no-store")
    summary(@Req() request: CookieRequest) {
        return this.service.summary(request.cookies[SESSION_COOKIE_NAME]);
    }

    /** Órdenes atrasadas por etapa (CRM nuevo). Se consulta aparte para no tocar el presupuesto del resumen. */
    @Get("overdue")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-read" })
    @Header("Cache-Control", "no-store")
    overdue(@Req() request: CookieRequest) {
        return this.service.overdue(request.cookies[SESSION_COOKIE_NAME]);
    }
}

/** El seguimiento vivo es de solo lectura. No habilita los comandos del detalle simulado. */
@Controller("formalization/home")
export class FollowUpController {
    /** El caso de uso es dueño de la autorización, el filtro y el acceso a los datos. */
    constructor(@Inject(FollowUpService) private readonly service: FollowUpService) {}

    /** Agregados globales frescos por proyecto. Los filtros de la consulta no están soportados. */
    @Get("project-distribution")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-read" })
    @Header("Cache-Control", "no-store")
    projectDistribution(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.projectDistribution(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** El caso de uso valida filtros y paginación antes del SQL. */
    @Get("follow-up")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-read" })
    @Header("Cache-Control", "no-store")
    list(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.list(request.cookies[SESSION_COOKIE_NAME], query);
    }
}

/** Restaura la identidad del detalle con independencia de las colas visibles del banner. */
@Controller("formalization/orders")
export class FormalizationOrderRecordController {
    /** Reutiliza la proyección existente con una autorización de detalle independiente. */
    constructor(@Inject(FollowUpService) private readonly service: FollowUpService) {}
    /** Devuelve un ítem directo de seguimiento. No expone los metadatos de la lista. */
    @Get(":source/:id/record")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    read(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.record(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
}

/** Registra resúmenes de inicio, seguimiento y tiempos por orden, todos de solo lectura. */
@Module({ imports: [IdentityModule], controllers: [HomeSummaryController, FollowUpController, FormalizationOrderRecordController, OrderTimingController], exports: [OrderTimingService], providers: [HomeSummaryRepository, HomeSummaryService, FollowUpRepository, FollowUpService, OrderTimingRepository, OrderTimingService] })
export class HomeSummaryModule {}
