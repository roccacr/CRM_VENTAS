/**
 * Catálogos administrativos que el frontend puede abrir.
 *
 * Cada entrada une el código del API, la ruta, el ítem de menú y los permisos
 * de lectura y alta. La pantalla de valores no autoriza: solo usa estos datos
 * para pedir al BFF el catálogo correcto. Los perfiles operativos reutilizan
 * el mismo `code` con otro prefijo de ruta.
 */
import type { CatalogCode } from "../../../services/catalogs/catalog-service";

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
        campaigns: { enhanced: true, scopeClass: "catalog-items-page--projects", entity: "Campaña", create: "Nueva campaña", refresh: "Actualizar campañas" },
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
    { code: "campaigns", createPermission: "administration.catalog_campaign.create", label: "Campañas", menuItemCode: "catalog-campaigns", moduleCode: "catalog_campaign", path: "/home/administration/catalogs/campaigns", readPermission: "administration.catalog_campaign.read" },
    { code: "classes", createPermission: "administration.catalog_class.create", label: "Clases", menuItemCode: "catalog-classes", moduleCode: "catalog_class", path: "/home/administration/catalogs/classes", readPermission: "administration.catalog_class.read" },
    { code: "brokers", createPermission: "administration.catalog_broker.create", label: "Corredores", menuItemCode: "catalog-brokers", moduleCode: "catalog_broker", path: "/home/administration/catalogs/brokers", readPermission: "administration.catalog_broker.read" },
    { code: "files", createPermission: "administration.catalog_file.create", label: "Expedientes", menuItemCode: "catalog-files", moduleCode: "catalog_file", path: "/home/administration/catalogs/files", readPermission: "administration.catalog_file.read" },
    { code: "subsidiaries", createPermission: "administration.catalog_subsidiary.create", label: "Subsidiarias", menuItemCode: "catalog-subsidiaries", moduleCode: "catalog_subsidiary", path: "/home/administration/catalogs/subsidiaries", readPermission: "administration.catalog_subsidiary.read" },
    { code: "locations", createPermission: "administration.catalog_location.create", label: "Ubicaciones", menuItemCode: "catalog-locations", moduleCode: "catalog_location", path: "/home/administration/catalogs/locations", readPermission: "administration.catalog_location.read" },
];

/**
 * Busca el catálogo de Administración cuya ruta coincide exactamente.
 *
 * @param path - Ruta del navegador, sin query ni hash
 * @returns Definición del catálogo, o `undefined` si la ruta no es de un catálogo administrativo
 */
export const findAdministrationCatalogByPath = (path: string): AdministrationCatalogDefinition | undefined => ADMINISTRATION_CATALOGS.find((catalog) => catalog.path === path);
