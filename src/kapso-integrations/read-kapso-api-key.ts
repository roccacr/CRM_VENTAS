import { ConfigService } from "@nestjs/config";

import { requireConfiguredSecret } from "../common/security/require-configured-secret";
import { APP_ENV_KEYS } from "../config/app-config.constants";
import { KAPSO_API_KEY_HEADER } from "./kapso-api.constants";

/**
 * Lee `KAPSO_API_KEY` fail-closed (503 si falta).
 * Label = nombre de la env var para no cambiar el mensaje que ya esperan los tests.
 */
export function readKapsoApiKey(configService: ConfigService): string {
    return requireConfiguredSecret(configService.get<string>(APP_ENV_KEYS.KAPSO_API_KEY), APP_ENV_KEYS.KAPSO_API_KEY);
}

/** Headers minimos (GET/listados Kapso Platform). */
export function createKapsoApiKeyHeaders(apiKey: string): HeadersInit {
    return { [KAPSO_API_KEY_HEADER]: apiKey };
}

/** Headers de POST/PATCH JSON hacia Kapso Platform. */
export function createKapsoJsonHeaders(apiKey: string): HeadersInit {
    return {
        "Content-Type": "application/json",
        [KAPSO_API_KEY_HEADER]: apiKey,
    };
}
