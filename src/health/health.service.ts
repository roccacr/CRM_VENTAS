import { Injectable } from "@nestjs/common";

import { SERVICE_NAME } from "../config/http.constants";

/** Payload fijo de liveness. Sin I/O: no toca DB ni Kapso. */
export type HealthStatus = {
    readonly status: "ok";
    readonly service: typeof SERVICE_NAME;
    readonly timestamp: string;
};

/**
 * Construye el status de salud.
 *
 * No consulta MySQL ni Kapso: un 503 de DB no debe tumbar el probe de
 * orquestadores que solo preguntan "¿el proceso Nest responde?".
 */
@Injectable()
export class HealthService {
    getStatus(): HealthStatus {
        return {
            status: "ok",
            service: SERVICE_NAME,
            timestamp: new Date().toISOString(),
        };
    }
}
