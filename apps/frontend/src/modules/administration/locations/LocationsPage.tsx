import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { LOCATIONS_CATALOG } from "./locations-definition";

/** Ruta propia de ubicaciones. La vista compartida conserva la interacción y el aspecto de Proyectos. La identidad y los permisos siguen siendo de este catálogo. */
export function LocationsPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={LOCATIONS_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
