import { Global, Module } from "@nestjs/common";

import { DatabaseService } from "./database.service.js";

/**
 * Modulo compartido de base de datos tipada para repositories.
 *
 * `@Global` es intencional: la aplicacion debe reutilizar un solo servicio
 * Kysely en vez de crear pools separados por cada modulo acotado.
 */
@Global()
@Module({
    providers: [DatabaseService],
    exports: [DatabaseService],
})
export class DatabaseModule {}
