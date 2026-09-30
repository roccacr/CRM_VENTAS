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
 * Adapter real de Microsoft 365 sobre MSAL Node y Microsoft Graph.
 *
 * La cache MSAL viaja como string serializado hacia identity para cifrarse y
 * persistirse. El adapter puede usar access tokens en memoria para Graph, pero
 * nunca los devuelve al frontend ni los guarda en claro.
 */
@Injectable()
export class Microsoft365AuthService implements MicrosoftAuthProvider {
    private readonly crypto = new CryptoProvider();
    private readonly logger = new Logger(Microsoft365AuthService.name);

    /**
     * Inyecta configuracion validada. No se conecta a Microsoft al arrancar.
     */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Construye la URL de autorizacion Microsoft con PKCE, state y nonce.
     */
    async startLogin(): Promise<MicrosoftLoginChallenge> {
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
            scopes: microsoftConfig.scopes,
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
     * Intercambia el authorization code por tokens MSAL y lee perfil/foto.
     */
    async completeCallback(input: MicrosoftCallbackInput): Promise<MicrosoftAuthenticatedAccount> {
        const microsoftConfig = this.readConfig();
        const client = this.createClient(microsoftConfig);
        const result = await client.acquireTokenByCode({
            code: input.code,
            codeVerifier: input.codeVerifier,
            nonce: input.nonce,
            redirectUri: microsoftConfig.redirectUri,
            scopes: microsoftConfig.scopes,
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
     * Rehidrata cache MSAL cifrada fuera del adapter y renueva token en silencio.
     */
    async acquireTokenSilent(input: { homeAccountId: string; msalCacheSerialized: string }): Promise<MicrosoftSilentTokenResult> {
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
                scopes: microsoftConfig.scopes,
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
     * Lee la foto de Graph. La ausencia de foto no falla login.
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
     * Exige que MSAL devuelva una cuenta. Sin cuenta no hay identidad canonica
     * segura para mapear contra CRM.
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

    /**
     * Crea un cliente MSAL por operacion para evitar cache compartida entre usuarios.
     */
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
     * Lee configuracion Microsoft. Es fail-fast por request: si el operador no
     * configuro Microsoft completo, el endpoint no inicia un flujo inseguro.
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
            scopes,
            tenantId,
        };
    }
}
