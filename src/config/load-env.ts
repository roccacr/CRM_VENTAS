import { config } from "dotenv";

/**
 * Carga `.env` ANTES de AppModule / ConfigModule / Prisma.
 *
 * `main.ts` y los scripts deben importar este archivo en la primera linea:
 * dotenv no corre solo. `override: true` hace que el archivo gane sobre un
 * `PORT` o `DATABASE_URL` viejo que haya quedado en la sesion de Windows/CI.
 * `quiet: true` silencia el "injected env" de dotenv, que ensuciaba stdout
 * antes de que Pino tomara el logger.
 */
config({ override: true, quiet: true });
