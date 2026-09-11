/**
 * Mock mínimo del client Prisma para KapsoWhatsappNumberRepository.
 * Misma superficie que KapsoWhatsappNumberReader en src — no ampliar sin necesidad.
 */
export function createKapsoPrismaMock(): {
    kapsoIntegracionNumeroWhatsapp: {
        count: jest.Mock;
        deleteMany: jest.Mock;
        findMany: jest.Mock;
        findUnique: jest.Mock;
        updateMany: jest.Mock;
        upsert: jest.Mock;
    };
} {
    return {
        kapsoIntegracionNumeroWhatsapp: {
            count: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            updateMany: jest.fn(),
            upsert: jest.fn(),
        },
    };
}
