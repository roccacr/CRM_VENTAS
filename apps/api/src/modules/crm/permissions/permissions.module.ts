import { Module } from "@nestjs/common";

import { EffectivePermissionService } from "./effective-permission.service.js";

/**
 * Modulo de calculo de permisos.
 *
 * Exporta el servicio de permisos efectivos en memoria usado por identidad. No
 * tiene controlador ni abre un pool. El filtrado SQL de una lista se disena en
 * el recurso, no en este modulo.
 */
@Module({
    providers: [EffectivePermissionService],
    exports: [EffectivePermissionService],
})
export class PermissionsModule {}
