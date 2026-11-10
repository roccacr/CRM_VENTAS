import type { AdministrationCatalogDefinition } from "../catalogs/catalog-definitions";

/** La identidad de subsidiarias queda aparte. La presentación reutiliza el diseño de Proyectos. El formulario de esta pantalla corta el nombre en 250 caracteres. */
export const SUBSIDIARIES_CATALOG: AdministrationCatalogDefinition = {
    code: "subsidiaries",
    createPermission: "administration.catalog_subsidiary.create",
    label: "Subsidiarias",
    menuItemCode: "catalog-subsidiaries",
    moduleCode: "catalog_subsidiary",
    path: "/home/administration/catalogs/subsidiaries",
    readPermission: "administration.catalog_subsidiary.read",
};

export const SUBSIDIARIES_PRESENTATION = { enhanced: true, scopeClass: "catalog-items-page--projects", entity: "Subsidiaria", create: "Nueva subsidiaria", refresh: "Actualizar subsidiarias" };
export const SUBSIDIARIES_FORM_COPY = { placeholder: "Ej. Subsidiaria principal", submit: "Crear subsidiaria", createTitle: "Nueva subsidiaria", editTitle: "Editar subsidiaria" };
export const SUBSIDIARIES_NAME_MAX_LENGTH = 250;
