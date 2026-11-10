import type { AdministrationCatalogDefinition } from "../catalogs/catalog-definitions";

/** La identidad de ubicaciones queda aparte. La presentación reutiliza el diseño de Proyectos. El formulario de esta pantalla corta el nombre en 100 caracteres. */
export const LOCATIONS_CATALOG: AdministrationCatalogDefinition = {
    code: "locations",
    createPermission: "administration.catalog_location.create",
    label: "Ubicaciones",
    menuItemCode: "catalog-locations",
    moduleCode: "catalog_location",
    path: "/home/administration/catalogs/locations",
    readPermission: "administration.catalog_location.read",
};

export const LOCATIONS_PRESENTATION = { enhanced: true, scopeClass: "catalog-items-page--projects", entity: "Ubicación", create: "Nueva ubicación", refresh: "Actualizar ubicaciones" };
export const LOCATIONS_FORM_COPY = { placeholder: "Ej. Ubicación principal", submit: "Crear ubicación", createTitle: "Nueva ubicación", editTitle: "Editar ubicación" };
export const LOCATIONS_NAME_MAX_LENGTH = 100;
