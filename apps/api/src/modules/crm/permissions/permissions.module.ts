import { Module } from "@nestjs/common";

import { EffectivePermissionService } from "./effective-permission.service.js";

/**
 * Modulo de calculo de permisos.
 *
 * Exporta el servicio de permisos efectivos en memoria usado por identidad. El
 * filtrado SQL para listas futuras debe diseniarse por recurso, no improvisarse
 * aqui.
 */
@Module({
    providers: [EffectivePermissionService],
    exports: [EffectivePermissionService],
})
export class PermissionsModule {}
