import "../src/config/load-env";

import { runDatabaseCheck } from "../src/database/database-check";
import { createPrismaClient } from "../src/database/prisma-client.factory";
import { KapsoWhatsappNumberRepository } from "../src/kapso-integrations/kapso-whatsapp-number.repository";

async function main(): Promise<void> {
    const prisma = createPrismaClient();
    const repository = new KapsoWhatsappNumberRepository(prisma);

    try {
        const result = await runDatabaseCheck(repository);

        if (!result.canReadTable) {
            console.error("Database check failed: cannot read kapso_integracion_numero_whatsapp");
            process.exitCode = 1;
            return;
        }

        console.log("Database check OK");
        console.log(`kapso_integracion_numero_whatsapp rows: ${result.integrationCount}`);
    } finally {
        await prisma.$disconnect();
    }
}

void main();
