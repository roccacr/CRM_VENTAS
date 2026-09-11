import { Inject, Injectable } from "@nestjs/common";
import { Bitacora, Lead, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

export type KapsoWhatsappResponseLead = Pick<Lead, "estadoLead" | "idEmpleadoLead" | "idLead" | "idinternoLead" | "segiminetoLead">;

export type CreateWhatsappResponseBitacoraInput = {
    readonly detalleBit: string;
    readonly estadoBit: string;
    readonly estadoLead: number;
    readonly idAdminBit: number;
    readonly idCaidaBit?: number | null;
    readonly idLeadBit: number;
    readonly tipoDocumentoBit: string;
};

type KapsoWhatsappWebhookPrismaPort = {
    readonly bitacora: {
        readonly create: (args: Prisma.BitacoraCreateArgs) => Promise<Bitacora>;
        readonly findFirst: (args: Prisma.BitacoraFindFirstArgs) => Promise<Bitacora | null>;
    };
    readonly kapsoEnvioTemplateInicialIntento: {
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

    async registerWhatsappResponse(idLead: number, leadUpdate: Prisma.LeadUpdateManyMutationInput | null, bitacora: CreateWhatsappResponseBitacoraInput): Promise<void> {
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
                    fechSegBit: "",
                    idAdminBit: bitacora.idAdminBit,
                    idCaidaBit: bitacora.idCaidaBit ?? null,
                    idLeadBit: bitacora.idLeadBit,
                    tipoDocumentoBit: bitacora.tipoDocumentoBit,
                },
            });
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

    private idempotencyMarker(idempotencyKey: string): string {
        return `[Kapso webhook idem:${idempotencyKey}]`;
    }
}
