import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

/**
 * Public, no-store GET /health/live (process only) and /health/ready (native SELECT 1).
 * Readiness is connectivity, not schema/migration or external-provider validation.
 * Its one-second response deadline does not cancel a stuck driver query; one slot
 * remains occupied until settlement, limiting background work to one probe per process.
 * AppModule registration is owned by the composition task; no legacy dependency.
 */
@Module({ imports: [DatabaseModule], controllers: [HealthController], providers: [HealthService] })
export class HealthModule {}
