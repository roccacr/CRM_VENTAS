import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { CalendarModuleCode, CalendarRow } from "./calendar.contract.js";

export interface CalendarReadScope {
    actorPublicId: string;
    modules: readonly CalendarModuleCode[];
    broadModules: readonly CalendarModuleCode[];
    /** Un deny explícito de lectura del módulo gana a la invitación. */
    excludedInviteModules?: readonly string[];
    start: string;
    end: string;
    /** Ids nativos que coinciden con el intervalo de Outlook de esta persona. Amplían la ventana, no el permiso. */
    externalEventIds?: readonly string[];
}
export interface CalendarLegacyReader {
    enabled(): boolean;
    list(tx: Transaction<CrmDatabase>, scope: CalendarReadScope): Promise<CalendarRow[]>;
}
