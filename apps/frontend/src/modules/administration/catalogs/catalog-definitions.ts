/**
 * Catálogos administrativos que el frontend puede abrir.
 *
 * Cada entrada une el código del API, la ruta, el ítem de menú y los permisos
 * de lectura y alta. La pantalla de valores no autoriza: solo usa estos datos
 * para pedir al BFF el catálogo correcto. Los perfiles operativos reutilizan
 * el mismo `code` con otro prefijo de ruta.
 */
import type { CatalogCode } from "../../../services/catalogs/catalog-service";
import { BROKERS_CATALOG, BROKERS_PRESENTATION } from "../brokers/brokers-definition";
import { CAMPAIGNS_CATALOG, CAMPAIGNS_PRESENTATION } from "../campaigns/campaigns-definition";
import { CLASSES_CATALOG, CLASSES_PRESENTATION } from "../classes/classes-definition";
import { LOCATIONS_CATALOG, LOCATIONS_PRESENTATION } from "../locations/locations-definition";
import { SUBSIDIARIES_CATALOG, SUBSIDIARIES_PRESENTATION } from "../subsidiaries/subsidiaries-definition";

/**
 * Sistemas externos que el formulario y el detalle saben mostrar.
 *
 * Una fila sin id es solo presentación. No se envía al API como referencia.
 */
export const CATALOG_REFERENCE_PROVIDERS = [
    { systemCode: "netsuite", systemName: "NetSuite" },
    { systemCode: "odoo", systemName: "Odoo" },
] as const;

/** Approved opt-ins reuse the Projects design without changing catalog identity or permissions. */
export function getCatalogPresentation(code: string) {
    const presentations: Record<string, { enhanced: boolean; scopeClass: string; entity: string; create: string; refresh: string }> = {
        projects: { enhanced: true, scopeClass: "catalog-items-page--projects", entity: "Proyecto", create: "Nuevo proyecto", refresh: "Actualizar proyectos" },
        campaigns: CAMPAIGNS_PRESENTATION,
        classes: CLASSES_PRESENTATION,
        locations: LOCATIONS_PRESENTATION,
        subsidiaries: SUBSIDIARIES_PRESENTATION,
        brokers: BROKERS_PRESENTATION,
    };
    return presentations[code] ?? { enhanced: false, scopeClass: "", entity: "Nombre", create: "Nuevo valor", refresh: "Actualizar catálogo" };
}

/**
 * Definición de un catálogo CRM visible desde Administración.
 *
 * `moduleCode` identifica el módulo de permisos. El contexto operativo
 * (ventas, mercadeo, etc.) lo envía la pantalla al listar, no esta definición.
 */
export interface AdministrationCatalogDefinition {
    /** Código canónico usado en `/catalogs/:code`. */
    readonly code: CatalogCode;
    /** Permiso que el API exige para crear un valor. La UI no lo trata como autorización final. */
    readonly createPermission: string;
    /** Etiqueta en español para menú, título y mensajes. */
    readonly label: string;
    /** Código del ítem que el shell marca activo. */
    readonly menuItemCode: string;
    /** Módulo de permisos del catálogo, por ejemplo `catalog_project`. */
    readonly moduleCode: string;
    /** Ruta privada dentro de Administración. */
    readonly path: string;
    /** Permiso que el API exige para leer el catálogo. */
    readonly readPermission: string;
}

/**
 * Catálogos nativos del CRM que Administración administra.
 *
 * El orden es el del menú. No incluye catálogos de otros perfiles: esas rutas
 * se arman en `app-routes` a partir de esta misma lista.
 */
export const ADMINISTRATION_CATALOGS: readonly AdministrationCatalogDefinition[] = [
    { code: "projects", createPermission: "administration.catalog_project.create", label: "Proyectos", menuItemCode: "catalog-projects", moduleCode: "catalog_project", path: "/home/administration/catalogs/projects", readPermission: "administration.catalog_project.read" },
    CAMPAIGNS_CATALOG,
    CLASSES_CATALOG,
    BROKERS_CATALOG,
    { code: "files", createPermission: "administration.catalog_file.create", label: "Expedientes", menuItemCode: "catalog-files", moduleCode: "catalog_file", path: "/home/administration/catalogs/files", readPermission: "administration.catalog_file.read" },
    SUBSIDIARIES_CATALOG,
    LOCATIONS_CATALOG,
];

/**
 * Busca el catálogo de Administración cuya ruta coincide exactamente.
 *
 * @param path - Ruta del navegador, sin query ni hash
 * @returns Definición del catálogo, o `undefined` si la ruta no es de un catálogo administrativo
 */
export const findAdministrationCatalogByPath = (path: string): AdministrationCatalogDefinition | undefined => ADMINISTRATION_CATALOGS.find((catalog) => catalog.path === path);
