import { createHmac, timingSafeEqual } from "node:crypto";

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { type EncryptedMicrosoftCache, MicrosoftMsalCacheCryptoService } from "../../../common/security/microsoft-msal-cache-crypto.service.js";
import { MICROSOFT_OIDC_CHALLENGE_TTL_MS } from "./identity-microsoft.constants.js";
import { MICROSOFT_AUTH_PROVIDER, type MicrosoftAuthenticatedAccount, type MicrosoftAuthProvider, type MicrosoftCallbackInput } from "./ports/microsoft-auth-provider.port.js";

const MICROSOFT_CHALLENGE_SEPARATOR = ".";

export interface MicrosoftLoginStartResult {
    authorizationUrl: string;
    challengeCookie: string;
    challengeExpiresAt: Date;
}

interface MicrosoftChallengePayload extends Omit<MicrosoftCallbackInput, "code"> {
    expiresAt: string;
}

/**
 * Maneja la continuidad Microsoft sin exponer MSAL al caso de uso principal.
 */
@Injectable()
export class IdentityMicrosoftSessionService {
    /**
     * Inyecta el puerto Microsoft, cifrado MSAL y secreto de firma de cookies.
     */
    constructor(
        @Inject(MICROSOFT_AUTH_PROVIDER) private readonly microsoft: MicrosoftAuthProvider,
        @Inject(MicrosoftMsalCacheCryptoService) private readonly microsoftCacheCrypto: MicrosoftMsalCacheCryptoService,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}

    /**
     * Inicia Microsoft OIDC con PKCE/state/nonce y challenge server-side.
     */
    async startLogin(): Promise<MicrosoftLoginStartResult> {
        const challenge = await this.microsoft.startLogin();
        const expiresAt = new Date(Date.now() + MICROSOFT_OIDC_CHALLENGE_TTL_MS);

        return {
            authorizationUrl: challenge.authorizationUrl,
            challengeCookie: this.signMicrosoftChallenge({
                codeVerifier: challenge.codeVerifier,
                expiresAt: expiresAt.toISOString(),
                nonce: challenge.nonce,
                state: challenge.state,
            }),
            challengeExpiresAt: expiresAt,
        };
    }

    /**
     * Valida challenge OIDC y retorna cuenta Microsoft con cache cifrada.
     */
    async completeCallback(input: { challengeCookie: string | undefined; code: string; state: string }): Promise<{ account: MicrosoftAuthenticatedAccount; encryptedCache: EncryptedMicrosoftCache }> {
        const challenge = this.verifyMicrosoftChallenge(input.challengeCookie, input.state);
        const account = await this.microsoft.completeCallback({
            code: input.code,
            codeVerifier: challenge.codeVerifier,
            nonce: challenge.nonce,
            state: input.state,
        });

        return {
            account,
            encryptedCache: this.microsoftCacheCrypto.encrypt(account.msalCacheSerialized),
        };
    }

    /**
     * Renueva MSAL en silencio y devuelve cache cifrada nueva, o `null` si Microsoft exige login.
     */
    async renewSilentToken(input: { cache: EncryptedMicrosoftCache; homeAccountId: string }): Promise<EncryptedMicrosoftCache | null> {
        const silentResult = await this.microsoft.acquireTokenSilent({
            homeAccountId: input.homeAccountId,
            msalCacheSerialized: this.microsoftCacheCrypto.decrypt(input.cache),
        });

        if (silentResult.interactionRequired) {
            return null;
        }

        return this.microsoftCacheCrypto.encrypt(silentResult.msalCacheSerialized);
    }

    /**
     * Firma el challenge OIDC que se guarda como cookie HttpOnly temporal.
     */
    private signMicrosoftChallenge(payload: MicrosoftChallengePayload): string {
        const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
        const signature = createHmac("sha256", this.config.getOrThrow<string>("COOKIE_SECRET")).update(encodedPayload).digest("base64url");
        return `${encodedPayload}${MICROSOFT_CHALLENGE_SEPARATOR}${signature}`;
    }

    /**
     * Verifica state, firma y expiracion del challenge Microsoft.
     */
    private verifyMicrosoftChallenge(challengeCookie: string | undefined, state: string): MicrosoftChallengePayload {
        if (!challengeCookie) {
            throw new UnauthorizedException("Challenge Microsoft invalido.");
        }

        const [encodedPayload, signature] = challengeCookie.split(MICROSOFT_CHALLENGE_SEPARATOR);

        if (!encodedPayload || !signature) {
            throw new UnauthorizedException("Challenge Microsoft invalido.");
        }

        const expectedSignature = createHmac("sha256", this.config.getOrThrow<string>("COOKIE_SECRET")).update(encodedPayload).digest("base64url");

        if (!this.hasSameSignature(signature, expectedSignature)) {
            throw new UnauthorizedException("Challenge Microsoft invalido.");
        }

        const payload = this.parseMicrosoftChallengePayload(encodedPayload);

        if (payload.state !== state || Date.parse(payload.expiresAt) <= Date.now()) {
            throw new UnauthorizedException("Challenge Microsoft invalido.");
        }

        return payload;
    }

    /**
     * Compara firmas sin filtrar timing entre valores del mismo largo.
     */
    private hasSameSignature(received: string, expected: string): boolean {
        const receivedBuffer = Buffer.from(received);
        const expectedBuffer = Buffer.from(expected);
        return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
    }

    /**
     * Parsea el challenge ya autenticado sin filtrar errores de JSON como 500.
     */
    private parseMicrosoftChallengePayload(encodedPayload: string): MicrosoftChallengePayload {
        try {
            const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<MicrosoftChallengePayload>;

            if (typeof payload.codeVerifier !== "string" || typeof payload.expiresAt !== "string" || typeof payload.nonce !== "string" || typeof payload.state !== "string" || Number.isNaN(Date.parse(payload.expiresAt))) {
                throw new Error("Invalid Microsoft challenge payload.");
            }

            return payload as MicrosoftChallengePayload;
        } catch {
            throw new UnauthorizedException("Challenge Microsoft invalido.");
        }
    }
}
