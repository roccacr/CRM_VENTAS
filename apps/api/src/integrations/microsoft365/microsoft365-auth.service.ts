import { type AccountInfo, type AuthenticationResult, ConfidentialClientApplication, type Configuration, CryptoProvider, InteractionRequiredAuthError } from "@azure/msal-node";
import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { MicrosoftAuthenticatedAccount, MicrosoftAuthProvider, MicrosoftCallbackInput, MicrosoftLoginChallenge, MicrosoftProfilePhoto, MicrosoftSilentTokenResult } from "../../modules/crm/identity/ports/microsoft-auth-provider.port.js";
import { MICROSOFT_GRAPH_FETCH_TIMEOUT_MS, MICROSOFT_GRAPH_PROFILE_PHOTO_URL } from "./microsoft365.constants.js";

const MICROSOFT_AUTHORITY_HOST = "https://login.microsoftonline.com";
const CODE_CHALLENGE_METHOD = "S256";
const MICROSOFT_LOGIN_PROMPT = "select_account";
const PHOTO_NOT_FOUND_STATUS = 404;
const ALLOWED_GRAPH_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

interface Microsoft365Config {
    authority: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
    tenantId: string;
}

/**
 * Login Microsoft con MSAL y Graph. La cache sale serializada para que
 * identidad la cifre; este servicio no la guarda.
 *
 * El access token vive en memoria para Graph o para quien llama el puerto.
 * No se devuelve al navegador ni se escribe en claro. Cada operacion crea su
 * cliente: la cache de un usuario no se mezcla con la de otro.
 */
@Injectable()
export class Microsoft365AuthService implements MicrosoftAuthProvider {
    private readonly crypto = new CryptoProvider();
    private readonly logger = new Logger(Microsoft365AuthService.name);

    /** No llama a Microsoft al arrancar. La configuracion se lee en cada operacion. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Arma la URL con PKCE `S256`, `state` y `nonce` nuevos. Esos tres vuelven
     * al servidor para atar el callback. `select_account` evita que un navegador
     * compartido entre en silencio con otra cuenta de Microsoft.
     */
    async startLogin(input?: { calendar?: boolean }): Promise<MicrosoftLoginChallenge> {
        const microsoftConfig = this.readConfig();
        const client = this.createClient(microsoftConfig);
        const pkce = await this.crypto.generatePkceCodes();
        const state = this.crypto.createNewGuid();
        const nonce = this.crypto.createNewGuid();
        const authorizationUrl = await client.getAuthCodeUrl({
            codeChallenge: pkce.challenge,
            codeChallengeMethod: CODE_CHALLENGE_METHOD,
            nonce,
            prompt: MICROSOFT_LOGIN_PROMPT,
            redirectUri: microsoftConfig.redirectUri,
            scopes: input?.calendar ? this.loginScopes(microsoftConfig.scopes) : microsoftConfig.scopes,
            state,
        });

        return {
            authorizationUrl,
            codeVerifier: pkce.verifier,
            nonce,
            state,
        };
    }

    /**
     * Cambia el codigo por tokens y lee la foto. Sin una cuenta del tenant
     * configurado, con los campos minimos y que no sea invitada, el login no sigue.
     * La foto ausente no rechaza la cuenta.
     */
    async completeCallback(input: MicrosoftCallbackInput): Promise<MicrosoftAuthenticatedAccount> {
        const microsoftConfig = this.readConfig();
        const client = this.createClient(microsoftConfig);
        const result = await client.acquireTokenByCode({
            code: input.code,
            codeVerifier: input.codeVerifier,
            nonce: input.nonce,
            redirectUri: microsoftConfig.redirectUri,
            scopes: input.calendar ? this.loginScopes(microsoftConfig.scopes) : microsoftConfig.scopes,
        });

        const account = this.assertAccount(result, microsoftConfig.tenantId);
        const profilePhoto = await this.readProfilePhoto(result.accessToken);

        return {
            displayName: result.account?.name ?? account.name ?? account.username,
            email: account.username,
            homeAccountId: account.homeAccountId,
            msalCacheSerialized: client.getTokenCache().serialize(),
            oid: account.localAccountId,
            profilePhoto,
            subject: account.localAccountId,
            tenantId: account.tenantId,
        };
    }

    /**
     * La cache ya llega descifrada. Si falta la cuenta, el token sale vacio o
     * Microsoft pide interaccion, la respuesta es `interactionRequired` con un
     * motivo. Otro error se propaga. La cache nueva vuelve serializada.
     */
    async acquireTokenSilent(input: { homeAccountId: string; msalCacheSerialized: string; scopes?: string[] }): Promise<MicrosoftSilentTokenResult> {
        const microsoftConfig = this.readConfig();
        const client = this.createClient(microsoftConfig);
        client.getTokenCache().deserialize(input.msalCacheSerialized);

        const account = await client.getTokenCache().getAccountByHomeId(input.homeAccountId);

        if (!account) {
            return { interactionRequired: true, reason: "microsoft_account_not_in_cache" };
        }

        try {
            const result = await client.acquireTokenSilent({
                account,
                scopes: input.scopes ?? microsoftConfig.scopes,
            });

            if (!result.accessToken) {
                return { interactionRequired: true, reason: "microsoft_silent_token_empty" };
            }

            return {
                accessToken: result.accessToken,
                interactionRequired: false,
                msalCacheSerialized: client.getTokenCache().serialize(),
            };
        } catch (error) {
            if (error instanceof InteractionRequiredAuthError) {
                return { interactionRequired: true, reason: "microsoft_interaction_required" };
            }

            throw error;
        }
    }

    /**
     * 404, un estado no exitoso, un MIME fuera de la lista o un corte a los 5 s
     * dejan la foto en nulo. El login no falla por la foto. Sin `Content-Type`
     * se asume `image/jpeg` y despues se valida contra la misma lista.
     */
    async readProfilePhoto(accessToken: string): Promise<MicrosoftProfilePhoto | null> {
        try {
            const response = await fetch(MICROSOFT_GRAPH_PROFILE_PHOTO_URL, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                signal: AbortSignal.timeout(MICROSOFT_GRAPH_FETCH_TIMEOUT_MS),
            });

            if (response.status === PHOTO_NOT_FOUND_STATUS) {
                return null;
            }

            if (!response.ok) {
                this.logger.warn(`Microsoft Graph no devolvio foto de perfil. status=${response.status.toString()}`);
                return null;
            }

            const mimeType = this.normalizeGraphPhotoMimeType(response.headers.get("content-type"));

            if (!mimeType) {
                this.logger.warn("Microsoft Graph devolvio una foto con MIME no permitido.");
                return null;
            }

            return {
                bytes: Buffer.from(await response.arrayBuffer()),
                mimeType,
            };
        } catch (error) {
            this.logger.warn(`Microsoft Graph no pudo leer foto de perfil: ${error instanceof Error ? error.message : "error_desconocido"}`);
            return null;
        }
    }

    private normalizeGraphPhotoMimeType(contentType: string | null): string | null {
        const mimeType = (contentType ?? "image/jpeg").split(";")[0]?.trim().toLowerCase() ?? "image/jpeg";
        return ALLOWED_GRAPH_PHOTO_MIME_TYPES.has(mimeType) ? mimeType : null;
    }

    /**
     * Hace falta token, `homeAccountId`, tenant, `localAccountId` y usuario.
     * El tenant tiene que ser el configurado. Un UPN con `#ext#` es una cuenta
     * invitada y se rechaza con el mismo mensaje: el cliente no distingue el motivo.
     */
    private assertAccount(result: AuthenticationResult | null, expectedTenantId: string): AccountInfo {
        const account = result?.account;

        if (!account || !result.accessToken || !this.hasRequiredAccountFields(account) || !this.isExpectedTenant(account, expectedTenantId) || this.isGuestAccount(account)) {
            throw new UnauthorizedException("Microsoft no devolvio una cuenta valida.");
        }

        return account;
    }

    private hasRequiredAccountFields(account: AccountInfo): boolean {
        return Boolean(account.homeAccountId && account.tenantId && account.localAccountId && account.username);
    }

    private isExpectedTenant(account: AccountInfo, expectedTenantId: string): boolean {
        return account.tenantId.toLowerCase() === expectedTenantId.toLowerCase();
    }

    private isGuestAccount(account: AccountInfo): boolean {
        return account.username.toLowerCase().includes("#ext#");
    }

    /** Un cliente por operacion. La autoridad es el tenant configurado, no `common`. */
    private createClient(config: Microsoft365Config): ConfidentialClientApplication {
        const msalConfig: Configuration = {
            auth: {
                authority: config.authority,
                clientId: config.clientId,
                clientSecret: config.clientSecret,
            },
        };

        return new ConfidentialClientApplication(msalConfig);
    }

    /**
     * Agrega calendario solo si `ENABLE_CALENDAR_EXTERNAL` es `true`. Quien llama
     * esto ya decidio que el login lo pide. La renovacion silenciosa no pasa por aqui.
     */
    private loginScopes(base: string[]): string[] {
        return this.config.get<boolean>("ENABLE_CALENDAR_EXTERNAL") === true ? [...new Set([...base, "Calendars.ReadWrite", "Calendars.Read.Shared", "Place.Read.All"])] : base;
    }

    /**
     * Falla la peticion si falta cualquier dato de Microsoft. No arranca un flujo
     * a medias. Con `ENABLE_ORDER_DOCUMENTS` en `true`, `Files.ReadWrite.All`
     * entra en la lista base y tambien en la renovacion silenciosa.
     */
    private readConfig(): Microsoft365Config {
        const tenantId = this.config.getOrThrow<string>("MICROSOFT_TENANT_ID");
        const clientId = this.config.getOrThrow<string>("MICROSOFT_CLIENT_ID");
        const clientSecret = this.config.getOrThrow<string>("MICROSOFT_CLIENT_SECRET");
        const redirectUri = this.config.getOrThrow<string>("MICROSOFT_REDIRECT_URI");
        const scopes = this.config
            .getOrThrow<string>("MICROSOFT_SCOPES")
            .split(" ")
            .map((scope) => scope.trim())
            .filter(Boolean);

        return {
            authority: `${MICROSOFT_AUTHORITY_HOST}/${tenantId}`,
            clientId,
            clientSecret,
            redirectUri,
            scopes: this.config.get<boolean>("ENABLE_ORDER_DOCUMENTS") === true ? [...new Set([...scopes, "Files.ReadWrite.All"])] : scopes,
            tenantId,
        };
    }
}
