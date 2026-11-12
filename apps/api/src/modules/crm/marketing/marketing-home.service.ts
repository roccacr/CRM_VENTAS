import { BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { IdentityService } from "../identity/identity.service.js";
import { createMarketingWindow, marketingHomeQuery, type MarketingHomeSummary } from "./marketing-home.contract.js";
import { buildMarketingHome } from "./marketing-home.model.js";
import { MARKETING_HOME_LEGACY_READER, type MarketingHomeLegacyReader } from "./marketing-home.port.js";
import { MarketingHomeRepository } from "./marketing-home.repository.js";
import { hasGlobalMarketingRead } from "./marketing-read.policy.js";

/**
 * Autoriza `mercadeo.home.read` antes de cualquiera de las dos fuentes.
 * Hace falta un allow y ningún deny. Lee primero lo nativo. Si la foto falla, responde 503 y no inventa un conteo parcial.
 */
@Injectable()
export class MarketingHomeService {
    /** La identidad resuelve la sesión. El repositorio abre la foto y el puerto viejo solo se consulta si `enabled` está activo. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(MarketingHomeRepository) private readonly repository: MarketingHomeRepository,
        @Inject(MARKETING_HOME_LEGACY_READER) private readonly legacy: MarketingHomeLegacyReader,
    ) {}
    /**
     * Resumen del inicio. Un alcance desconocido se rechaza. `mercadeo.reports.read_all` o el alcance `all_areas` no filtran vendedores; los demás alcances usan la unidad activa.
     * El puerto apagado deja filas y dueños vacíos. No completa el resumen con conteos inventados.
     */
    async summary(session: string | undefined, query: unknown): Promise<MarketingHomeSummary> {
        const profile = await this.identity.getCurrentUser(session);
        const grants = profile.permissions.filter((permission) => permission.code === "mercadeo.home.read");
        if (!grants.some((permission) => permission.effect === "allow") || grants.some((permission) => permission.effect === "deny")) throw new ForbiddenException("Permiso insuficiente para Inicio de Mercadeo.");
        const allowed = grants.filter((permission) => permission.effect === "allow");
        if (!allowed.every((permission) => ["self", "assigned", "own_area", "own_area_and_children", "all_areas"].includes(permission.scope))) throw new ForbiddenException("Alcance de Mercadeo no reconocido.");

        const parsed = marketingHomeQuery.safeParse(query);
        if (!parsed.success) throw new BadRequestException("Periodo de Mercadeo invalido.");
        const now = new Date();
        const window = createMarketingWindow(parsed.data.period, now);
        try {
            return await this.repository.readSnapshot(async (tx) => {
                const enabled = this.legacy.enabled();
                const native = await this.repository.readNative(tx, window, enabled);
                const legacy = enabled ? await this.legacy.read(tx, window) : { provider: "netsuite", rows: [], owners: [] };
                const sellerScope =
                    hasGlobalMarketingRead(profile) || allowed.some((permission) => permission.scope === "all_areas")
                        ? undefined
                        : await this.repository.visibleSellers(
                              tx,
                              profile,
                              allowed.map((permission) => permission.scope),
                          );
                return buildMarketingHome(native, legacy, window, { observedAt: now, legacyEnabled: enabled, ...(sellerScope ? { sellerScope } : {}) });
            });
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar los leads de Mercadeo.");
        }
    }
}
