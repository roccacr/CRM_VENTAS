import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

/**
 * Health-check de liveness (proceso Nest vivo).
 *
 * No valida MySQL ni Kapso a proposito: un 503 de DB no debe tumbar el probe
 * de orquestadores que solo preguntan "¿el proceso responde?".
 */
@Module({
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
