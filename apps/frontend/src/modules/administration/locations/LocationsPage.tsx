import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { LOCATIONS_CATALOG } from "./locations-definition";

/** Location-owned route; the shared view guarantees exact Projects interaction and visual parity. */
export function LocationsPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={LOCATIONS_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
