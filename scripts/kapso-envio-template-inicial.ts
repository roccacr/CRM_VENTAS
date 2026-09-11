import { NestFactory } from "@nestjs/core";

import { AppModule } from "../src/app.module";
import { DEFAULT_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE, ENVIO_TEMPLATE_INICIAL_CRONJOB_ID } from "../src/kapso-cronjobs/envio-template-inicial/envio-template-inicial.constants";
import { EnvioTemplateInicialService } from "../src/kapso-cronjobs/envio-template-inicial/envio-template-inicial.service";

async function main(): Promise<void> {
    process.env.KAPSO_ENVIO_TEMPLATE_INICIAL_ENABLED = "0";
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });

    try {
        const service = app.get(EnvioTemplateInicialService);
        const result = await service.runOnce(DEFAULT_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE);
        console.log(JSON.stringify({ cronjob: ENVIO_TEMPLATE_INICIAL_CRONJOB_ID, result }, null, 2));
    } finally {
        await app.close();
    }
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
