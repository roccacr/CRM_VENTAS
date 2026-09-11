import { Inject, Injectable, Logger } from "@nestjs/common";

import { normalizeWhatsappPhoneNumber } from "../../common/phone/whatsapp-phone-number";
import { CAIDA_NUMERO_TELEFONO_INVALIDO, CAIDA_TEMPLATE_INICIAL_ENTREGADO, ENVIO_TEMPLATE_INICIAL_CRONJOB_ID, LEAD_POST_TEMPLATE_SEGUIMIENTO, LEAD_TEMPLATE_PROCESSED_STATUS, TEMPLATE_ATTEMPT_STATUS, TEMPLATE_DEFAULTS, TEMPLATE_INITIAL_EVENTS } from "./envio-template-inicial.constants";
import { toBitacoraInput, toErrorMessage, toSuccessLeadUpdate, valueOrFallback } from "./envio-template-inicial.mapping";
import { EnvioTemplateInicialAdmin, EnvioTemplateInicialCronjobConfig, EnvioTemplateInicialLead, EnvioTemplateInicialRepository } from "./envio-template-inicial.repository";
import { EnvioTemplateInicialRunResult, ProcessLeadResult } from "./envio-template-inicial.types";
import { KapsoTemplateMessageClient } from "./kapso-template-message.client";

export type { EnvioTemplateInicialRunResult } from "./envio-template-inicial.types";

type ActiveProjectConfig = EnvioTemplateInicialCronjobConfig["projectConfigs"][number];

const EMPTY_RUN_RESULT: EnvioTemplateInicialRunResult = {
    failed: 0,
    processed: 0,
    sent: 0,
    skipped: 0,
    status: "completed",
};

const DISABLED_RUN_RESULT: EnvioTemplateInicialRunResult = {
    ...EMPTY_RUN_RESULT,
    status: "disabled",
};

const ALREADY_RUNNING_RESULT: EnvioTemplateInicialRunResult = {
    ...EMPTY_RUN_RESULT,
    status: "already_running",
};

/**
 * Caso de uso del cronjob `envio_template_inicial`.
 *
 * Orquesta candidatos CRM → Kapso `saludo` → bitacora. No habla HTTP ni SQL:
 * el client y el repo son los unicos bordes. Un candado en memoria evita dos
 * `runOnce` en la misma instancia; el runner encadena `setTimeout` para no
 * disparar un segundo ciclo mientras este corre.
 */
@Injectable()
export class EnvioTemplateInicialService {
    private readonly logger = new Logger(EnvioTemplateInicialService.name);

    private isRunning = false;

    constructor(
        @Inject(EnvioTemplateInicialRepository)
        private readonly repository: EnvioTemplateInicialRepository,
        @Inject(KapsoTemplateMessageClient)
        private readonly kapsoClient: KapsoTemplateMessageClient,
    ) {}

    async runOnce(limit: number): Promise<EnvioTemplateInicialRunResult> {
        if (this.isRunning) {
            return ALREADY_RUNNING_RESULT;
        }

        this.isRunning = true;

        try {
            return await this.processBatch(limit);
        } finally {
            this.isRunning = false;
        }
    }

    private async processBatch(limit: number): Promise<EnvioTemplateInicialRunResult> {
        const cronjob = await this.repository.findCronjobConfig(ENVIO_TEMPLATE_INICIAL_CRONJOB_ID);

        if (!cronjob?.isActive) {
            return DISABLED_RUN_RESULT;
        }

        const activeProjectConfigs = getRunnableProjectConfigs(cronjob);
        const leads = await this.repository.findPendingLeads(getUniqueProjectIds(activeProjectConfigs), limit);
        const counters = { failed: 0, sent: 0, skipped: 0 };

        for (const lead of leads) {
            const result = await this.processLead(lead, activeProjectConfigs);
            counters[result] += 1;
        }

        return { ...counters, processed: leads.length, status: "completed" };
    }

    private async processLead(lead: EnvioTemplateInicialLead, activeProjectConfigs: ActiveProjectConfig[]): Promise<ProcessLeadResult> {
        const adminId = lead.idEmpleadoLead ?? 0;

        // Un lead solo puede tener un intento tecnico de template inicial.
        if (await this.repository.hasTemplateAttemptForLead(lead.idLead)) {
            await this.skipLead(lead, adminId, "No se envio template saludo inicial: el lead ya tiene un intento registrado.");
            return "skipped";
        }

        const admin = await this.resolveActiveAdmin(lead);
        const activeAdminId = admin?.idnetsuiteAdmin ?? null;

        // Sin admin CRM activo no hay integracion Kapso confiable para enviar a nombre del asesor.
        if (!admin || !activeAdminId) {
            await this.skipLead(lead, 0, `No se envio template saludo inicial: no existe admin activo para id_empleado_lead ${adminId}.`);
            return "skipped";
        }

        const projectConfig = findProjectConfigForLead(lead, activeAdminId, activeProjectConfigs);

        if (!projectConfig) {
            await this.skipLead(lead, activeAdminId, "No se envio template saludo inicial: no existe una integracion Kapso activa para el admin y proyecto del lead.");
            return "skipped";
        }

        return this.sendTemplateForLead(lead, admin, activeAdminId, projectConfig);
    }

    private async resolveActiveAdmin(lead: EnvioTemplateInicialLead): Promise<EnvioTemplateInicialAdmin | null> {
        if (!lead.idEmpleadoLead) {
            return null;
        }

        return this.repository.findActiveAdminByIdnetsuite(lead.idEmpleadoLead);
    }

    private async sendTemplateForLead(lead: EnvioTemplateInicialLead, admin: EnvioTemplateInicialAdmin, adminId: number, projectConfig: ActiveProjectConfig): Promise<ProcessLeadResult> {
        const to = normalizeWhatsappPhoneNumber(lead.telefonoLead).e164Digits;

        if (!to) {
            this.logger.warn({ event: TEMPLATE_INITIAL_EVENTS.INVALID_PHONE, leadId: lead.idLead });
            await this.failInvalidPhone(lead, adminId, projectConfig);
            return "failed";
        }

        try {
            await this.registerTemplateAttempt(lead, adminId, projectConfig, to, TEMPLATE_ATTEMPT_STATUS.PROCESSING);

            const response = await this.kapsoClient.sendSaludoTemplate({
                adminName: valueOrFallback(admin.nameAdmin, TEMPLATE_DEFAULTS.ADMIN_NAME),
                leadId: lead.idLead,
                leadName: valueOrFallback(lead.nombreLead, TEMPLATE_DEFAULTS.LEAD_NAME),
                phoneNumberId: projectConfig.integration.kapsoPhoneNumberId,
                projectName: valueOrFallback(lead.proyectoLead, `Proyecto ${lead.idproyectoLead}`),
                to,
            });

            await this.repository.updateTemplateAttemptResult({
                idLead: lead.idLead,
                kapsoMessageIds: response.messageIds,
                rawResponse: response.rawResponse,
                status: TEMPLATE_ATTEMPT_STATUS.SENT,
            });

            this.logger.log({
                event: TEMPLATE_INITIAL_EVENTS.SENT,
                leadId: lead.idLead,
                messageIds: response.messageIds,
                phoneNumberId: projectConfig.integration.kapsoPhoneNumberId,
            });

            await this.markLeadTemplateSent(lead, adminId, to, response.messageIds);
            return "sent";
        } catch (error) {
            const errorMessage = toErrorMessage(error);

            this.logger.warn({
                error: errorMessage,
                event: TEMPLATE_INITIAL_EVENTS.FAILED,
                leadId: lead.idLead,
            });

            await this.repository.updateTemplateAttemptResult({
                errorMessage,
                idLead: lead.idLead,
                kapsoMessageIds: [],
                status: TEMPLATE_ATTEMPT_STATUS.FAILED,
            });

            await this.skipLead(lead, adminId, `No se envio template saludo inicial. Error Kapso: ${errorMessage}`);
            return "failed";
        }
    }

    private async skipLead(lead: EnvioTemplateInicialLead, idAdminBit: number, detalleBit: string): Promise<void> {
        await this.repository.markLeadProcessedWithBitacora(lead.idLead, { whatsappTemplateContactSent: LEAD_TEMPLATE_PROCESSED_STATUS }, toBitacoraInput(lead, { detalleBit, idAdminBit }));
    }

    private async failInvalidPhone(lead: EnvioTemplateInicialLead, adminId: number, projectConfig: ActiveProjectConfig): Promise<void> {
        await this.registerTemplateAttempt(lead, adminId, projectConfig, null, TEMPLATE_ATTEMPT_STATUS.INVALID_PHONE);
        await this.repository.markLeadProcessedWithBitacora(
            lead.idLead,
            {
                idCaida: CAIDA_NUMERO_TELEFONO_INVALIDO,
                whatsappTemplateContactSent: LEAD_TEMPLATE_PROCESSED_STATUS,
            },
            toBitacoraInput(lead, {
                detalleBit: "No se envio template saludo inicial: numero de telefono no valido.",
                idAdminBit: adminId,
                idCaidaBit: CAIDA_NUMERO_TELEFONO_INVALIDO,
            }),
        );
    }

    private async markLeadTemplateSent(lead: EnvioTemplateInicialLead, adminId: number, normalizedPhoneNumber: string, messageIds: readonly string[]): Promise<void> {
        await this.repository.markLeadProcessedWithBitacora(
            lead.idLead,
            toSuccessLeadUpdate(normalizedPhoneNumber),
            toBitacoraInput(lead, {
                detalleBit: `Template saludo inicial enviado con exito por Kapso. Mensaje: ${messageIds.join(", ")}.`,
                estadoBit: LEAD_POST_TEMPLATE_SEGUIMIENTO,
                idAdminBit: adminId,
                idCaidaBit: CAIDA_TEMPLATE_INICIAL_ENTREGADO,
            }),
        );
    }

    private async registerTemplateAttempt(lead: EnvioTemplateInicialLead, adminId: number, projectConfig: ActiveProjectConfig, normalizedPhoneNumber: string | null, status: string): Promise<void> {
        await this.repository.registerTemplateAttempt({
            idAdmin: adminId,
            idLead: lead.idLead,
            idproyectoLead: lead.idproyectoLead,
            kapsoIntegracionNumeroWhatsappId: projectConfig.integration.id,
            kapsoPhoneNumberId: projectConfig.integration.kapsoPhoneNumberId,
            normalizedPhoneNumber,
            status,
        });
    }
}

function getRunnableProjectConfigs(cronjob: EnvioTemplateInicialCronjobConfig): ActiveProjectConfig[] {
    return cronjob.projectConfigs.filter((config) => config.isActive && config.integration.isActive);
}

function getUniqueProjectIds(projectConfigs: ActiveProjectConfig[]): number[] {
    return [...new Set(projectConfigs.map((config) => config.idproyectoLead))];
}

function findProjectConfigForLead(lead: EnvioTemplateInicialLead, adminId: number, activeProjectConfigs: ActiveProjectConfig[]): ActiveProjectConfig | null {
    return activeProjectConfigs.find((config) => config.idproyectoLead === lead.idproyectoLead && config.integration.adminAssignments.some((assignment) => assignment.idnetsuiteAdmin === adminId)) ?? null;
}
