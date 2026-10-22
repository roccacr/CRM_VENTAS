import { Controller, Get, Header, Inject, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { SERVICE_UNAVAILABLE_RESPONSE } from "../http-error.responses.js";
import { RouteSecurity } from "../security/route-security.decorator.js";
import { HealthService } from "./health.service.js";

/** Public operational signals expose no configuration or dependency diagnostics. */
@Controller("health")
export class HealthController {
    /** Native readiness uses the shared probe; liveness performs no IO. */
    constructor(@Inject(HealthService) private readonly health: HealthService) {}

    /** Confirms the HTTP process is alive without touching the database. */
    @Get("live")
    @RouteSecurity("public")
    @Header("Cache-Control", "no-store")
    live() {
        return { status: "ok" };
    }

    /** Returns only availability; raw database errors never enter HTTP or logging. */
    @Get("ready")
    @RouteSecurity("public")
    @Header("Cache-Control", "no-store")
    async ready(@Res({ passthrough: true }) response: FastifyReply) {
        const ready = await this.health.isReady();
        response.status(ready ? 200 : 503);
        return ready ? { status: "ready" } : SERVICE_UNAVAILABLE_RESPONSE;
    }
}
