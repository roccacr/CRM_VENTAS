import { Controller, Get, Header, Inject, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { SERVICE_UNAVAILABLE_RESPONSE } from "../http-error.responses.js";
import { RouteSecurity } from "../security/route-security.decorator.js";
import { HealthService } from "./health.service.js";

/**
 * Senales operativas publicas. No exponen configuracion, host, pool ni el
 * error de la dependencia: un balanceador no autentica y el cuerpo no puede
 * servir de reconocimiento.
 *
 * `Cache-Control: no-store` evita que un proxy congele un 200 con la base caida
 * o un 503 cuando ya recupero. `public` aqui significa sin sesion de acceso;
 * no abre el resto de la API.
 */
@Controller("health")
export class HealthController {
    /** Liveness no usa el servicio: readiness es el unico camino con IO. */
    constructor(@Inject(HealthService) private readonly health: HealthService) {}

    /**
     * Proceso vivo. Responder sin consultar MySQL distingue un event loop
     * trabado, que el supervisor debe reiniciar, de una base caida, que solo
     * debe retirar trafico.
     */
    @Get("live")
    @RouteSecurity("public")
    @Header("Cache-Control", "no-store")
    live() {
        return { status: "ok" };
    }

    /**
     * Disponibilidad nativa, nada mas. El 503 se escribe en la respuesta y se
     * devuelve la constante compartida, sin lanzar: una excepcion pasaria por
     * `SanitizedErrorFilter`, registraria un error de servidor y podria
     * sustituir este contrato. Un fallo de probe es senal de balanceo, no una
     * excepcion de negocio.
     */
    @Get("ready")
    @RouteSecurity("public")
    @Header("Cache-Control", "no-store")
    async ready(@Res({ passthrough: true }) response: FastifyReply) {
        const ready = await this.health.isReady();
        response.status(ready ? 200 : 503);
        return ready ? { status: "ready" } : SERVICE_UNAVAILABLE_RESPONSE;
    }
}
