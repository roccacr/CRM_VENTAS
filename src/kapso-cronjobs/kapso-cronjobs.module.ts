import { Module } from "@nestjs/common";

import { EnvioTemplateInicialModule } from "./envio-template-inicial/envio-template-inicial.module";

/**
 * Agrega cronjobs Kapso. Cada flujo vive en su propia carpeta/modulo:
 * este archivo solo los importa para que `AppModule` no crezca.
 */
@Module({
    imports: [EnvioTemplateInicialModule],
})
export class KapsoCronjobsModule {}
