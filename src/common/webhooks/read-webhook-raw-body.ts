import { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";

/**
 * Cuerpo crudo del webhook para verificar HMAC.
 *
 * Preferir `rawBody` (bytes del wire). `JSON.stringify(body)` es fallback de
 * tests/mocks donde Nest no inyecta `rawBody`. En produccion el fallback es
 * peligroso: el orden de keys puede no coincidir con lo que firmo el proveedor.
 *
 * @param request - Request Express con `rawBody` opcional (middleware `rawBody: true`)
 * @returns UTF-8 del payload tal como llego, o JSON serializado si no hay rawBody
 */
export function readWebhookRawBody(request: RawBodyRequest<Request>): string {
    if (request.rawBody) {
        return request.rawBody.toString("utf8");
    }

    return JSON.stringify(request.body);
}
