import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

/**
 * Salud operativa publica, sin sesion.
 *
 * - `GET /health/live` solo confirma que el proceso HTTP responde. No toca
 *   base de datos: una caida de MySQL no debe hacer que el supervisor reinicie
 *   el proceso en bucle.
 * - `GET /health/ready` comprueba conectividad nativa con `SELECT 1`. No valida
 *   esquema, migraciones, legacy, Microsoft ni otros proveedores. Si falla, el
 *   balanceador retira trafico; no es senal de reinicio.
 *
 * El plazo de un segundo limita la respuesta HTTP, no cancela la consulta del
 * driver. Mientras esa consulta no termina, el proceso conserva un solo cupo y
 * las peticiones siguientes reciben 503 sin abrir probes nuevos.
 *
 * Importa solo `DatabaseModule`. No hay dependencia legacy: readiness no puede
 * crecer un proveedor oculto por estar declarada en este modulo. El registro
 * en `AppModule` pertenece a la composicion de la aplicacion.
 */
@Module({ imports: [DatabaseModule], controllers: [HealthController], providers: [HealthService] })
export class HealthModule {}
