import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";

export const UNIT_TRANSFER_WORKFLOW = Symbol("UNIT_TRANSFER_WORKFLOW");
/** El llamador conserva el bloqueo y autoriza antes de cualquier efecto externo. */
export interface UnitTransferWorkflow {
    execute(tx: Transaction<CrmDatabase>, command: { source: "native" | "legacy"; id: string; actorPublicId: string; operationId: string; correlationId: string }): Promise<string>;
}
