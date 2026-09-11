import "../src/config/load-env";

import { createPrismaClient } from "../src/database/prisma-client.factory";
import { KapsoWhatsappNumberRepository } from "../src/kapso-integrations/kapso-whatsapp-number.repository";
import { formatKapsoWhatsappNumberMonitorRows } from "../src/kapso-integrations/kapso-whatsapp-number-monitor";

async function main(): Promise<void> {
    const prisma = createPrismaClient();
    const repository = new KapsoWhatsappNumberRepository(prisma);

    try {
        const rows = await repository.findAll();
        console.log(formatKapsoWhatsappNumberMonitorRows(rows));
    } finally {
        await prisma.$disconnect();
    }
}

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Kapso numbers check failed: ${message}`);
    process.exitCode = 1;
});
