import { Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import { KapsoIntegracionNumeroWhatsapp } from "@prisma/client";

import { parseKapsoRouteId } from "./parse-kapso-route-id";
import { KapsoPhoneWebhookClient } from "./kapso-phone-webhook.client";
import { KapsoPlatformClient, KapsoPlatformPhoneNumber } from "./kapso-platform.client";
import { KapsoWhatsappNumberRepository } from "./kapso-whatsapp-number.repository";

const NOT_FOUND_MESSAGE = "Kapso WhatsApp number integration not found";

/**
 * DTO CRM: fechas en ISO-8601 e id como string (JSON no serializa bigint).
 * El shape es contrato de API: no agregar secretos ni payloads crudos de Kapso.
 */
export type KapsoWhatsappNumberDto = {
    readonly id: string;
    readonly kapsoPhoneNumberId: string;
    readonly kapsoProjectId: string | null;
    readonly kapsoCustomerId: string | null;
    readonly displayPhoneNumber: string | null;
    readonly phoneNumber: string | null;
    readonly businessAccountId: string | null;
    readonly businessName: string | null;
    readonly status: string;
    readonly isActive: boolean;
    readonly idnetsuiteAdminAsignado: number | null;
    readonly lastSyncAt: string | null;
    readonly connectedAt: string;
    readonly createdAt: string;
    readonly updatedAt: string;
};

/** Respuesta corta tras activate/deactivate. */
export type KapsoWhatsappNumberStatusDto = {
    readonly id: string;
    readonly isActive: boolean;
};

export type KapsoWhatsappNumberSyncDto = {
    readonly synced: number;
};

type KapsoWhatsappNumbersRepositoryPort = Pick<KapsoWhatsappNumberRepository, "findAll" | "findById" | "setActiveById"> & {
    readonly upsertFromKapsoPhoneNumber?: KapsoWhatsappNumberRepository["upsertFromKapsoPhoneNumber"];
};

type SyncDependencies = {
    readonly kapsoClient: Pick<KapsoPlatformClient, "getPhoneNumber" | "listPhoneNumbers">;
    readonly upsertFromKapsoPhoneNumber: KapsoWhatsappNumberRepository["upsertFromKapsoPhoneNumber"];
};

/**
 * Caso de uso: listar y cambiar isActive de números WhatsApp Kapso.
 * activate/deactivate son wrappers explícitos (API clara) sobre setActive.
 */
@Injectable()
export class KapsoWhatsappNumbersService {
    constructor(
        @Inject(KapsoWhatsappNumberRepository)
        private readonly repository: KapsoWhatsappNumbersRepositoryPort,
        @Optional()
        @Inject(KapsoPlatformClient)
        private readonly kapsoClient?: Pick<KapsoPlatformClient, "getPhoneNumber" | "listPhoneNumbers">,
        @Optional()
        @Inject(KapsoPhoneWebhookClient)
        private readonly phoneWebhookClient?: Pick<KapsoPhoneWebhookClient, "ensureWhatsappWebhook">,
    ) {}

    async findAll(): Promise<KapsoWhatsappNumberDto[]> {
        const rows = await this.repository.findAll();
        return rows.map((row) => this.toDto(row));
    }

    activate(id: string): Promise<KapsoWhatsappNumberStatusDto> {
        return this.setActive(id, true);
    }

    deactivate(id: string): Promise<KapsoWhatsappNumberStatusDto> {
        return this.setActive(id, false);
    }

    async syncFromKapso(): Promise<KapsoWhatsappNumberSyncDto> {
        const syncDependencies = this.getSyncDependencies();
        const phoneNumbers = await syncDependencies.kapsoClient.listPhoneNumbers();

        for (const phoneNumber of phoneNumbers) {
            await this.syncPhoneNumber(phoneNumber, syncDependencies);
        }

        return { synced: phoneNumbers.length };
    }

    async syncOneFromKapso(id: string): Promise<KapsoWhatsappNumberSyncDto> {
        const syncDependencies = this.getSyncDependencies();
        const parsedId = parseKapsoRouteId(id, NOT_FOUND_MESSAGE);
        const integration = await this.repository.findById(parsedId);

        if (!integration) {
            throw new NotFoundException(NOT_FOUND_MESSAGE);
        }

        const phoneNumber = await syncDependencies.kapsoClient.getPhoneNumber(integration.kapsoPhoneNumberId);
        await this.syncPhoneNumber(phoneNumber, syncDependencies);

        return { synced: 1 };
    }

    private getSyncDependencies(): SyncDependencies {
        if (!this.kapsoClient) {
            throw new ServiceUnavailableException("Kapso platform client is not configured");
        }

        if (!this.repository.upsertFromKapsoPhoneNumber) {
            throw new ServiceUnavailableException("Kapso WhatsApp number repository sync is not configured");
        }

        return {
            kapsoClient: this.kapsoClient,
            upsertFromKapsoPhoneNumber: this.repository.upsertFromKapsoPhoneNumber,
        };
    }

    /**
     * Cada numero sincronizado debe quedar persistido y con su webhook WhatsApp
     * asegurado. Si Kapso falla creando/actualizando webhook, la sync falla visible.
     */
    private async syncPhoneNumber(phoneNumber: KapsoPlatformPhoneNumber, syncDependencies: SyncDependencies): Promise<void> {
        await syncDependencies.upsertFromKapsoPhoneNumber(phoneNumber);
        await this.phoneWebhookClient?.ensureWhatsappWebhook(phoneNumber.kapsoPhoneNumberId);
    }

    /**
     * Actualiza isActive.
     * @throws {NotFoundException} si el id no es numérico o no existe en DB
     */
    private async setActive(id: string, isActive: boolean): Promise<KapsoWhatsappNumberStatusDto> {
        const parsedId = parseKapsoRouteId(id, NOT_FOUND_MESSAGE);
        const updated = await this.repository.setActiveById(parsedId, isActive);

        if (updated === 0) {
            throw new NotFoundException(NOT_FOUND_MESSAGE);
        }

        return { id: parsedId.toString(), isActive };
    }

    private toDto(row: KapsoIntegracionNumeroWhatsapp): KapsoWhatsappNumberDto {
        return {
            businessAccountId: row.businessAccountId,
            businessName: row.businessName,
            connectedAt: row.connectedAt.toISOString(),
            createdAt: row.createdAt.toISOString(),
            displayPhoneNumber: row.displayPhoneNumber,
            id: row.id.toString(),
            idnetsuiteAdminAsignado: row.idnetsuiteAdminAsignado,
            isActive: row.isActive,
            kapsoCustomerId: row.kapsoCustomerId,
            kapsoPhoneNumberId: row.kapsoPhoneNumberId,
            kapsoProjectId: row.kapsoProjectId,
            lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
            phoneNumber: row.phoneNumber,
            status: row.status,
            updatedAt: row.updatedAt.toISOString(),
        };
    }
}
