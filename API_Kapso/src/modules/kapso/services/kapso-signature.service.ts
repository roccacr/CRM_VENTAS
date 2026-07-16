// ============================================================================
// IMPORTS
// ============================================================================

// Injectable: registra este verificador como provider reutilizable del módulo.
import { Injectable } from "@nestjs/common";

// createHmac: genera la firma esperada.
// timingSafeEqual: compara firmas evitando diferencias de tiempo explotables.
import { createHmac, timingSafeEqual } from "crypto";

// ============================================================================
// CONSTANTES
// ============================================================================

/** Algoritmo usado por Kapso en el header `x-webhook-signature`. */
const HMAC_ALGORITHM = "sha256";

// ============================================================================
// SERVICIO
// ============================================================================

/**
 * Verificación de firmas HMAC-SHA256 en webhooks de Kapso.
 * Compara el header `x-webhook-signature` contra el cuerpo crudo (`request.rawBody`).
 */
@Injectable()
export class KapsoSignatureService {
  /**
   * Calcula el HMAC esperado y lo compara en tiempo constante con la firma recibida.
   *
   * Devuelve `false` si:
   * - falta la firma;
   * - falta el secreto;
   * - la firma recibida tiene longitud inválida;
   * - o la comparación segura falla.
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
