/**
 * Puente de catálogos del CRM viejo.
 *
 * Implementa el puerto que el core ya conoce. No consulta tablas: reparte
 * cada código al reader de su dominio. Un catálogo sin reader se rechaza
 * para no inventar una consulta genérica sobre el esquema viejo.
 */
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CatalogFallbackReader, CatalogReadInput } from "../../modules/crm/catalogs/catalog-fallback.js";
import type { CatalogItemsResponse } from "../../modules/crm/catalogs/catalogs.types.js";
import { LegacyCampaignsReader } from "./campaigns/legacy-campaigns.reader.js";
import { isLegacyCrmEnabled } from "./legacy-crm-access.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";
import { LegacyProjectsReader } from "./projects/legacy-projects.reader.js";

/**
 *
 */
@Injectable()
export class LegacyCatalogReader implements CatalogFallbackReader {
    private readonly projects: LegacyProjectsReader;
    private readonly campaigns: LegacyCampaignsReader;

    /**
     * Arma los readers aquí para que el core no los registre uno por uno.
     *
     * @param config - Bandera `ENABLE_LEGACY_FALLBACK`
     * @param database - Pool opcional; los readers fallan al consultar si no está abierto
     */
    constructor(
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(LegacyCrmDatabaseService) database: LegacyCrmDatabaseService,
    ) {
        this.projects = new LegacyProjectsReader(config, database);
        this.campaigns = new LegacyCampaignsReader(config, database);
    }

    /**
     * Compara con `true` booleano.
     *
     * El string `"false"` no debe encender el fallback: la validación de entorno ya dejó un booleano.
     */
    enabled(): boolean {
        return isLegacyCrmEnabled(this.config);
    }

    /**
     * Lista un catálogo viejo ya mapeado al contrato nuevo.
     *
     * @param input - Código, filtros y ids que el CRM nuevo ya absorbió
     * @throws {ServiceUnavailableException} Si el fallback está apagado o el catálogo no tiene reader
     */
    async list(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse> {
        if (!this.enabled()) throw new ServiceUnavailableException("Legacy fallback is disabled.");
        if (input.catalogCode === "projects") return this.projects.list(input);
        if (input.catalogCode === "campaigns") return this.campaigns.list(input);
        throw new ServiceUnavailableException("Legacy catalog is unsupported.");
    }
}
