import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { SUBSIDIARIES_CATALOG } from "./subsidiaries-definition";

/** Ruta propia de subsidiarias. La vista compartida conserva la interacción y el aspecto de Proyectos. La identidad y los permisos siguen siendo de este catálogo. */
export function SubsidiariesPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={SUBSIDIARIES_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
