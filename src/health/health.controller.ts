import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { SERVICE_NAME } from "../config/http.constants";
import { HealthService, HealthStatus } from "./health.service";

/**
 * `GET /api/v1/health` — probe de liveness (`GLOBAL_API_PREFIX` + `health`).
 * Publico (sin auth): lo consumen load balancers y Playwright.
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get()
    @ApiOkResponse({
        description: "API health status.",
        schema: {
            example: {
                status: "ok",
                service: SERVICE_NAME,
                timestamp: "2026-08-13T18:00:00.000Z",
            },
        },
    })
    getHealth(): HealthStatus {
        return this.healthService.getStatus();
    }
}
