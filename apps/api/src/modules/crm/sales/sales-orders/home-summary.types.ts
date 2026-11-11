/** Órdenes por etapa de formalización. Cada contador es un entero seguro no negativo. */
export interface StageCounts {
    contracts: { toSend: number; pendingSignature: number };
    banking: number;
    bankingInProgress?: number;
    balance: number;
    transferPending: number;
    transferSigned: number;
    closedThisYear: number;
}

/** Ventana del año calendario en hora de Costa Rica. `endExclusive` evita contar dos veces el instante del borde. */
export interface HomeSummaryPeriod {
    year: number;
    timeZone: "America/Costa_Rica";
    start: string;
    endExclusive: string;
}

/** Respuesta del resumen de inicio: conteos unidos y el desglose por fuente para poder rastrearlos. */
export interface HomeSummary {
    schemaVersion: 1;
    observedAt: string;
    period: HomeSummaryPeriod;
    counts: StageCounts;
    sources: { native: StageCounts; legacy: StageCounts; legacyEnabled: boolean; duplicatesExcluded: number };
}

/** Punto de partida para acumular conteos por fuente. */
export const emptyStageCounts = (): StageCounts => ({ contracts: { toSend: 0, pendingSignature: 0 }, banking: 0, bankingInProgress: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 });

/** Los agregados llegan como texto DECIMAL o de conteo desde mysql2. Una pérdida de precisión se rechaza. */
export function aggregateNumber(value: string | number | null): number {
    if (value === null) return 0;
    if (typeof value !== "number" && (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))) throw new Error("Invalid Home aggregate count");
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid Home aggregate count");
    return count;
}

/** Fila cruda del agregado tal como la devuelve mysql2. El conteo puede ser texto o NULL. */
export interface StageAggregateRow {
    toSend: string | number | null;
    pendingSignature: string | number | null;
    banking: string | number | null;
    bankingInProgress?: string | number | null;
    balance: string | number | null;
    transferPending: string | number | null;
    transferSigned: string | number | null;
    closedThisYear: string | number | null;
    duplicatesExcluded?: string | number | null;
}

/** Una fila o un campo ausente es un fallo de la fuente. Solo un NULL explícito de SQL significa una suma vacía. */
export function stageCountsFromRow(row: StageAggregateRow | undefined): StageCounts {
    if (!row) throw new Error("Missing Home aggregate row");
    return { contracts: { toSend: aggregateNumber(row.toSend), pendingSignature: aggregateNumber(row.pendingSignature) }, banking: aggregateNumber(row.banking), bankingInProgress: aggregateNumber(row.bankingInProgress ?? null), balance: aggregateNumber(row.balance), transferPending: aggregateNumber(row.transferPending), transferSigned: aggregateNumber(row.transferSigned), closedThisYear: aggregateNumber(row.closedThisYear) };
}

/** Proyección personal acotada de la bitácora. No trae fotos arbitrarias, notas ni otro actor. */
export interface RecentOrderActivity {
    id: string;
    source: "native" | "legacy";
    orderId: string;
    action: string;
    at: string;
    fromState: string | null;
    toState: string | null;
    approval: string | null;
}

/** Minutos en la misma etapa a partir de los cuales una orden se considera atrasada. Valor de negocio: 72 h. */
export const OVERDUE_THRESHOLD_MINUTES = 4320;

/** Órdenes del CRM nuevo sin cambio de etapa hace más del umbral. Es un subconjunto de los conteos de cada etapa. */
export interface OverdueSummary {
    schemaVersion: 1;
    observedAt: string;
    thresholdMinutes: number;
    source: "native";
    counts: { contractsToSend: number; contractsPendingSignature: number; banking: number; bankingInProgress: number; balance: number; transferPending: number; transferSigned: number };
}

/** Fila cruda del agregado de atraso tal como la devuelve mysql2. */
export interface OverdueAggregateRow {
    toSend: string | number | null;
    pendingSignature: string | number | null;
    banking: string | number | null;
    bankingInProgress: string | number | null;
    balance: string | number | null;
    transferPending: string | number | null;
    transferSigned: string | number | null;
}

/** Una fila ausente es un fallo de la fuente; un NULL explícito de SQL es una suma vacía. */
export function overdueCountsFromRow(row: OverdueAggregateRow | undefined): OverdueSummary["counts"] {
    if (!row) throw new Error("Missing Home overdue row");
    return {
        contractsToSend: aggregateNumber(row.toSend),
        contractsPendingSignature: aggregateNumber(row.pendingSignature),
        banking: aggregateNumber(row.banking),
        bankingInProgress: aggregateNumber(row.bankingInProgress),
        balance: aggregateNumber(row.balance),
        transferPending: aggregateNumber(row.transferPending),
        transferSigned: aggregateNumber(row.transferSigned),
    };
}
