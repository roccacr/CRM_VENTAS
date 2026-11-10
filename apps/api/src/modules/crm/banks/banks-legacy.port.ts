import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { Bank, BankAdvisor } from "./banks.types.js";
/** Símbolo para no importar el escritor legado desde el catálogo nativo. */
export const BANKS_LEGACY_ACCESS = Symbol("BANKS_LEGACY_ACCESS");
/**
 * El espejo usa la transacción nativa del llamador y resuelve al padre por el ULID público.
 * Si nadie registra el puerto, el banco se guarda igual en el CRM nuevo.
 * Quien lo implementa decide si copia; este archivo no abre la base vieja.
 */
export interface BanksLegacyAccess {
    assertWritable(): void;
    writeBank(tx: Transaction<CrmDatabase>, bank: Bank, expectedVersion?: number): Promise<void>;
    writeAdvisor(tx: Transaction<CrmDatabase>, advisor: BankAdvisor, expectedVersion?: number): Promise<void>;
}
