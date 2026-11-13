import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Header, HttpCode, HttpException, Inject, Injectable, Module, Post, Query, Req, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { canReadFormalizationOrder } from "../../../../common/security/route-permission.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { AuditModule } from "../../audit/audit.module.js";
import { calendarAccess } from "../../calendar/calendar-access.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { IdentityService } from "../../identity/identity.service.js";
import type { IdentityProfile } from "../../identity/identity.types.js";
import { formalizationPermissionScope } from "./follow-up.service.js";
import { orderTimingIdentity } from "./order-timing.contract.js";
import { SalesOrderAddendumRepository } from "./sales-order-addendum.repository.js";

const identityInput = z.strictObject({ source: z.enum(["native", "legacy"]), id: z.string() });
const changeInput = identityInput.extend({ status: z.enum(["completed", "cancelled"]), expectedVersion: z.number().int().min(0).max(4294967294), operationId: z.uuid() });
const sentInput = changeInput.omit({ status: true });
const pendingInput = sentInput.extend({ note: z.string().trim().min(3).max(2000) });
const selectionInput = z.strictObject({ orders: z.array(identityInput).min(1).max(100) });
const futureInput = identityInput.extend({
    excludeEventId: z
        .string()
        .regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
        .optional(),
});
const permission = "formalizacion.orders.addendum.update";
const markPermission = "formalizacion.orders.addendum.mark_pending";
const readPermission = "formalizacion.orders.addendum.read";
const summaryPermission = "formalizacion.home.addendum.read";
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value);
    if (!result.success) throw new BadRequestException("Solicitud de adéndum inválida.");
    return result.data;
}

/** El marcador pertenece a la orden y no modifica el estado del evento ni del lead. */
@Injectable()
export class SalesOrderAddendumService {
    /**
     *
     */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(SalesOrderAddendumRepository) private readonly repository: SalesOrderAddendumRepository,
    ) {}

    /**
     *
     */
    async read(session: string | undefined, input: unknown) {
        const { profile, canUpdate, canMarkPending } = await this.authorize(session);
        this.requireMarkerRead(profile);
        const target = parse(orderTimingIdentity, parse(identityInput, input));
        return this.safely(async () => ({ ...this.repository.result(await this.repository.read(target)), canUpdate, canMarkPending, canMarkSent: true }));
    }

    /**
     *
     */
    async change(session: string | undefined, input: unknown) {
        const { profile, canUpdate, canMarkPending } = await this.authorize(session);
        this.requireMarkerRead(profile);
        if (!canUpdate) throw new ForbiddenException("No tiene permiso para gestionar el estado del adéndum.");
        const command = parse(changeInput, input);
        const target = parse(orderTimingIdentity, command);
        return this.safely(async () => ({ ...(await this.repository.change({ ...command, ...target, actorPublicId: profile.user.publicId })), canUpdate, canMarkPending, canMarkSent: true }));
    }

    /** Registrar envío solo requiere lectura efectiva; no envía correo ni modifica etapas. */
    async markSent(session: string | undefined, input: unknown) {
        const { profile, canUpdate, canMarkPending } = await this.authorize(session);
        this.requireMarkerRead(profile);
        const command = parse(sentInput, input);
        const target = parse(orderTimingIdentity, command);
        return this.safely(async () => ({ ...(await this.repository.change({ ...command, ...target, status: "sent", actorPublicId: profile.user.publicId })), canUpdate, canMarkPending, canMarkSent: true }));
    }

    /** El permiso exacto viene del perfil vigente; Owner no sustituye una asignación de esta capacidad. */
    async markPending(session: string | undefined, input: unknown) {
        return this.markPendingOrder(session, input, false);
    }

    /** La selección masiva renueva también un pendiente existente, sin omitir controles de integridad. */
    async markPendingBulkItem(session: string | undefined, input: unknown) {
        return this.markPendingOrder(session, input, true);
    }

    /** Consulta previa acotada: reutiliza la lectura vigente sin una petición HTTP por orden. */
    async previewPendingSelection(session: string | undefined, input: unknown) {
        const { profile, canUpdate, canMarkPending } = await this.authorize(session);
        this.requireMarkerRead(profile);
        if (!canMarkPending) throw new ForbiddenException("No tiene permiso para marcar un adéndum pendiente.");
        const { orders } = parse(selectionInput, input);
        const targets = orders.map((order) => parse(orderTimingIdentity, order));
        const items = [];
        for (const target of targets) {
            try {
                const order = await this.safely(() => this.repository.read(target));
                items.push({ ...target, order: { ...this.repository.result(order), availableForPending: order.active, canUpdate, canMarkPending, canMarkSent: true } });
            } catch {
                items.push({ ...target, order: null });
            }
        }
        return { items };
    }

    private async markPendingOrder(session: string | undefined, input: unknown, renewPending: boolean) {
        const { profile, canUpdate, canMarkPending } = await this.authorize(session);
        this.requireMarkerRead(profile);
        if (!canMarkPending) throw new ForbiddenException("No tiene permiso para marcar un adéndum pendiente.");
        const command = parse(pendingInput, input);
        const target = parse(orderTimingIdentity, command);
        const mark = { ...command, ...target, actorPublicId: profile.user.publicId, note: command.note };
        return this.safely(async () => ({ ...(await (renewPending ? this.repository.markManually(mark, true) : this.repository.markManually(mark))), canUpdate, canMarkPending, canMarkSent: true }));
    }

    /**
     *
     */
    async future(session: string | undefined, input: unknown) {
        const { profile } = await this.authorize(session);
        const access = calendarAccess(profile, "formalizacion", "read");
        if (!access.allowed) throw new ForbiddenException("No tiene permiso para consultar el calendario de Formalización.");
        const query = parse(futureInput, input);
        const target = parse(orderTimingIdentity, query);
        return this.safely(() => this.repository.future(target, { actorPublicId: profile.user.publicId, broad: !access.ownOnly, ...(query.excludeEventId ? { excludeEventId: query.excludeEventId } : {}) }));
    }

    private async authorize(session: string | undefined) {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("No tiene permiso para consultar esta orden.");
        return { profile, canUpdate: formalizationPermissionScope(profile, permission).allowed, canMarkPending: formalizationPermissionScope(profile, markPermission).allowed };
    }

    private requireMarkerRead(profile: IdentityProfile): void {
        if (!formalizationPermissionScope(profile, readPermission).allowed) throw new ForbiddenException("No tiene permiso para consultar el adéndum de la orden.");
    }

    /** Ver el conteo no concede acceso a las órdenes ni a los datos del marcador. */
    async summary(session: string | undefined) {
        const profile = await this.identity.getCurrentUser(session);
        if (!formalizationPermissionScope(profile, summaryPermission).allowed) throw new ForbiddenException("No tiene permiso para consultar el banner de adéndum.");
        return this.safely(() => this.repository.summary());
    }

    private async safely<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof HttpException) throw error;
            if (error instanceof Error && ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(String(Reflect.get(error, "code")))) throw new ConflictException("La orden está siendo actualizada; recarga y reintenta la operación.");
            throw new ServiceUnavailableException("No fue posible gestionar el adéndum de la orden.");
        }
    }
}

/**
 *
 */
@ApiTags("Formalization orders")
@Controller("formalization/orders/addendum")
export class SalesOrderAddendumController {
    /**
     *
     */
    constructor(@Inject(SalesOrderAddendumService) private readonly service: SalesOrderAddendumService) {}

    /**
     *
     */
    @Get()
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", readPermission] })
    @ApiOperation({ summary: "Read the order-level addendum marker" })
    read(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.read(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /**
     *
     */
    @Get("future")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @ApiOperation({ summary: "Check an existing future addendum before scheduling" })
    future(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.future(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /**
     *
     */
    @Post()
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", readPermission, permission] })
    @ApiOperation({ summary: "Complete or cancel the pending order addendum" })
    change(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.service.change(request.cookies[SESSION_COOKIE_NAME], body);
    }

    /** Registra evidencia de envío sin conceder capacidades administrativas. */
    @Post("sent")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", readPermission] })
    @ApiOperation({ summary: "Record the pending order addendum as sent without sending email" })
    markSent(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.service.markSent(request.cookies[SESSION_COOKIE_NAME], body);
    }

    /** Marca CRM independiente de la agenda; no dispara invitaciones ni modifica etapas. */
    @Post("pending")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", readPermission, markPermission] })
    @ApiOperation({ summary: "Mark the order addendum pending manually, without a calendar event" })
    markPending(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.service.markPending(request.cookies[SESSION_COOKIE_NAME], body);
    }

    /** Una transacción por orden permite resultados parciales y reintentos idempotentes de la selección. */
    @Post("pending/bulk-item")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", readPermission, markPermission] })
    @ApiOperation({ summary: "Mark one selected order pending, including renewal of an existing pending marker" })
    markPendingBulkItem(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.service.markPendingBulkItem(request.cookies[SESSION_COOKIE_NAME], body);
    }

    /** Solo lectura, protegida con los mismos grants y CSRF que la confirmación masiva. */
    @Post("pending/preview")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", readPermission, markPermission] })
    @ApiOperation({ summary: "Preview up to 100 selected addendum markers without changing orders" })
    previewPendingSelection(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.service.previewPendingSelection(request.cookies[SESSION_COOKIE_NAME], body);
    }
}

/** El banner solo devuelve un conteo; no concede lectura de las órdenes ni del marcador. */
@ApiTags("Formalization orders")
@Controller("formalization/addendum")
export class SalesOrderAddendumSummaryController {
    /** Comparte el autorizador para conservar el mismo criterio en el endpoint y en llamadas internas. */
    constructor(@Inject(SalesOrderAddendumService) private readonly service: SalesOrderAddendumService) {}

    /**
     *
     */
    @Get("summary")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: [summaryPermission] })
    @ApiOperation({ summary: "Read the independent pending addendum banner count" })
    /** La acción de abrir la bandeja requiere además su propio permiso de lectura. */
    summary(@Req() request: CookieRequest) {
        return this.service.summary(request.cookies[SESSION_COOKIE_NAME]);
    }
}

/**
 *
 */
@Module({ imports: [IdentityModule, AuditModule], controllers: [SalesOrderAddendumController, SalesOrderAddendumSummaryController], providers: [SalesOrderAddendumRepository, SalesOrderAddendumService], exports: [SalesOrderAddendumRepository] })
// El módulo de Nest vive en sus metadatos y no requiere estado ni métodos de instancia.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SalesOrderAddendumModule {}
