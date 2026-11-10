import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { BROKERS_CATALOG } from "./brokers-definition";

/** Ruta propia de corredores. La vista compartida conserva la interacción y el aspecto de Proyectos. La identidad y los permisos siguen siendo de este catálogo. */
export function BrokersPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={BROKERS_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
