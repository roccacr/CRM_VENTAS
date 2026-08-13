/**
 * Contrato mínimo: solo contar filas (para checks de lectura).
 */
export type ReadOnlyIntegrationCounter = {
  readonly count: () => Promise<number>;
};

/** Resultado de un probe de lectura a la tabla de integraciones. */
export type DatabaseCheckResult = {
  readonly canReadTable: boolean;
  readonly integrationCount: number | null;
};

/**
 * Intenta `count()`; si falla, devuelve resultado degradado (no lanza).
 */
export async function runDatabaseCheck(
  repository: ReadOnlyIntegrationCounter,
): Promise<DatabaseCheckResult> {
  try {
    return { canReadTable: true, integrationCount: await repository.count() };
  } catch {
    return { canReadTable: false, integrationCount: null };
  }
}
