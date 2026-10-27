import type { FollowUp } from "../../services/formalization/follow-up-service";
import type { CatalogBannerData } from "../administration/catalogs/catalog-summary";

const count = new Intl.NumberFormat("es-CR");

/**
 * Counters for the order list, taken from the per-queue totals the follow-up API already returns.
 * They describe the whole portfolio, not the current filter, so a filter never makes a card read as a false zero.
 * Until the API answers every figure is a dash: a dash means "not known yet", a zero means "none".
 */
export function buildOrderCards(counts: FollowUp["counts"] | null): CatalogBannerData[] {
    const figure = (queue: keyof FollowUp["counts"]): string => (counts ? count.format(counts[queue]) : "—");
    return [
        { id: "all", title: "Total de órdenes", value: figure("all"), caption: "En todas las bandejas", icon: "total", tone: "neutral" },
        { id: "contracts", title: "Contratos pendientes", value: figure("contracts"), caption: "Órdenes", icon: "contract", tone: "pending" },
        { id: "send", title: "Por enviar", value: figure("send"), caption: "Órdenes", icon: "send", tone: "pending" },
        { id: "signature", title: "Pendientes de firma", value: figure("signature"), caption: "Órdenes", icon: "pending", tone: "pending" },
        { id: "bank", title: "Gestión bancaria", value: figure("bank"), caption: "Órdenes", icon: "bank", tone: "neutral" },
    ];
}
