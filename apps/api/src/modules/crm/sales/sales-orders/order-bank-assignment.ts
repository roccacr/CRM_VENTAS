import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Header, HttpCode, HttpException, Inject, Injectable, Module, Param, Post, Req, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { canReadFormalizationOrder } from "../../../../common/security/route-permission.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { AuditModule } from "../../audit/audit.module.js";
import { BanksModule } from "../../banks/banks.module.js";
import { canUseBanks } from "../../banks/banks.permissions.js";
import { IdentityModule } from "../../identity/identity.module.js";
import { IdentityService } from "../../identity/identity.service.js";
import { OrderBankAssignmentRepository } from "./order-bank-assignment.repository.js";
import { orderTimingIdentity } from "./order-timing.contract.js";
export const bankAssignmentInput = z.strictObject({ bankPublicId: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/), advisorPublicId: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/), expectedVersion: z.number().int().min(0).max(4294967294), reason: z.string().trim().min(3).max(255) });
export const bankAssignmentUnlinkInput = z.strictObject({ expectedVersion: z.number().int().min(1).max(4294967294), reason: z.string().trim().min(3).max(255) });
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value);
    if (!result.success) throw new BadRequestException("Solicitud bancaria inválida.");
    return result.data;
}
/** Autoriza contra el perfil actual y las capacidades de catálogo que ya existen. */
@Injectable()
export class OrderBankAssignmentService {
    /** Usa servicios inyectados para conservar los límites de identidad, catálogo y auditoría. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(OrderBankAssignmentRepository) private readonly repository: OrderBankAssignmentRepository,
    ) {}
    private async authorize(session: string | undefined, action: "read" | "update") {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile) || !canUseBanks(profile, "formalizacion", action)) throw new ForbiddenException("No tiene permiso para gestionar el banco de la orden.");
        return profile;
    }
    /** Consulta la asignación sin escribir en la orden ni en su bitácora. */
    async read(session: string | undefined, identity: unknown) {
        await this.authorize(session, "read");
        const target = parse(orderTimingIdentity, identity);
        return this.safely(() => this.repository.read(target));
    }
    /** Guarda una asignación autorizada con control optimista de versión. */
    async change(session: string | undefined, identity: unknown, body: unknown) {
        const profile = await this.authorize(session, "update");
        const target = parse(orderTimingIdentity, identity);
        const command = parse(bankAssignmentInput, body);
        return this.safely(() => this.repository.change(target, { ...command, actorPublicId: profile.user.publicId }));
    }
    /** Desvincula sin perder la versión ni el historial de la asignación. */
    async unlink(session: string | undefined, identity: unknown, body: unknown) {
        const profile = await this.authorize(session, "update");
        const target = parse(orderTimingIdentity, identity);
        const command = parse(bankAssignmentUnlinkInput, body);
        return this.safely(() => this.repository.unlink(target, { ...command, actorPublicId: profile.user.publicId }));
    }
    private async safely<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof HttpException) throw error;
            if (error instanceof Error && ["ER_DUP_ENTRY", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(String(Reflect.get(error, "code")))) throw new ConflictException("La orden cambió; recarga antes de continuar.");
            throw new ServiceUnavailableException("No fue posible gestionar la asignación bancaria.");
        }
    }
}
/** Solo la asignación central. No muta los campos comerciales de la orden. */
@Controller("formalization/orders/:source/:id/bank-assignment")
export class OrderBankAssignmentController {
    /** Usa servicios inyectados para conservar los límites de identidad, catálogo y auditoría. */
    constructor(@Inject(OrderBankAssignmentService) private readonly service: OrderBankAssignmentService) {}
    /** Usa servicios inyectados para conservar los límites de identidad, catálogo y auditoría. */
    @Get()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    read(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.read(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** Usa servicios inyectados para conservar los límites de identidad, catálogo y auditoría. */
    @Post()
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    change(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        return this.service.change(request.cookies[SESSION_COOKIE_NAME], { source, id }, body);
    }
    /** Conserva el control de acceso y concurrencia de la asignación. */
    @Post("unlink")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    unlink(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        return this.service.unlink(request.cookies[SESSION_COOKIE_NAME], { source, id }, body);
    }
}
/** Usa servicios inyectados para conservar los límites de identidad, catálogo y auditoría. */
@Module({ imports: [IdentityModule, AuditModule, BanksModule], controllers: [OrderBankAssignmentController], providers: [OrderBankAssignmentService, OrderBankAssignmentRepository] })
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Nest module metadata owns registration.
export class OrderBankAssignmentModule {}
