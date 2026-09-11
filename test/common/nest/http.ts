import { INestApplication } from "@nestjs/common";
import request from "supertest";

/**
 * Tipado único del server para supertest.
 * Evita repetir `as Parameters<typeof request>[0]` en cada e2e.
 */
export function httpServer(app: INestApplication): Parameters<typeof request>[0] {
    return app.getHttpServer() as Parameters<typeof request>[0];
}
