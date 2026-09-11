import { Inject, Injectable } from "@nestjs/common";
import { Admin, Bitacora, KapsoEnvioTemplateInicialIntento, KapsoCronjobConfiguracion, KapsoCronjobProyectoConfiguracion, KapsoIntegracionAdminAsignacion, KapsoIntegracionNumeroWhatsapp, Lead, Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { LEAD_INTERESADO_SEGUIMIENTO, LEAD_INTERESADO_STATUS, LEAD_PENDING_TEMPLATE_SENT_STATUS, LEAD_TEMPLATE_PROCESSED_STATUS } from "./envio-template-inicial.constants";

const EMPTY_FOLLOW_UP_DATE = "";

const PENDING_LEAD_SELECT = {
    accionLead: true,
    estadoLead: true,
    idCaida: true,
    idEmpleadoLead: true,
    idLead: true,
    idinternoLead: true,
    idproyectoLead: true,
    nombreLead: true,
    proyectoLead: true,
    segiminetoLead: true,
    telefonoLead: true,
    whatsappTemplateContactSent: true,
} as const;

export type EnvioTemplateInicialCronjobConfig = KapsoCronjobConfiguracion & {
    readonly projectConfigs: (KapsoCronjobProyectoConfiguracion & {
        readonly integration: KapsoIntegracionNumeroWhatsapp & {
            readonly adminAssignments: KapsoIntegracionAdminAsignacion[];
        };
    })[];
};

export type EnvioTemplateInicialLead = Pick<Lead, "accionLead" | "estadoLead" | "idCaida" | "idEmpleadoLead" | "idLead" | "idinternoLead" | "idproyectoLead" | "nombreLead" | "proyectoLead" | "segiminetoLead" | "telefonoLead" | "whatsappTemplateContactSent">;

export type EnvioTemplateInicialAdmin = Pick<Admin, "idnetsuiteAdmin" | "nameAdmin">;

export type RegisterTemplateAttemptInput = {
    readonly idAdmin: number;
    readonly idLead: number;
    readonly idproyectoLead: number | null;
    readonly kapsoIntegracionNumeroWhatsappId: bigint | null;
    readonly kapsoPhoneNumberId: string | null;
    readonly normalizedPhoneNumber: string | null;
    readonly status: string;
};

export type UpdateTemplateAttemptResultInput = {
    readonly errorMessage?: string | null;
    readonly idLead: number;
    readonly kapsoMessageIds?: readonly string[];
    readonly rawResponse?: Prisma.InputJsonValue | null;
    readonly status: string;
};

export type CreateBitacoraInput = {
    readonly detalleBit: string;
    readonly estadoBit: string;
    readonly estadoLead: number;
    readonly idAdminBit: number;
    readonly idCaidaBit?: number | null;
    readonly idLeadBit: number;
    readonly tipoDocumentoBit: string;
};

type EnvioTemplateInicialPrismaPort = {
    readonly admin: {
        readonly findFirst: (args: Prisma.AdminFindFirstArgs) => Promise<Admin | null>;
    };
    readonly bitacora: {
        readonly create: (args: Prisma.BitacoraCreateArgs) => Promise<Bitacora>;
    };
    readonly kapsoCronjobConfiguracion: {
        readonly findFirst: (args: Prisma.KapsoCronjobConfiguracionFindFirstArgs) => Promise<EnvioTemplateInicialCronjobConfig | KapsoCronjobConfiguracion | null>;
    };
    readonly kapsoEnvioTemplateInicialIntento: {
        readonly create: (args: Prisma.KapsoEnvioTemplateInicialIntentoCreateArgs) => Promise<KapsoEnvioTemplateInicialIntento>;
        readonly findUnique: (args: Prisma.KapsoEnvioTemplateInicialIntentoFindUniqueArgs) => Promise<KapsoEnvioTemplateInicialIntento | null>;
        readonly updateMany: (args: Prisma.KapsoEnvioTemplateInicialIntentoUpdateManyArgs) => Promise<Prisma.BatchPayload>;
    };
    readonly lead: {
        readonly findMany: (args: Prisma.LeadFindManyArgs) => Promise<EnvioTemplateInicialLead[]>;
        readonly updateMany: (args: Prisma.LeadUpdateManyArgs) => Promise<Prisma.BatchPayload>;
    };
    readonly transaction: <T>(fn: (prisma: EnvioTemplateInicialPrismaPort) => Promise<T>) => Promise<T>;
};

/**
 * Repositorio del cronjob `envio_template_inicial`.
 *
 * Centraliza lecturas/escrituras de produccion para mantener el servicio sin
 * SQL/Prisma directo. `markLeadProcessedWithBitacora` es el unico write
 * compuesto: lead + bitacora en una transaccion.
 */
@Injectable()
export class EnvioTemplateInicialRepository {
    constructor(@Inject(PrismaService) private readonly prisma: EnvioTemplateInicialPrismaPort) {}

    findCronjobConfig(cronjobId: string): Promise<EnvioTemplateInicialCronjobConfig | null> {
        return this.prisma.kapsoCronjobConfiguracion.findFirst({
            include: {
                projectConfigs: {
                    include: {
                        integration: {
                            include: { adminAssignments: true },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                    where: { isActive: true },
                },
            },
            where: { cronjobId },
        }) as Promise<EnvioTemplateInicialCronjobConfig | null>;
    }

    findPendingLeads(projectIds: number[], limit: number): Promise<EnvioTemplateInicialLead[]> {
        if (projectIds.length === 0) {
            return Promise.resolve([]);
        }

        return this.prisma.lead.findMany({
            orderBy: { idLead: "asc" },
            select: PENDING_LEAD_SELECT,
            take: limit,
            where: pendingLeadWhere(projectIds),
        });
    }

    findActiveAdminByIdnetsuite(idnetsuiteAdmin: number): Promise<EnvioTemplateInicialAdmin | null> {
        return this.prisma.admin.findFirst({
            select: { idnetsuiteAdmin: true, nameAdmin: true },
            where: {
                idnetsuiteAdmin,
                statusAdmin: 1,
            },
        });
    }

    async hasTemplateAttemptForLead(idLead: number): Promise<boolean> {
        const attempt = await this.prisma.kapsoEnvioTemplateInicialIntento.findUnique({
            select: { id: true },
            where: { idLead },
        });

        return Boolean(attempt);
    }

    async registerTemplateAttempt(input: RegisterTemplateAttemptInput): Promise<void> {
        await this.prisma.kapsoEnvioTemplateInicialIntento.create({
            data: {
                idAdmin: input.idAdmin,
                idLead: input.idLead,
                idproyectoLead: input.idproyectoLead,
                kapsoIntegracionNumeroWhatsappId: input.kapsoIntegracionNumeroWhatsappId,
                kapsoMessageIds: [],
                kapsoPhoneNumberId: input.kapsoPhoneNumberId,
                status: input.status,
                toPhoneNumber: input.normalizedPhoneNumber,
            },
        });
    }

    async updateTemplateAttemptResult(input: UpdateTemplateAttemptResultInput): Promise<void> {
        await this.prisma.kapsoEnvioTemplateInicialIntento.updateMany({
            data: {
                errorMessage: input.errorMessage ?? null,
                kapsoMessageIds: (input.kapsoMessageIds ?? []) as unknown as Prisma.InputJsonArray,
                rawResponse: input.rawResponse ?? Prisma.JsonNull,
                status: input.status,
            },
            where: { idLead: input.idLead },
        });
    }

    async markLeadProcessedWithBitacora(leadId: number, leadUpdate: Prisma.LeadUpdateManyMutationInput, bitacora: CreateBitacoraInput): Promise<void> {
        // La actualizacion del lead y su bitacora deben quedar atomicas.
        await this.prisma.transaction(async (tx) => {
            await tx.lead.updateMany({
                data: leadUpdate,
                where: { idLead: leadId },
            });
            await tx.bitacora.create({ data: this.createBitacoraData(bitacora) });
        });
    }

    createBitacora(input: CreateBitacoraInput): Promise<Bitacora> {
        return this.prisma.bitacora.create({ data: this.createBitacoraData(input) });
    }

    markLeadTemplateProcessed(leadId: number): Promise<Prisma.BatchPayload> {
        return this.prisma.lead.updateMany({
            data: { whatsappTemplateContactSent: LEAD_TEMPLATE_PROCESSED_STATUS },
            where: { idLead: leadId },
        });
    }

    private createBitacoraData(input: CreateBitacoraInput): Prisma.BitacoraCreateInput {
        return {
            detalleBit: input.detalleBit,
            estadoBit: input.estadoBit,
            estadoLead: input.estadoLead,
            fechSegBit: EMPTY_FOLLOW_UP_DATE,
            idAdminBit: input.idAdminBit,
            idCaidaBit: input.idCaidaBit ?? null,
            idLeadBit: input.idLeadBit,
            tipoDocumentoBit: input.tipoDocumentoBit,
        };
    }
}

function pendingLeadWhere(projectIds: number[]): Prisma.LeadWhereInput {
    return {
        estadoLead: LEAD_INTERESADO_STATUS,
        idproyectoLead: { in: projectIds },
        segiminetoLead: LEAD_INTERESADO_SEGUIMIENTO,
        whatsappTemplateContactSent: LEAD_PENDING_TEMPLATE_SENT_STATUS,
    };
}
