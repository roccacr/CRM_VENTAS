import { Inject, Injectable } from "@nestjs/common";
import { CompiledQuery } from "kysely";

import { DatabaseService } from "../../database/database.service.js";

/** Plazo de la respuesta HTTP. No aborta la consulta que ya tomo una conexion del pool. */
const READINESS_TIMEOUT_MS = 1_000;

/**
 * Readiness de conectividad nativa. Legacy y proveedores externos no participan:
 * un fallo ajeno al pool nativo no debe sacar la instancia de servicio.
 */
@Injectable()
export class HealthService {
    /**
     * Unico probe en vuelo por proceso. Las llamadas concurrentes comparten su
     * resultado. Se libera cuando el driver termina, no cuando vence el plazo.
     */
    private inFlight: Promise<boolean> | undefined;

    /** Reutiliza el pool nativo. Un pool aparte ocultaria la saturacion real. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /**
     * `true` solo si `SELECT 1` responde dentro del plazo. Cualquier fallo del
     * driver es `false`: el mensaje, el SQL y el codigo no salen de aqui.
     *
     * `Promise.race` decide la respuesta y no cancela al perdedor. Si vence el
     * plazo, esta promesa ya resuelta en `false` sigue ocupando el cupo; quien
     * llegue despues la reutiliza y no dispara otro `SELECT 1` contra un pool
     * trabado. El cupo se suelta en el `finally` de la consulta, cuando el
     * driver por fin liquida la operacion.
     *
     * El SQL es un literal fijo, sin interpolacion. `CompiledQuery.raw` evita
     * pasar por una tabla o por el adaptador legacy.
     */
    isReady(): Promise<boolean> {
        if (this.inFlight) return this.inFlight;
        let timer: ReturnType<typeof setTimeout>;
        const probe = Promise.resolve()
            .then(() => this.database.db.executeQuery(CompiledQuery.raw("SELECT 1")))
            .then(
                () => true,
                () => false,
            )
            .finally(() => {
                this.inFlight = undefined;
            });
        const timeout = new Promise<boolean>((resolve) => {
            timer = setTimeout(() => {
                resolve(false);
            }, READINESS_TIMEOUT_MS);
        });
        this.inFlight = Promise.race([probe, timeout]).finally(() => {
            clearTimeout(timer);
        });
        return this.inFlight;
    }
}
