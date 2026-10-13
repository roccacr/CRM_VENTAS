import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { CAMPAIGNS_CATALOG } from "./campaigns-definition";

/** Campaign-owned route; the shared view guarantees exact Projects interaction and visual parity. */
export function CampaignsPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={CAMPAIGNS_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
