import { Module } from "@nestjs/common";

import { EnvioTemplateInicialRepository } from "./envio-template-inicial.repository";
import { EnvioTemplateInicialRunner } from "./envio-template-inicial.runner";
import { EnvioTemplateInicialService } from "./envio-template-inicial.service";
import { KapsoTemplateMessageClient } from "./kapso-template-message.client";

/**
 * Modulo aislado para el cronjob `envio_template_inicial`.
 * Nuevos cronjobs deben vivir en su propia carpeta/modulo para no mezclar flujos.
 */
@Module({
    exports: [EnvioTemplateInicialService],
    providers: [EnvioTemplateInicialRepository, EnvioTemplateInicialRunner, EnvioTemplateInicialService, KapsoTemplateMessageClient],
})
export class EnvioTemplateInicialModule {}
