import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// ============================================================================
// Cifrado de cache MSAL.
//
// MSAL Node mantiene tokens en su cache interna y no expone refresh tokens a la
// aplicacion. Al persistir esa cache en MySQL, el blob completo se trata como
// secreto de sesion de proveedor y se cifra con AES-256-GCM antes de guardar.
// ============================================================================

const AES_256_GCM_ALGORITHM = "aes-256-gcm";
const AES_256_GCM_IV_BYTES = 12;
const AUTH_TAG_ENCODING = "base64";
const CIPHERTEXT_ENCODING = "base64";
const KEY_ENCODING = "base64";
const MICROSOFT_MSAL_CACHE_KEY_VERSION = 1;

export interface EncryptedMicrosoftCache {
    ciphertext: string;
    iv: string;
    keyVersion: number;
    tag: string;
}

/**
 * Servicio pequeño y testeable para cifrar/descifrar cache MSAL.
 */
@Injectable()
export class MicrosoftMsalCacheCryptoService {
    /**
     * Inyecta ConfigService para leer la llave validada por Zod.
     */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Cifra un cache MSAL serializado. No acepta ni retorna tokens individuales.
     */
    encrypt(serializedCache: string): EncryptedMicrosoftCache {
        const iv = randomBytes(AES_256_GCM_IV_BYTES);
        const cipher = createCipheriv(AES_256_GCM_ALGORITHM, this.readEncryptionKey(), iv);
        const ciphertext = Buffer.concat([cipher.update(serializedCache, "utf8"), cipher.final()]).toString(CIPHERTEXT_ENCODING);

        return {
            ciphertext,
            iv: iv.toString(CIPHERTEXT_ENCODING),
            keyVersion: MICROSOFT_MSAL_CACHE_KEY_VERSION,
            tag: cipher.getAuthTag().toString(AUTH_TAG_ENCODING),
        };
    }

    /**
     * Descifra un blob persistido. Si el contenido fue alterado, GCM falla y no
     * se intenta usar una cache posiblemente manipulada.
     */
    decrypt(cache: EncryptedMicrosoftCache): string {
        const decipher = createDecipheriv(AES_256_GCM_ALGORITHM, this.readEncryptionKey(), Buffer.from(cache.iv, CIPHERTEXT_ENCODING));
        decipher.setAuthTag(Buffer.from(cache.tag, AUTH_TAG_ENCODING));

        return Buffer.concat([decipher.update(Buffer.from(cache.ciphertext, CIPHERTEXT_ENCODING)), decipher.final()]).toString("utf8");
    }

    /**
     * Lee la llave configurada. `validateEnv` garantiza longitud y formato; esta
     * comprobacion local conserva fail-fast si el servicio se instancia en tests
     * con un ConfigService parcial.
     */
    private readEncryptionKey(): Buffer {
        const key = Buffer.from(this.config.getOrThrow<string>("MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY"), KEY_ENCODING);

        if (key.length !== 32) {
            throw new Error("MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY debe decodificar a 32 bytes.");
        }

        return key;
    }
}
