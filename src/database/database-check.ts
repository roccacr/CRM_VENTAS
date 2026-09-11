/**
 * Probe de lectura contra la tabla de integraciones.
 *
 * No propaga errores de Prisma/red: los convierte en un resultado degradado.
 * Sirve para scripts (`db:check`) y health operativo sin tumbar el proceso.
 */

/** Contrato minimo: solo contar filas (facil de mockear en unit tests). */
export type ReadOnlyIntegrationCounter = {
    readonly count: () => Promise<number>;
};

/** Resultado del probe: accesibilidad + conteo (`null` si no se pudo leer). */
export type DatabaseCheckResult = {
    readonly canReadTable: boolean;
    readonly integrationCount: number | null;
};

/**
 * Ejecuta `repository.count()` y traduce exito/fallo a `DatabaseCheckResult`.
 *
 * El catch es deliberadamente ancho: un probe no debe filtrar el mensaje
 * crudo de Prisma (DSN, host) hacia logs de script o health.
 *
 * @param repository - Cualquier objeto con `count()` (repo real o mock)
 */
export async function runDatabaseCheck(repository: ReadOnlyIntegrationCounter): Promise<DatabaseCheckResult> {
    try {
        return toSuccessfulCheck(await repository.count());
    } catch {
        return toFailedCheck();
    }
}

function toSuccessfulCheck(integrationCount: number): DatabaseCheckResult {
    return {
        canReadTable: true,
        integrationCount,
    };
}

function toFailedCheck(): DatabaseCheckResult {
    return {
        canReadTable: false,
        integrationCount: null,
    };
}
