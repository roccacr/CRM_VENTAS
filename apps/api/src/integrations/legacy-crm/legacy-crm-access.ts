import type { ConfigService } from "@nestjs/config";

/** Master switch for legacy access; reads never imply permission to write. */
export function isLegacyCrmEnabled(config: ConfigService): boolean {
    return config.get<unknown>("ENABLE_LEGACY_FALLBACK") === true;
}

/** Legacy mutations require an explicit production-only opt-in; development stays read-only. */
export function isLegacyCrmWriteEnabled(config: ConfigService): boolean {
    return isLegacyCrmEnabled(config) && config.get<unknown>("NODE_ENV") === "production" && config.get<unknown>("LEGACY_CRM_DB_NAME") === "crmdatabase-api" && config.get<unknown>("ENABLE_LEGACY_WRITES") === true;
}
