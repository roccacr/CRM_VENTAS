import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { Bank, BankAdvisor } from "./banks.types.js";
export const BANKS_LEGACY_ACCESS = Symbol("BANKS_LEGACY_ACCESS");
/** Mirror only uses the caller's native transaction and resolves parents by public ULID. */
export interface BanksLegacyAccess {
    assertWritable(): void;
    writeBank(tx: Transaction<CrmDatabase>, bank: Bank, expectedVersion?: number): Promise<void>;
    writeAdvisor(tx: Transaction<CrmDatabase>, advisor: BankAdvisor, expectedVersion?: number): Promise<void>;
}
