/**
 * Firma y valida URLs temporales de media Kapso (HMAC + TTL).
 *
 * Permite servir adjuntos en un endpoint `@Public` sin JWT: WhatsApp descarga
 * el link firmado y el API rechaza URLs vencidas o alteradas. La comparación
 * usa `timingSafeEqual` para no filtrar bits de la firma por timing.
 */

import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Emisor/validador de URLs firmadas para `/kapso/media/:storedFilename`.
 */
@Injectable()
export class KapsoMediaUrlSignerService {
  private readonly apiPrefix: string;
  private readonly publicBaseUrl: string;
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor(configService: ConfigService) {
    this.apiPrefix = configService.getOrThrow<string>("app.apiPrefix").replace(/^\/+|\/+$/g, "");
    this.publicBaseUrl = configService.getOrThrow<string>("kapso.publicBaseUrl").replace(/\/+$/, "");
    this.secret = configService.getOrThrow<string>("kapso.mediaSigningSecret");
    this.ttlSeconds = configService.get<number>("kapso.mediaSignedUrlTtlSeconds", 3600);
  }

  /**
   * Construye una URL pública con `expires` y `signature` HMAC.
   * Se usa al listar/subir media y al enviar adjuntos intro por WhatsApp.
   *
   * @param storedFilename - Nombre físico del archivo en storage.
   * @returns URL absoluta firmada lista para Meta/CRM.
   */
  createSignedUrl(storedFilename: string): string {
    const expires = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const signature = this.sign(storedFilename, expires);
    const encodedFilename = encodeURIComponent(storedFilename);

    return `${this.publicBaseUrl}/${this.apiPrefix}/kapso/media/${encodedFilename}?expires=${expires}&signature=${signature}`;
  }

  /**
   * Valida firma y vigencia antes de servir el archivo.
   * Lanza 403 (no 401) porque el recurso es público con capability URL, no con sesión.
   *
   * @param storedFilename - Nombre del archivo solicitado.
   * @param expiresValue - Epoch seconds como string query.
   * @param signature - HMAC hex de 64 caracteres.
   * @throws ForbiddenException si falta firma, está vencida o no coincide.
   */
  assertValid(storedFilename: string, expiresValue: string | undefined, signature: string | undefined): void {
    if (!expiresValue || !/^\d+$/.test(expiresValue) || !signature) {
      throw new ForbiddenException("La URL del archivo no contiene una firma válida.");
    }

    const expires = Number(expiresValue);
    const now = Math.floor(Date.now() / 1000);

    if (!Number.isSafeInteger(expires) || expires < now) {
      throw new ForbiddenException("La URL del archivo ha vencido.");
    }

    const expected = Buffer.from(this.sign(storedFilename, expires), "hex");
    const received = /^[a-f0-9]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : Buffer.alloc(0);

    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new ForbiddenException("La firma de la URL del archivo es inválida.");
    }
  }

  /** HMAC-SHA256 de `storedFilename.expires` en hex. */
  private sign(storedFilename: string, expires: number): string {
    return createHmac("sha256", this.secret).update(`${storedFilename}.${expires}`).digest("hex");
  }
}
