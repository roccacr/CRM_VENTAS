import type { RawBuilder, Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { AuditActorSnapshot } from "../../audit/audit-actor.js";
import type { PurchaseFundsOrigin } from "./contract-transition.dto.js";

/** Token del adaptador viejo de transición de contrato. */
export const CONTRACT_TRANSITION_LEGACY = Symbol("CONTRACT_TRANSITION_LEGACY");
/** Foto bloqueada de la orden. `active` y `approved` deciden si la transición está permitida. */
export interface ContractOrder {
    id: string;
    businessId: string;
    active: boolean;
    approved: boolean;
    /** Disponible excluye borrados e inactivos, con independencia de la casilla de venta perdida. */
    available?: boolean;
    saleLost?: boolean;
    reservationApplied?: boolean;
    contractSigned: boolean;
    installmentsFullyPaid: boolean | null;
    unitTransferred: boolean | null;
    keysDelivered: boolean | null;
    unitDelivered: boolean | null;
    purchaseFundsOrigin?: PurchaseFundsOrigin | null;
}
/** Una entrada del diario de etapas. `sequence` es la versión del control optimista. */
export interface ContractEvent {
    sequence: number;
    state: string;
    actor: string | null;
    reason: string;
}
/** Entrada nueva del diario. `operationId` hace idempotente el reintento y `correlationId` la ata a la bitácora. */
export interface ContractEventWrite extends ContractEvent {
    actor: string;
    from: string | null;
    operationId: string;
    correlationId: string;
    /** Una escritura nueva de la API guarda la atribución. Una entrada histórica puede no tener evidencia. */
    actorSnapshot?: AuditActorSnapshot;
    responsibleSnapshot?: AuditActorSnapshot;
    purchaseFundsOrigin?: PurchaseFundsOrigin | undefined;
}

/** El adaptador usa solo la transacción canónica que le pasan. No abre otro pool de escritura. */
export interface ContractTransitionLegacy {
    /** Proyección de la misma rama; nulo cuando el fallback está apagado. */
    finiquitoProjection?(tx: Transaction<CrmDatabase>): RawBuilder<unknown> | null;
    /** Consulta exclusiva del finiquito; no obliga a las demás transiciones a usar columnas del nuevo flujo. */
    reservationApplied?(tx: Transaction<CrmDatabase>, id: string): Promise<boolean>;
    lock(tx: Transaction<CrmDatabase>, id: string, readOnly?: boolean): Promise<ContractOrder | undefined>;
    /** Resuelve un dueño nativo vivo y único dentro de la transacción de quien llama. Si hay ambigüedad, devuelve nulo. */
    owner(tx: Transaction<CrmDatabase>, id: string): Promise<string | null>;
    event(tx: Transaction<CrmDatabase>, id: string, operationId?: string): Promise<ContractEvent | undefined>;
    append(tx: Transaction<CrmDatabase>, id: string, event: ContractEventWrite): Promise<void>;
    /** Solo clasifica. No crea una visita de etapa. Usa la misma transacción ya autorizada. */
    updatePurchaseFunds(tx: Transaction<CrmDatabase>, id: string, origin: PurchaseFundsOrigin): Promise<void>;
}
