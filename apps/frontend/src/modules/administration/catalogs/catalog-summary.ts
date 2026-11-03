import type { SystemUsersSummary } from "../../../services/auth/identity-contracts";
import type { CatalogItem } from "../../../services/catalogs/catalog-service";

export type CatalogBannerIcon = "total" | "active" | "inactive" | "linked" | "projects" | "loaded" | "selected" | "people" | "pending" | "blocked" | "contract" | "send" | "bank";
export type CatalogBannerTone = "neutral" | "success" | "pending" | "danger";

/** One summary card at the top of a catalog page. Values are text so a missing figure can show as a dash, never as zero. */
export interface CatalogBannerData {
    readonly helpText?: string;
    readonly metrics?: readonly { readonly label: string; readonly value: string }[];
    readonly id: string;
    readonly title: string;
    readonly value: string;
    readonly caption: string;
    readonly icon: CatalogBannerIcon;
    readonly tone: CatalogBannerTone;
}

const count = new Intl.NumberFormat("es-CR");

/** A value counts as integrated when at least one external system holds its identifier. */
const hasExternalReference = (item: CatalogItem): boolean => item.externalReferences.some((reference) => reference.externalId.trim() !== "");

/**
 * Cards for a catalog list. `total` comes from the API and covers every record; the other figures are counted over the
 * rows already loaded, so when the list is paged the caption says so instead of presenting a partial count as the whole.
 */
export function buildCatalogItemCards({ label, items, total, ready }: { readonly label: string; readonly items: readonly CatalogItem[]; readonly total: number; readonly ready: boolean }): CatalogBannerData[] {
    const dash = "—";
    const complete = items.length >= total;
    const scope = (whole: string): string => (complete ? whole : `En esta página (${count.format(items.length)} de ${count.format(total)})`);
    const figure = (value: number): string => (ready ? count.format(value) : dash);
    return [
        { id: "total", title: `Total de ${label.toLocaleLowerCase("es-CR")}`, value: figure(total), caption: "Registrados en el CRM", icon: "total", tone: "neutral" },
        { id: "active", title: "Activos", value: figure(items.filter((item) => item.status === "active").length), caption: scope("Disponibles para usar"), icon: "active", tone: "success" },
        { id: "inactive", title: "Inactivos", value: figure(items.filter((item) => item.status === "inactive").length), caption: scope("Fuera de uso"), icon: "inactive", tone: "pending" },
        { id: "linked", title: "Con integración", value: figure(items.filter(hasExternalReference).length), caption: scope("Con referencia en un sistema externo"), icon: "linked", tone: "neutral" },
    ];
}

/** Cards for the banks list; `total` covers every bank, the rest is counted over the loaded rows and says so when paged. */
export function buildBankCards({ items, total, ready }: { readonly items: readonly { readonly status: string; readonly advisorCount: number }[]; readonly total: number; readonly ready: boolean }): CatalogBannerData[] {
    const figure = (value: number): string => (ready ? count.format(value) : "—");
    const scope = (whole: string): string => (items.length >= total ? whole : `En esta página (${count.format(items.length)} de ${count.format(total)})`);
    return [
        { id: "total", title: "Total de bancos", value: figure(total), caption: "Registrados en el CRM", icon: "bank", tone: "neutral" },
        { id: "active", title: "Activos", value: figure(items.filter((item) => item.status === "active").length), caption: scope("Disponibles para usar"), icon: "active", tone: "success" },
        { id: "inactive", title: "Inactivos", value: figure(items.filter((item) => item.status === "inactive").length), caption: scope("Fuera de uso"), icon: "inactive", tone: "pending" },
        { id: "advisors", title: "Ejecutivos", value: figure(items.reduce((sum, item) => sum + item.advisorCount, 0)), caption: scope("Contactos vinculados a los bancos"), icon: "people", tone: "neutral" },
    ];
}

/** Cards for the unit-file search, from state the page already holds. */
export function buildUnitFileCards({ projects, loaded, selected, hasSearched }: { readonly projects: number; readonly loaded: number; readonly selected: number; readonly hasSearched: boolean }): CatalogBannerData[] {
    return [
        { id: "projects", title: "Proyectos disponibles", value: count.format(projects), caption: "Para filtrar la búsqueda", icon: "projects", tone: "neutral" },
        { id: "loaded", title: "Expedientes cargados", value: hasSearched ? count.format(loaded) : "—", caption: hasSearched ? "En la página actual" : "Aún sin búsqueda", icon: "loaded", tone: "success" },
        { id: "selected", title: "Seleccionados", value: count.format(selected), caption: "Para comparar entre sí", icon: "selected", tone: "pending" },
    ];
}

/**
 * Cards for the user directory. The API counts the whole directory by status and ignores the search and the active
 * filter, so these figures never change while someone is filtering the table. Before the first answer they show a dash.
 */
export function buildUserCards({ summary, ready }: { readonly summary: SystemUsersSummary; readonly ready: boolean }): CatalogBannerData[] {
    const figure = (value: number): string => (ready ? count.format(value) : "—");
    return [
        { id: "all", title: "Total de usuarios", value: figure(summary.all), caption: "Con cuenta en el CRM", icon: "people", tone: "neutral" },
        { id: "active", title: "Activos", value: figure(summary.active), caption: "Pueden entrar al sistema", icon: "active", tone: "success" },
        { id: "pending", title: "Pendientes", value: figure(summary.pending), caption: "Esperan activar su cuenta", icon: "pending", tone: "pending" },
        { id: "blocked", title: "Bloqueados", value: figure(summary.blocked), caption: "Sin acceso por seguridad", icon: "blocked", tone: "danger" },
        { id: "inactive", title: "Inactivos", value: figure(summary.inactive), caption: "Dados de baja", icon: "inactive", tone: "neutral" },
    ];
}
