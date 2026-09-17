import { Inject, Injectable } from "@nestjs/common";
import { Bitacora, KapsoEnvioTemplateInicialIntento, Lead, Prisma } from "@prisma/client";

import { createCostaRicaWallClockDate } from "../common/datetime/costa-rica-wall-clock-date";
import { PrismaService } from "../database/prisma.service";

export type KapsoWhatsappResponseLead = Pick<Lead, "estadoLead" | "idEmpleadoLead" | "idLead" | "idinternoLead" | "segiminetoLead">;

export type KapsoWhatsappTemplateAttempt = Pick<KapsoEnvioTemplateInicialIntento, "idLead">;

export type FindTemplateAttemptByPhoneInput = {
    readonly phoneNumber: string;
    readonly phoneNumberId: string | null;
};

export type CreateWhatsappResponseBitacoraInput = {
    readonly detalleBit: string;
    readonly estadoBit: string;
    readonly estadoLead: number;
    readonly fechaCreadoBit?: Date;
    readonly idAdminBit: number;
    readonly idCaidaBit?: number | null;
    readonly idLeadBit: number;
    readonly tipoDocumentoBit: string;
};

export type RegisterWhatsappResponseOptions = {
    readonly markTemplateAttemptResponseRegistered?: boolean;
};

const TEMPLATE_RESPONSE_OPEN_STATUSES = ["sent", "delivered"] as const;
const TEMPLATE_RESPONSE_REGISTERED_STATUS = "response_registered";

type KapsoWhatsappWebhookPrismaPort = {
    readonly bitacora: {
        readonly create: (args: Prisma.BitacoraCreateArgs) => Promise<Bitacora>;
        readonly findFirst: (args: Prisma.BitacoraFindFirstArgs) => Promise<Bitacora | null>;
    };
    readonly kapsoEnvioTemplateInicialIntento: {
        readonly findFirst: (args: Prisma.KapsoEnvioTemplateInicialIntentoFindFirstArgs) => Promise<KapsoWhatsappTemplateAttempt | null>;
        readonly updateMany: (args: Prisma.KapsoEnvioTemplateInicialIntentoUpdateManyArgs) => Promise<Prisma.BatchPayload>;
    };
    readonly lead: {
        readonly findUnique: (args: Prisma.LeadFindUniqueArgs) => Promise<Lead | null>;
        readonly updateMany: (args: Prisma.LeadUpdateManyArgs) => Promise<Prisma.BatchPayload>;
    };
    readonly transaction: <T>(fn: (prisma: KapsoWhatsappWebhookPrismaPort) => Promise<T>) => Promise<T>;
};

/**
 * Persistencia minima para respuestas del template inicial.
 *
 * En esta etapa solo actualiza caida/bitacora y no guarda conversaciones
 * completas. La idempotencia vive como marker en `detalleBit` (sin tabla extra).
 */
@Injectable()
export class KapsoWhatsappWebhookRepository {
    constructor(@Inject(PrismaService) private readonly prisma: KapsoWhatsappWebhookPrismaPort) {}

    findBitacoraByIdempotencyKey(idempotencyKey: string): Promise<Bitacora | null> {
        // La bitacora actua como registro idempotente sin crear una tabla adicional en esta etapa.
        return this.prisma.bitacora.findFirst({
            where: {
                detalleBit: {
                    contains: this.idempotencyMarker(idempotencyKey),
                },
            },
        });
    }

    async findLeadForWhatsappResponse(idLead: number): Promise<KapsoWhatsappResponseLead | null> {
        const lead = await this.prisma.lead.findUnique({
            select: {
                estadoLead: true,
                idEmpleadoLead: true,
                idLead: true,
                idinternoLead: true,
                segiminetoLead: true,
            },
            where: { idLead },
        });

        return lead;
    }

    async findTemplateAttemptByMessageId(messageId: string): Promise<KapsoWhatsappTemplateAttempt | null> {
        return this.prisma.kapsoEnvioTemplateInicialIntento.findFirst({
            select: { idLead: true },
            where: {
                kapsoMessageIds: {
                    array_contains: messageId,
                },
                status: { in: [...TEMPLATE_RESPONSE_OPEN_STATUSES] },
            },
        });
    }

    async findOpenTemplateAttemptByLeadId(idLead: number): Promise<KapsoWhatsappTemplateAttempt | null> {
        return this.prisma.kapsoEnvioTemplateInicialIntento.findFirst({
            select: { idLead: true },
            where: {
                idLead,
                status: { in: [...TEMPLATE_RESPONSE_OPEN_STATUSES] },
            },
        });
    }

    async findTemplateAttemptByPhone(input: FindTemplateAttemptByPhoneInput): Promise<KapsoWhatsappTemplateAttempt | null> {
        return this.prisma.kapsoEnvioTemplateInicialIntento.findFirst({
            orderBy: { updatedAt: "desc" },
            select: { idLead: true },
            where: {
                ...(input.phoneNumberId ? { kapsoPhoneNumberId: input.phoneNumberId } : {}),
                status: { in: [...TEMPLATE_RESPONSE_OPEN_STATUSES] },
                toPhoneNumber: input.phoneNumber,
            },
        });
    }

    async registerWhatsappResponse(idLead: number, leadUpdate: Prisma.LeadUpdateManyMutationInput | null, bitacora: CreateWhatsappResponseBitacoraInput, options: RegisterWhatsappResponseOptions = {}): Promise<void> {
        // Lead y bitacora se escriben juntos para evitar estados funcionales partidos.
        await this.prisma.transaction(async (tx) => {
            if (leadUpdate) {
                await tx.lead.updateMany({
                    data: leadUpdate,
                    where: { idLead },
                });
            }

            await tx.bitacora.create({
                data: {
                    detalleBit: bitacora.detalleBit,
                    estadoBit: bitacora.estadoBit,
                    estadoLead: bitacora.estadoLead,
                    fechaCreadoBit: bitacora.fechaCreadoBit ?? createCostaRicaWallClockDate(),
                    fechSegBit: "",
                    idAdminBit: bitacora.idAdminBit,
                    idCaidaBit: bitacora.idCaidaBit ?? null,
                    idLeadBit: bitacora.idLeadBit,
                    tipoDocumentoBit: bitacora.tipoDocumentoBit,
                },
            });

            // Este flujo solo registra la primera respuesta posterior al template inicial.
            if (options.markTemplateAttemptResponseRegistered) {
                await tx.kapsoEnvioTemplateInicialIntento.updateMany({
                    data: { status: TEMPLATE_RESPONSE_REGISTERED_STATUS },
                    where: {
                        idLead,
                        status: { in: [...TEMPLATE_RESPONSE_OPEN_STATUSES] },
                    },
                });
            }
        });
    }

    async updateTemplateAttemptConversation(idLead: number, conversationId: string): Promise<void> {
        await this.prisma.kapsoEnvioTemplateInicialIntento.updateMany({
            data: { kapsoConversationId: conversationId },
            where: {
                idLead,
                status: "sent",
            },
        });
    }

    async updateTemplateAttemptFailure(idLead: number, input: { readonly conversationId: string | null; readonly errorMessage: string }): Promise<void> {
        await this.prisma.kapsoEnvioTemplateInicialIntento.updateMany({
            data: {
                errorMessage: input.errorMessage,
                kapsoConversationId: input.conversationId,
                status: "failed",
            },
            where: { idLead },
        });
    }

    async updateTemplateAttemptDelivered(idLead: number, conversationId: string | null): Promise<void> {
        await this.prisma.kapsoEnvioTemplateInicialIntento.updateMany({
            data: {
                kapsoConversationId: conversationId,
                status: "delivered",
            },
            where: { idLead },
        });
    }

    private idempotencyMarker(idempotencyKey: string): string {
        return `[Kapso webhook idem:${idempotencyKey}]`;
    }
}
