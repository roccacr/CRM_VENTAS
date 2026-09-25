import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Kysely } from "kysely";

import { LEGACY_CRM_DATABASE } from "./legacy-crm.config.js";

// ============================================================================
// Conexion aislada al CRM viejo.
//
// Esta conexion existe solo para lectura/sync temporal desde la base legacy.
// El core del CRM nuevo sigue usando DatabaseService -> CRM_THINK_V2. Si el CRM
// viejo se apaga, esta carpeta debe poder eliminarse sin tocar modulos core.
// ============================================================================

/**
 * Provider de acceso al CRM viejo.
 *
 * Solo debe ser consumido por adapters/readers bajo `src/integrations/legacy-crm`.
 * Los modulos `src/modules/crm/**` no deben importar este servicio
 * directamente.
 */
@Injectable()
export class LegacyCrmDatabaseService implements OnModuleDestroy {
    /**
     * Recibe una conexion opcional. Si legacy no esta configurado, el provider
     * existe pero no abre pool; eso permite arrancar identidad sin base vieja.
     */
    constructor(@Inject(LEGACY_CRM_DATABASE) private readonly legacyDatabase: Kysely<unknown> | null) {}

    /**
     * Indica si la conexion legacy fue activada por configuracion.
     */
    isConfigured(): boolean {
        return this.legacyDatabase !== null;
    }

    /**
     * Kysely sin esquema tipado porque legacy se mapea antes de entrar al core.
     */
    get db(): Kysely<unknown> {
        if (!this.legacyDatabase) {
            throw new Error("La conexion al CRM viejo no esta configurada.");
        }

        return this.legacyDatabase;
    }

    /**
     * Cierra el pool legacy en shutdown ordenado.
     */
    async onModuleDestroy(): Promise<void> {
        await this.legacyDatabase?.destroy();
    }
}
