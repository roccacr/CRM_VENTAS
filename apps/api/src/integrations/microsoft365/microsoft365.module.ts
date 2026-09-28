import { Global, Module } from "@nestjs/common";

import { MicrosoftMsalCacheCryptoService } from "../../common/security/microsoft-msal-cache-crypto.service.js";
import { MICROSOFT_AUTH_PROVIDER } from "../../modules/crm/identity/ports/microsoft-auth-provider.port.js";
import { Microsoft365AuthService } from "./microsoft365-auth.service.js";

/**
 * Integracion Microsoft 365 aislada del core de identidad.
 *
 * Exporta un puerto para login OIDC/Graph y el cifrador de cache MSAL. Identity
 * puede usar ambos sin importar MSAL directamente.
 */
@Global()
@Module({
    providers: [
        Microsoft365AuthService,
        MicrosoftMsalCacheCryptoService,
        {
            provide: MICROSOFT_AUTH_PROVIDER,
            useExisting: Microsoft365AuthService,
        },
    ],
    exports: [MICROSOFT_AUTH_PROVIDER, MicrosoftMsalCacheCryptoService],
})
export class Microsoft365Module {}
