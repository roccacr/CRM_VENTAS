/**
 * Token de inyeccion para aislar identidad del SDK Microsoft.
 *
 * IdentityService depende de este puerto, no de MSAL ni Graph directamente.
 * Eso conserva el limite arquitectonico: proveedores externos viven en
 * `src/integrations/*` y se pueden sustituir o apagar sin contaminar core.
 */
export const MICROSOFT_AUTH_PROVIDER = Symbol("MICROSOFT_AUTH_PROVIDER");

export interface MicrosoftLoginChallenge {
    authorizationUrl: string;
    codeVerifier: string;
    nonce: string;
    state: string;
}

export interface MicrosoftCallbackInput {
    code: string;
    codeVerifier: string;
    nonce: string;
    state: string;
}

export interface MicrosoftProfilePhoto {
    bytes: Buffer;
    mimeType: string;
}

export interface MicrosoftAuthenticatedAccount {
    displayName: string;
    email: string;
    homeAccountId: string;
    msalCacheSerialized: string;
    oid: string;
    profilePhoto: MicrosoftProfilePhoto | null;
    subject: string;
    tenantId: string;
}

export type MicrosoftSilentTokenResult =
    | {
          accessToken: string;
          interactionRequired: false;
          msalCacheSerialized: string;
      }
    | {
          interactionRequired: true;
          reason: string;
      };

export interface MicrosoftAuthProvider {
    acquireTokenSilent(input: { homeAccountId: string; msalCacheSerialized: string }): Promise<MicrosoftSilentTokenResult>;
    completeCallback(input: MicrosoftCallbackInput): Promise<MicrosoftAuthenticatedAccount>;
    readProfilePhoto(accessToken: string): Promise<MicrosoftProfilePhoto | null>;
    startLogin(): Promise<MicrosoftLoginChallenge>;
}
