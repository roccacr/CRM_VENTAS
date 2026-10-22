import { Inject, Injectable } from "@nestjs/common";
import { CompiledQuery } from "kysely";

import { DatabaseService } from "../../database/database.service.js";

const READINESS_TIMEOUT_MS = 1_000;

/** Native connectivity only. Legacy and external providers do not gate readiness. */
@Injectable()
export class HealthService {
    private inFlight: Promise<boolean> | undefined;

    /** Reuses the native pool; never creates a health-specific connection pool. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /**
     * Shares one bounded result. A timed-out query retains its slot until it settles,
     * so a stuck pool cannot accumulate background probes on successive requests.
     * The response deadline does not cancel the underlying driver operation.
     */
    isReady(): Promise<boolean> {
        if (this.inFlight) return this.inFlight;
        let timer: ReturnType<typeof setTimeout>;
        const probe = Promise.resolve()
            .then(() => this.database.db.executeQuery(CompiledQuery.raw("SELECT 1")))
            .then(
                () => true,
                () => false,
            )
            .finally(() => {
                this.inFlight = undefined;
            });
        const timeout = new Promise<boolean>((resolve) => {
            timer = setTimeout(() => {
                resolve(false);
            }, READINESS_TIMEOUT_MS);
        });
        this.inFlight = Promise.race([probe, timeout]).finally(() => {
            clearTimeout(timer);
        });
        return this.inFlight;
    }
}
