import type { ConfigService } from "@nestjs/config";

/** Single gate for every legacy read/write. Set false here to retire legacy globally. */
export function isLegacyCrmEnabled(config: ConfigService): boolean {
    return config.get<unknown>("ENABLE_LEGACY_FALLBACK") === true;
}
