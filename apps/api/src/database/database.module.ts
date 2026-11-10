import { Global, Module } from "@nestjs/common";

import { DatabaseService } from "./database.service.js";

/**
 * Un solo acceso a MySQL para toda la API.
 *
 * `@Global` evita que cada modulo de negocio importe este y construya otro
 * pool. `ConfigModule` ya es global; aqui solo se crea y se exporta el
 * servicio. Las queries no viven en este modulo.
 */
@Global()
@Module({
    providers: [DatabaseService],
    exports: [DatabaseService],
})
export class DatabaseModule {}
