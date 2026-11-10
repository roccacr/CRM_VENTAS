import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query, Req, type Type, ValidationPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { BankAdvisorIdDto, BankContextDto, BankIdDto, BankStatusDto, CreateBankAdvisorDto, CreateBankDto, ListBanksQueryDto, UpdateBankAdvisorDto, UpdateBankDto } from "./banks.dto.js";
import { BanksService } from "./banks.service.js";
/** El tipo va explícito: sin metadata emitida el pipe no valida. Un campo de más se rechaza. */
const validateInput = (expectedType: Type<unknown>) => new ValidationPipe({ expectedType, transform: true, whitelist: true, forbidNonWhitelisted: true });

/** Rutas propias de banco y ejecutivo. No salen campos del ERP ni llaves numéricas. */
@ApiTags("banks")
@Controller("catalogs/banks/items")
export class BanksController {
    /** La sesión sale de la cookie. El permiso de ruta es la primera puerta; el servicio vuelve a evaluar el deny. */
    constructor(@Inject(BanksService) private readonly banks: BanksService) {}
    /** Devuelve la página que pidió el servidor, ya filtrada. */
    @Get()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "read" })
    @ApiOperation({ summary: "Listar bancos." })
    list(@Query(validateInput(ListBanksQueryDto)) query: ListBanksQueryDto, @Req() request: CookieRequest) {
        return this.banks.listBanks(request.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Consulta el banco por su ULID público. */
    @Get(":bankId")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "read" })
    @ApiOperation({ summary: "Consultar banco." })
    get(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Query(validateInput(BankContextDto)) query: BankContextDto, @Req() request: CookieRequest) {
        return this.banks.getBank(request.cookies[SESSION_COOKIE_NAME], ids.bankId, query);
    }
    /** Crea el banco con el motivo que va a la bitácora. La IP y el agente salen de la petición. */
    @Post()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "create" })
    @ApiOperation({ summary: "Crear banco." })
    create(@Body(validateInput(CreateBankDto)) body: CreateBankDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.createBank(request.cookies[SESSION_COOKIE_NAME], body, { ipAddress: request.ip, userAgent });
    }
    /** Edita el banco solo si la versión del cuerpo sigue siendo la de la fila. */
    @Patch(":bankId")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "update" })
    @ApiOperation({ summary: "Editar banco." })
    update(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Body(validateInput(UpdateBankDto)) body: UpdateBankDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.updateBank(request.cookies[SESSION_COOKIE_NAME], ids.bankId, body, { ipAddress: request.ip, userAgent });
    }
    /** Activo exige actualizar e inactivo exige inactivar. El estado de los ejecutivos no se arrastra. */
    @Patch(":bankId/status")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "status" })
    @ApiOperation({ summary: "Cambiar estado de banco." })
    status(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Body(validateInput(BankStatusDto)) body: BankStatusDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.bankStatus(request.cookies[SESSION_COOKIE_NAME], ids.bankId, body, { ipAddress: request.ip, userAgent });
    }
    /** Lista ejecutivos del banco de la ruta, no de otro. */
    @Get(":bankId/advisors")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "read" })
    @ApiOperation({ summary: "Listar ejecutivos del banco." })
    advisors(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Query(validateInput(ListBanksQueryDto)) query: ListBanksQueryDto, @Req() request: CookieRequest) {
        return this.banks.listAdvisors(request.cookies[SESSION_COOKIE_NAME], ids.bankId, query);
    }
    /** El alta se pide aquí. Que el banco esté activo se confirma al persistir. */
    @Post(":bankId/advisors")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "create" })
    @ApiOperation({ summary: "Crear ejecutivo del banco." })
    createAdvisor(@Param(validateInput(BankIdDto)) ids: BankIdDto, @Body(validateInput(CreateBankAdvisorDto)) body: CreateBankAdvisorDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.createAdvisor(request.cookies[SESSION_COOKIE_NAME], ids.bankId, body, { ipAddress: request.ip, userAgent });
    }
    /** Edita el contacto. La ruta fija el banco y el cuerpo no lo cambia. */
    @Patch(":bankId/advisors/:advisorId")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "update" })
    @ApiOperation({ summary: "Editar ejecutivo sin trasladarlo de banco." })
    updateAdvisor(@Param(validateInput(BankAdvisorIdDto)) ids: BankAdvisorIdDto, @Body(validateInput(UpdateBankAdvisorDto)) body: UpdateBankAdvisorDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.updateAdvisor(request.cookies[SESSION_COOKIE_NAME], ids, body, { ipAddress: request.ip, userAgent });
    }
    /** Cambia solo el estado del ejecutivo, con la versión que el cliente leyó. */
    @Patch(":bankId/advisors/:advisorId/status")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "catalog", catalog: "banks", action: "status" })
    @ApiOperation({ summary: "Cambiar estado de ejecutivo." })
    advisorStatus(@Param(validateInput(BankAdvisorIdDto)) ids: BankAdvisorIdDto, @Body(validateInput(BankStatusDto)) body: BankStatusDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.banks.advisorStatus(request.cookies[SESSION_COOKIE_NAME], ids, body, { ipAddress: request.ip, userAgent });
    }
}
