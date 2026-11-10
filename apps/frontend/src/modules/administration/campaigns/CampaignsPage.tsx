import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { CatalogItemsPage } from "../catalogs/CatalogItemsPage";
import { CAMPAIGNS_CATALOG } from "./campaigns-definition";

/** Ruta propia de campañas. La vista compartida conserva la interacción y el aspecto de Proyectos. La identidad y los permisos siguen siendo de este catálogo. */
export function CampaignsPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    return <CatalogItemsPage catalog={CAMPAIGNS_CATALOG} contextLabel={contextLabel} contextModuleCode={contextModuleCode} />;
}
