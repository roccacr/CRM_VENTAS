import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { SUBSIDIARIES_CATALOG } from "./subsidiaries-definition";

/** Subsidiary-owned route; the shared view guarantees exact Projects interaction and visual parity. */
export function SubsidiariesPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={SUBSIDIARIES_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
