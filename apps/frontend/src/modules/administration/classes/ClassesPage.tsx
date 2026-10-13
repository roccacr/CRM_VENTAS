import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { CLASSES_CATALOG } from "./classes-definition";

/** Class-owned route; the shared view guarantees exact Projects interaction and visual parity. */
export function ClassesPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={CLASSES_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
