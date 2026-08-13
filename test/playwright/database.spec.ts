import 'dotenv/config';

import { expect, test } from '@playwright/test';

import { runDatabaseCheck } from '../../src/database/database-check';
import { createPrismaClient } from '../../src/database/prisma-client.factory';

test.describe('Database read check', () => {
  test('reads the Kapso integration table without modifying data', async () => {
    const prisma = createPrismaClient();
    const repository = {
      count: (): Promise<number> => prisma.kapsoIntegracionNumeroWhatsapp.count(),
    };

    try {
      const result = await runDatabaseCheck(repository);

      expect(result.canReadTable).toBe(true);
      expect(result.integrationCount).not.toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });
});
