/**
 * Namespace de configuración de conexión MySQL.
 *
 * Expone host, puerto y credenciales bajo la clave `mysql` para TypeORM y
 * health checks, evitando hardcodear datos de BD en módulos de dominio.
 */
import { registerAs } from "@nestjs/config";

/**
 * Registra el bloque `mysql` en ConfigModule.
 *
 * Separa la lectura de variables `MYSQL_*` del armado de opciones TypeORM,
 * de modo que validación de entorno y runtime compartan el mismo contrato.
 */
export default registerAs("mysql", () => ({
  host: process.env.MYSQL_HOST ?? "localhost",

  port: Number(process.env.MYSQL_PORT ?? 3306),

  username: process.env.MYSQL_USER ?? "root",

  password: process.env.MYSQL_PASSWORD ?? "",

  database: process.env.MYSQL_DATABASE ?? "",
}));
