import { Global, Module } from "@nestjs/common";

import { MicrosoftMsalCacheCryptoService } from "../../common/security/microsoft-msal-cache-crypto.service.js";
import { EXTERNAL_CALENDAR } from "../../modules/crm/calendar/external-calendar.port.js";
import { MICROSOFT_AUTH_PROVIDER } from "../../modules/crm/identity/ports/microsoft-auth-provider.port.js";
import { Microsoft365AuthService } from "./microsoft365-auth.service.js";
import { Microsoft365CalendarService } from "./microsoft365-calendar.service.js";

/**
 * Microsoft 365 queda detras de puertos. Identidad no importa MSAL.
 *
 * `MICROSOFT_AUTH_PROVIDER` y `EXTERNAL_CALENDAR` son el mismo objeto que su
 * servicio (`useExisting`), no una segunda instancia. El cifrador de la cache
 * sale de aqui para que identidad persista el token cifrado sin conocer MSAL.
 */
@Global()
@Module({
    providers: [
        Microsoft365AuthService,
        Microsoft365CalendarService,
        { provide: EXTERNAL_CALENDAR, useExisting: Microsoft365CalendarService },
        MicrosoftMsalCacheCryptoService,
        {
            provide: MICROSOFT_AUTH_PROVIDER,
            useExisting: Microsoft365AuthService,
        },
    ],
    exports: [EXTERNAL_CALENDAR, MICROSOFT_AUTH_PROVIDER, MicrosoftMsalCacheCryptoService],
})
export class Microsoft365Module {}
