import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { CalendarModuleCode, CalendarRow } from "./calendar.contract.js";

export interface CalendarReadScope {
    actorPublicId: string;
    modules: readonly CalendarModuleCode[];
    broadModules: readonly CalendarModuleCode[];
    /** Explicit origin read denies override invitation-based visibility. */
    excludedInviteModules?: readonly string[];
    start: string;
    end: string;
}
export interface CalendarLegacyReader {
    enabled(): boolean;
    list(tx: Transaction<CrmDatabase>, scope: CalendarReadScope): Promise<CalendarRow[]>;
}
