import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
export interface BankAssignmentIdentity {
    source: "native" | "legacy";
    id: string;
}
export interface BankAssignmentOrder extends BankAssignmentIdentity {
    internalId: string;
    active: boolean;
    deleted?: boolean;
}
export const BANK_ASSIGNMENT_LEGACY = Symbol("BANK_ASSIGNMENT_LEGACY");
export interface BankAssignmentLegacy {
    read(tx: Transaction<CrmDatabase>, id: string, lock: boolean): Promise<BankAssignmentOrder | undefined>;
}
