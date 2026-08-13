/**
 * Probe de lectura contra la tabla de integraciones.
 *
 * No propaga errores de Prisma/red: los convierte en un resultado degradado.
 * Sirve para scripts (`db:check`) y health operativo sin tumbar el proceso.
 */

/** Contrato mínimo: solo contar filas (fácil de mockear). */
export type ReadOnlyIntegrationCounter = {
  readonly count: () => Promise<number>;
};

/** Resultado del probe: accesibilidad + conteo (null si no se pudo leer). */
export type DatabaseCheckResult = {
  readonly canReadTable: boolean;
  readonly integrationCount: number | null;
};

/**
 * Ejecuta repository.count() y traduce éxito/fallo a DatabaseCheckResult.
 *
 * @param repository - Cualquier objeto con count() (repo real o mock)
 */
export async function runDatabaseCheck(
  repository: ReadOnlyIntegrationCounter,
): Promise<DatabaseCheckResult> {
  try {
    return {
      canReadTable: true,
      integrationCount: await repository.count(),
    };
  } catch {
    return {
      canReadTable: false,
      integrationCount: null,
    };
  }
}
