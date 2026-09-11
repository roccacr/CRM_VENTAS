import { ConflictException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const PRISMA_UNIQUE_VIOLATION = "P2002";

/**
 * Traduce unique de Prisma (P2002) a 409.
 * Si no es P2002, no lanza: el caller re-throw el error original.
 */
export function throwIfPrismaUniqueViolation(error: unknown, message: string): void {
    if (error instanceof PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_VIOLATION) {
        throw new ConflictException(message);
    }
}
