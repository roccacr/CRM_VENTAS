import type { AdministrationCatalogDefinition } from "../catalogs/catalog-definitions";

/** Campaign identity stays separate; presentation reuses the approved Projects design. */
export const CAMPAIGNS_CATALOG: AdministrationCatalogDefinition = {
    code: "campaigns",
    createPermission: "administration.catalog_campaign.create",
    label: "Campañas",
    menuItemCode: "catalog-campaigns",
    moduleCode: "catalog_campaign",
    path: "/home/administration/catalogs/campaigns",
    readPermission: "administration.catalog_campaign.read",
};

export const CAMPAIGNS_PRESENTATION = { enhanced: true, scopeClass: "catalog-items-page--projects", entity: "Campaña", create: "Nueva campaña", refresh: "Actualizar campañas" };
export const CAMPAIGNS_FORM_COPY = { placeholder: "Ej. Campaña principal", submit: "Crear campaña", createTitle: "Nueva campaña", editTitle: "Editar campaña" };
