import type { AdministrationCatalogDefinition } from "../catalogs/catalog-definitions";

/** La identidad de clases queda aparte. La presentación reutiliza el diseño de Proyectos. El formulario de esta pantalla corta el nombre en 100 caracteres. */
export const CLASSES_CATALOG: AdministrationCatalogDefinition = {
    code: "classes",
    createPermission: "administration.catalog_class.create",
    label: "Clases",
    menuItemCode: "catalog-classes",
    moduleCode: "catalog_class",
    path: "/home/administration/catalogs/classes",
    readPermission: "administration.catalog_class.read",
};

export const CLASSES_PRESENTATION = { enhanced: true, scopeClass: "catalog-items-page--projects", entity: "Clase", create: "Nueva clase", refresh: "Actualizar clases" };
export const CLASSES_FORM_COPY = { placeholder: "Ej. Clase principal", submit: "Crear clase", createTitle: "Nueva clase", editTitle: "Editar clase" };
export const CLASSES_NAME_MAX_LENGTH = 100;
