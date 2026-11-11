import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";

export type AddendumStatus = "pending" | "completed" | "cancelled" | "sent";
export interface AddendumIdentity {
    source: "native" | "legacy";
    id: string;
}
export interface AddendumOrder extends AddendumIdentity {
    internalId: string;
    active: boolean;
    deleted?: boolean;
    status: AddendumStatus | null;
    version: number;
    changedAt: string | null;
    note: string | null;
    lead: AddendumIdentity | null;
}
export interface AddendumChange extends AddendumIdentity {
    status: "completed" | "cancelled" | "sent";
    expectedVersion: number;
    operationId: string;
    actorPublicId: string;
}
export interface FutureAddendum {
    id: string;
    start: string;
    ownerPublicId: string;
    invited: number;
}
export interface AddendumManualMark extends AddendumIdentity {
    expectedVersion: number;
    operationId: string;
    actorPublicId: string;
    note: string | null;
}
export const SALES_ORDER_ADDENDUM_LEGACY = Symbol("SALES_ORDER_ADDENDUM_LEGACY");
/** El adaptador comparte la transacción nativa; no abre un segundo pool ni modifica el lead. */
export interface SalesOrderAddendumLegacy {
    countPending(tx: Transaction<CrmDatabase>): Promise<number>;
    read(tx: Transaction<CrmDatabase>, id: string, lock: boolean): Promise<AddendumOrder | undefined>;
    write(tx: Transaction<CrmDatabase>, order: AddendumOrder, next: { status: AddendumStatus; version: number; changedAt: string; note: string | null }): Promise<void>;
}
