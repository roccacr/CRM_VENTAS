/**
 * Acceso al pool del CRM viejo.
 *
 * Lo usan solo los readers de esta carpeta. `src/modules/crm` habla con el
 * puerto de fallback, no con este servicio. El provider existe aunque la
 * conexión sea `null`, para que identidad arranque sin la base vieja.
 */
import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Kysely } from "kysely";

import { LEGACY_CRM_DATABASE } from "./legacy-crm.config.js";

/**
 * El provider existe aunque la conexion sea `null`. Identidad puede arrancar
 * sin la base vieja. El tipo es `unknown`: estas columnas no son el contrato
 * del CRM nuevo.
 */
@Injectable()
export class LegacyCrmDatabaseService implements OnModuleDestroy {
    /** Pool de solo lectura, o `null` si el fallback no se abrio. */
    constructor(@Inject(LEGACY_CRM_DATABASE) private readonly legacyDatabase: Kysely<unknown> | null) {}

    /** `true` solo cuando la fábrica llegó a abrir el pool. */
    isConfigured(): boolean {
        return this.legacyDatabase !== null;
    }

    /**
     * Kysely sin esquema del CRM nuevo.
     *
     * Lanza si alguien consulta con el fallback apagado, en lugar de devolver
     * una conexión a la base nueva por error.
     */
    get db(): Kysely<unknown> {
        if (!this.legacyDatabase) {
            throw new Error("La conexion al CRM viejo no esta configurada.");
        }

        return this.legacyDatabase;
    }

    /** Cierra el pool en un apagado ordenado. No hace nada si nunca se abrió. */
    async onModuleDestroy(): Promise<void> {
        await this.legacyDatabase?.destroy();
    }
}
