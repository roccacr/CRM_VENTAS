import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Cifrado del cache MSAL antes de guardarlo en MySQL.
 *
 * MSAL no entrega el refresh token a la aplicacion; lo conserva dentro del
 * cache. El blob completo es un secreto de sesion del proveedor y se guarda
 * como AES-256-GCM. Este servicio no cifra tokens sueltos ni los devuelve.
 *
 * Cada cifrado usa un IV nuevo de 12 bytes. El tag autentica el ciphertext: si
 * el blob fue alterado, GCM falla y no hay cache a medio descifrar que se
 * pueda seguir usando. `keyVersion` se persiste para una rotacion futura; aqui
 * solo existe la version 1 y el descifrado usa siempre la llave vigente.
 */

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

/** Cifrado y descifrado del blob. No conoce usuarios ni sesiones. */
@Injectable()
export class MicrosoftMsalCacheCryptoService {
    /** La llave llega validada por el esquema de entorno. El fallo local cubre un `ConfigService` parcial de prueba. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** Cifra el cache serializado. El llamador no recibe el IV ni el tag por separado del objeto persistible. */
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
     * Descifra un blob persistido. No hay intento de reparar un tag invalido:
     * una cache manipulada no se entrega al cliente MSAL.
     */
    decrypt(cache: EncryptedMicrosoftCache): string {
        const decipher = createDecipheriv(AES_256_GCM_ALGORITHM, this.readEncryptionKey(), Buffer.from(cache.iv, CIPHERTEXT_ENCODING));
        decipher.setAuthTag(Buffer.from(cache.tag, AUTH_TAG_ENCODING));

        return Buffer.concat([decipher.update(Buffer.from(cache.ciphertext, CIPHERTEXT_ENCODING)), decipher.final()]).toString("utf8");
    }

    /**
     * AES-256 exige 32 bytes. `validateEnv` ya lo garantiza en el arranque; esta
     * comprobacion corta igual si el servicio se construye con configuracion incompleta.
     */
    private readEncryptionKey(): Buffer {
        const key = Buffer.from(this.config.getOrThrow<string>("MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY"), KEY_ENCODING);

        if (key.length !== 32) {
            throw new Error("MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY debe decodificar a 32 bytes.");
        }

        return key;
    }
}
