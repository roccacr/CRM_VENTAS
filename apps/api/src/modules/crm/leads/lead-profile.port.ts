import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { LeadProfileCommercialPage, LeadProfileEventPage, LeadProfileOrderPage, LeadProfileSource } from "./lead-profile.contract.js";

export interface LeadProfileLegacyReader {
    enabled(): boolean;
    find(tx: Transaction<CrmDatabase>, key: "id" | "reference", value: string): Promise<LeadProfileSource | null>;
    commercial(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, kind: "opportunities" | "estimates", page: number): Promise<LeadProfileCommercialPage>;
    events(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, page: number): Promise<LeadProfileEventPage>;
    orders(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, page: number, nativeLeadId?: string): Promise<LeadProfileOrderPage>;
}
