import "../src/config/load-env";

import { ConfigService } from "@nestjs/config";

import { createPrismaClient } from "../src/database/prisma-client.factory";
import { ensureKapsoPhoneWebhooks } from "../src/kapso-integrations/kapso-phone-webhook-ensure";
import { KapsoPhoneWebhookClient } from "../src/kapso-integrations/kapso-phone-webhook.client";
import { KapsoWhatsappNumberRepository } from "../src/kapso-integrations/kapso-whatsapp-number.repository";

async function main(): Promise<void> {
    const prisma = createPrismaClient();
    const repository = new KapsoWhatsappNumberRepository(prisma);
    const client = new KapsoPhoneWebhookClient(new ConfigService(process.env));

    try {
        const result = await ensureKapsoPhoneWebhooks(repository, client);
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Kapso webhook ensure failed: ${message}`);
    process.exitCode = 1;
});
