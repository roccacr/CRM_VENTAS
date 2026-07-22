/**
 * Verificación HMAC de firmas de webhooks Kapso/Meta.
 *
 * Centraliza el algoritmo y la comparación en tiempo constante para que todos
 * los endpoints de webhook rechacen payloads falsificados sin filtrar información
 * por diferencias de latencia en la comparación.
 */

import { Injectable } from "@nestjs/common";

// La comparación en tiempo constante evita filtrar información por diferencias de tiempo.
import { createHmac, timingSafeEqual } from "crypto";

const HMAC_ALGORITHM = "sha256";

/**
 * Servicio de seguridad para validar `x-webhook-signature` contra el `rawBody`.
 */
@Injectable()
export class KapsoSignatureService {
  /**
   * Calcula el HMAC esperado y lo compara en tiempo constante con la firma recibida.
   *
   * Devuelve `false` (en lugar de lanzar) si:
   * - falta la firma;
   * - falta el secreto;
   * - la firma recibida tiene longitud inválida;
   * - o la comparación segura falla.
   *
   * El controller traduce ese `false` a 401 Unauthorized.
   *
   * @param payload - Cuerpo crudo del request (preferible `rawBody`).
   * @param providedSignature - Valor del header de firma.
   * @param secret - Secreto configurado para el alcance (platform o whatsapp).
   * @returns `true` solo si la firma coincide de forma segura.
   */
  verifySignature(payload: Buffer | string, providedSignature: string | undefined, secret: string): boolean {
    if (!providedSignature || !secret) {
      return false;
    }

    const expectedSignature = createHmac(HMAC_ALGORITHM, secret).update(payload).digest("hex");

    try {
      return timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }
}
