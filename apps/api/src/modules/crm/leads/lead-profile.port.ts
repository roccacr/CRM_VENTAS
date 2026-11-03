import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { LeadProfileOrderPage, LeadProfileSource } from "./lead-profile.contract.js";

export interface LeadProfileLegacyReader {
    enabled(): boolean;
    find(tx: Transaction<CrmDatabase>, key: "id" | "reference", value: string): Promise<LeadProfileSource | null>;
    orders(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, page: number, nativeLeadId?: string): Promise<LeadProfileOrderPage>;
}
