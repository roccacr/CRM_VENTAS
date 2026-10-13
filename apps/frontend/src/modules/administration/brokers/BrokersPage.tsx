import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { BROKERS_CATALOG } from "./brokers-definition";

/** Broker-owned route; the shared view guarantees exact Projects interaction and visual parity. */
export function BrokersPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={BROKERS_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
