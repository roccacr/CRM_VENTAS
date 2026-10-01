import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Put, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { ReplaceIdentityRolePermissionsDto, ReplaceIdentityUserAccessDto, UpdateIdentityRoleDto } from "./dto/access-management.dto.js";
import { IdentityAccessManagementService } from "./identity-access-management.service.js";
import { IDENTITY_CONTROLLER_PATH, IDENTITY_ROLE_DETAIL_ROUTE, IDENTITY_ROLE_PERMISSIONS_ROUTE, IDENTITY_SECURITY_CATALOG_ROUTE, IDENTITY_USER_ACCESS_ROUTE } from "./identity-route.constants.js";

/**
 * Endpoints administrativos para catalogos de seguridad.
 */
@ApiTags("identity")
@Controller(IDENTITY_CONTROLLER_PATH)
export class IdentityAccessManagementController {
    /**
     * Inyecta el caso de uso que valida sesion, permisos y persistencia.
     */
    constructor(@Inject(IdentityAccessManagementService) private readonly accessManagement: IdentityAccessManagementService) {}

    /**
     * Lee la matriz persistida de roles, modulos, permisos y auditoria.
     */
    @Get(IDENTITY_SECURITY_CATALOG_ROUTE)
    @ApiOperation({ summary: "Consultar catalogo de seguridad y auditoria reciente." })
    readSecurityCatalog(@Req() request: CookieRequest) {
        return this.accessManagement.readSecurityCatalog(request.cookies[SESSION_COOKIE_NAME]);
    }

    /**
     * Actualiza el nombre visible de un rol sin cambiar su codigo estable.
     */
    @Patch(IDENTITY_ROLE_DETAIL_ROUTE)
    @ApiOperation({ summary: "Renombrar rol del sistema." })
    @ApiBody({ type: UpdateIdentityRoleDto })
    updateRole(@Param("roleCode") roleCode: string, @Body() body: UpdateIdentityRoleDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.accessManagement.updateRole(request.cookies[SESSION_COOKIE_NAME], {
            ipAddress: request.ip,
            payload: body,
            roleCode,
            userAgent,
        });
    }

    /**
     * Lee los permisos activos de un rol.
     */
    @Get(IDENTITY_ROLE_PERMISSIONS_ROUTE)
    @ApiOperation({ summary: "Consultar permisos activos de un rol." })
    readRolePermissions(@Param("roleCode") roleCode: string, @Req() request: CookieRequest) {
        return this.accessManagement.readRolePermissions(request.cookies[SESSION_COOKIE_NAME], roleCode);
    }

    /**
     * Reemplaza los permisos activos de un rol.
     */
    @Put(IDENTITY_ROLE_PERMISSIONS_ROUTE)
    @ApiOperation({ summary: "Guardar permisos activos de un rol." })
    @ApiBody({ type: ReplaceIdentityRolePermissionsDto })
    replaceRolePermissions(@Param("roleCode") roleCode: string, @Body() body: ReplaceIdentityRolePermissionsDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.accessManagement.replaceRolePermissions(request.cookies[SESSION_COOKIE_NAME], {
            ipAddress: request.ip,
            payload: body,
            roleCode,
            userAgent,
        });
    }

    /**
     * Lee los roles, modulos y overrides directos de un usuario.
     */
    @Get(IDENTITY_USER_ACCESS_ROUTE)
    @ApiOperation({ summary: "Consultar acceso administrativo de un usuario." })
    readUserAccess(@Param("userPublicId") userPublicId: string, @Req() request: CookieRequest) {
        return this.accessManagement.readUserAccess(request.cookies[SESSION_COOKIE_NAME], userPublicId);
    }

    /**
     * Reemplaza roles, modulos visibles y overrides directos de un usuario.
     */
    @Put(IDENTITY_USER_ACCESS_ROUTE)
    @ApiOperation({ summary: "Guardar acceso administrativo de un usuario." })
    @ApiBody({ type: ReplaceIdentityUserAccessDto })
    replaceUserAccess(@Param("userPublicId") userPublicId: string, @Body() body: ReplaceIdentityUserAccessDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.accessManagement.replaceUserAccess(request.cookies[SESSION_COOKIE_NAME], {
            ipAddress: request.ip,
            payload: body,
            userAgent,
            userPublicId,
        });
    }

    /**
     * Elimina logicamente un rol solo cuando no tiene usuarios activos asignados.
     */
    @Delete(IDENTITY_ROLE_DETAIL_ROUTE)
    @HttpCode(200)
    @ApiOperation({ summary: "Eliminar rol si no esta asignado a usuarios." })
    deleteRole(@Param("roleCode") roleCode: string, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.accessManagement.deleteRole(request.cookies[SESSION_COOKIE_NAME], roleCode, request.ip, userAgent);
    }
}
