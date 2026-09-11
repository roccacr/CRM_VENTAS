import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { APP_ENV_KEYS } from "../../config/app-config.constants";
import { DEFAULT_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE, DEFAULT_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS, ENVIO_TEMPLATE_INICIAL_CRONJOB_ID, ENVIO_TEMPLATE_INICIAL_ENV_KEYS } from "./envio-template-inicial.constants";
import { toErrorMessage } from "./envio-template-inicial.mapping";
import { EnvioTemplateInicialService } from "./envio-template-inicial.service";

/**
 * Runner automatico del cronjob `envio_template_inicial`.
 *
 * Queda apagado por default y solo corre cuando `KAPSO_ENVIO_TEMPLATE_INICIAL_ENABLED=1`.
 * Usa `setTimeout` encadenado (no `setInterval`) para que nunca haya dos
 * `runOnce` solapados: el siguiente ciclo arranca cuando el anterior termina.
 */
@Injectable()
export class EnvioTemplateInicialRunner implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(EnvioTemplateInicialRunner.name);
    private timer: NodeJS.Timeout | null = null;

    // Evita reprogramar un ciclo si Nest ya inicio el shutdown.
    private isShuttingDown = false;

    constructor(
        private readonly configService: ConfigService,
        @Inject(EnvioTemplateInicialService)
        private readonly service: EnvioTemplateInicialService,
    ) {}

    onApplicationBootstrap(): void {
        if (!this.shouldRunAutomatically()) {
            return;
        }

        this.scheduleNext(0);
    }

    onApplicationShutdown(): void {
        this.isShuttingDown = true;
        this.clearTimer();
    }

    /**
     * Agenda un solo ciclo. El `.finally` programa el siguiente despues de
     * terminar la corrida actual, manteniendo el cronjob serial y predecible.
     */
    private scheduleNext(delayMs: number): void {
        this.timer = setTimeout(() => {
            void this.runScheduled().finally(() => {
                if (this.isShuttingDown) {
                    return;
                }

                this.scheduleNext(this.readPositiveInteger(ENVIO_TEMPLATE_INICIAL_ENV_KEYS.INTERVAL_MS, DEFAULT_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS));
            });
        }, delayMs);
    }

    private async runScheduled(): Promise<void> {
        const batchSize = this.readPositiveInteger(ENVIO_TEMPLATE_INICIAL_ENV_KEYS.BATCH_SIZE, DEFAULT_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE);

        try {
            const result = await this.service.runOnce(batchSize);

            if (result.processed > 0 || result.status === "already_running") {
                this.logger.log({ cronjob: ENVIO_TEMPLATE_INICIAL_CRONJOB_ID, result });
            }
        } catch (error) {
            this.logger.error({
                cronjob: ENVIO_TEMPLATE_INICIAL_CRONJOB_ID,
                error: toErrorMessage(error),
            });
        }
    }

    private shouldRunAutomatically(): boolean {
        if (this.configService.get<string>(APP_ENV_KEYS.NODE_ENV) === "test") {
            return false;
        }

        // Sin API key no se agenda el timer: evitaria ciclos de 503 contra produccion.
        if (!this.configService.get<string>(ENVIO_TEMPLATE_INICIAL_ENV_KEYS.API_KEY)) {
            this.logger.warn(`${ENVIO_TEMPLATE_INICIAL_CRONJOB_ID} disabled: ${ENVIO_TEMPLATE_INICIAL_ENV_KEYS.API_KEY} is not configured`);
            return false;
        }

        return this.configService.get<string>(ENVIO_TEMPLATE_INICIAL_ENV_KEYS.ENABLED) === "1";
    }

    private readPositiveInteger(key: string, fallback: number): number {
        const value = Number(this.configService.get<string>(key));
        return Number.isInteger(value) && value > 0 ? value : fallback;
    }

    private clearTimer(): void {
        if (!this.timer) {
            return;
        }

        clearTimeout(this.timer);
        this.timer = null;
    }
}
