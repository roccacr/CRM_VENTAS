/**
 * Lectura opcional del CRM viejo sin que el core importe ese adaptador.
 *
 * Proyectos, campanas, clases, ubicaciones, subsidiarias y corredores mezclan filas nativas con filas legacy no migradas.
 * Cada dominio conserva su estrategia y sus identificadores de exclusion.
 */
import { mergeBrokers } from "../brokers/brokers-fallback.js";
import { mergeCampaigns } from "../campaigns/campaigns-fallback.js";
import { mergeClasses } from "../classes/classes-fallback.js";
import { mergeLocations } from "../locations/locations-fallback.js";
import { mergeProjects } from "../projects/projects-fallback.js";
import { mergeSubsidiaries } from "../subsidiaries/subsidiaries-fallback.js";
import type { CatalogRouteCode, CatalogStatus } from "./catalogs.constants.js";
import type { CatalogItemsResponse } from "./catalogs.types.js";

/** Token del lector legacy. Si nadie lo provee, los catálogos quedan solo en el CRM nuevo. */
export const CATALOG_FALLBACK_READER = Symbol("CATALOG_FALLBACK_READER");

/** Filtros comunes del listado. El lector legacy puede recibir además los ids ya migrados. */
export interface CatalogReadInput {
    catalogCode: CatalogRouteCode;
    limit?: number;
    offset?: number;
    search?: string;
    status?: CatalogStatus;
}

/**
 * Puerto hacia afuera.
 *
 * El core solo conoce `enabled` y `list`. Las tablas viejas quedan del otro lado.
 */
export interface CatalogFallbackReader {
    enabled(): boolean;
    list(input: CatalogReadInput & { excludedLegacyIds?: readonly number[] }): Promise<CatalogItemsResponse>;
}

/**
 * Lector nativo que el fallback puede completar.
 *
 * Cada mezcla exige los identificadores migrados de su dominio.
 */
export interface PrimaryCatalogReader {
    listCatalogItems(input: CatalogReadInput): Promise<CatalogItemsResponse>;
    listMigratedProjectIds?(): Promise<readonly number[]>;
    listMigratedCampaignIds?(): Promise<readonly number[]>;
    listMigratedClassIds?(): Promise<readonly number[]>;
    listMigratedLocationIds?(): Promise<readonly number[]>;
    listMigratedSubsidiaryIds?(): Promise<readonly number[]>;
    listMigratedBrokerIds?(): Promise<readonly number[]>;
}

const mergeStrategies: Partial<Record<CatalogRouteCode, typeof mergeProjects>> = {
    projects: mergeProjects,
    campaigns: mergeCampaigns,
    classes: mergeClasses,
    locations: mergeLocations,
    subsidiaries: mergeSubsidiaries,
    brokers: mergeBrokers,
};

/**
 * Devuelve la página nativa y, si aplica, la completa con el CRM viejo.
 *
 * Los dominios registrados delegan en su estrategia de merge. Los demas dominios
 * permanecen exclusivamente en su almacenamiento nativo.
 *
 * @param primary - Repositorio del CRM nuevo
 * @param input - Código, página y filtros
 * @param fallback - Lector legacy. Ausente o apagado deja la respuesta nativa
 */
export async function readCatalogWithFallback(primary: PrimaryCatalogReader, input: CatalogReadInput, fallback?: CatalogFallbackReader): Promise<CatalogItemsResponse> {
    const result = await primary.listCatalogItems(input);
    if (!fallback?.enabled()) return result;
    const merge = mergeStrategies[input.catalogCode];
    return merge ? merge(primary, input, result, fallback) : result;
}
