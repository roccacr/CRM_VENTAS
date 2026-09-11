import { KapsoPhoneWebhookClient } from "./kapso-phone-webhook.client";
import { KapsoWhatsappNumberRepository } from "./kapso-whatsapp-number.repository";

type ActiveIntegration = {
    readonly kapsoPhoneNumberId: string;
};

type RepositoryPort = Pick<KapsoWhatsappNumberRepository, "findActive"> & {
    readonly findActive: () => Promise<ActiveIntegration[]>;
};

type ClientPort = Pick<KapsoPhoneWebhookClient, "ensureWhatsappWebhook">;

export type KapsoPhoneWebhookEnsureSummary = {
    readonly created: number;
    readonly existing: number;
    readonly total: number;
    readonly updated: number;
};

/**
 * Recorre integraciones activas y asegura webhook WhatsApp completo en Kapso.
 * No es un Nest provider: lo usan scripts (`kapso:webhooks:ensure`) y tests.
 */
export async function ensureKapsoPhoneWebhooks(repository: RepositoryPort, client: ClientPort): Promise<KapsoPhoneWebhookEnsureSummary> {
    const integrations = await repository.findActive();
    const summary = { created: 0, existing: 0, total: integrations.length, updated: 0 };

    for (const integration of integrations) {
        const action = (await client.ensureWhatsappWebhook(integration.kapsoPhoneNumberId)).action;

        if (action === "created") {
            summary.created += 1;
        } else if (action === "exists") {
            summary.existing += 1;
        } else {
            summary.updated += 1;
        }
    }

    return summary;
}
