import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";

/** Token del lector viejo del resumen de contratos. */
export const CONTRACT_SUMMARY_LEGACY_READER = Symbol("CONTRACT_SUMMARY_LEGACY_READER");
/** Contadores del banner: órdenes por enviar, frente a enviadas y pendientes de la firma del cliente. */
export type ContractCounts = { toSend: number; pendingSignature: number };
/** `state` is the latest stage-journal value; `id` is the keyset cursor. */
export type LegacyContractRow = { id: number; state: string };

/** Páginas de solo lectura del diario de etapas viejo que tiene autoridad. No se infieren de las banderas de envío del ERP. */
export interface ContractSummaryLegacyReader {
    enabled(): boolean;
    pending(after: number, transaction: Transaction<CrmDatabase>): Promise<LegacyContractRow[]>;
}
