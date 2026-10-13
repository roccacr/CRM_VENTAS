import type { AdministrationCatalogDefinition } from "../catalogs/catalog-definitions";

/** Broker identity stays separate; presentation reuses the approved Projects design. */
export const BROKERS_CATALOG: AdministrationCatalogDefinition = {
    code: "brokers",
    createPermission: "administration.catalog_broker.create",
    label: "Corredores",
    menuItemCode: "catalog-brokers",
    moduleCode: "catalog_broker",
    path: "/home/administration/catalogs/brokers",
    readPermission: "administration.catalog_broker.read",
};

export const BROKERS_PRESENTATION = { enhanced: true, scopeClass: "catalog-items-page--projects", entity: "Corredor", create: "Nuevo corredor", refresh: "Actualizar corredores" };
export const BROKERS_FORM_COPY = { placeholder: "Ej. Corredor principal", submit: "Crear corredor", createTitle: "Nuevo corredor", editTitle: "Editar corredor" };
export const BROKERS_NAME_MAX_LENGTH = 250;
