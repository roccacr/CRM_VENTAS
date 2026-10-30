import { FOLLOW_UP_QUEUES, type FollowUp, type FollowUpQueue } from "../../services/formalization/follow-up-service";
import type { CatalogBannerData } from "../administration/catalogs/catalog-summary";

const count = new Intl.NumberFormat("es-CR");

/**
 * Counters for the order list, taken from the per-queue totals the follow-up API already returns.
 * They describe the whole portfolio, not the current filter, so a filter never makes a card read as a false zero.
 * Until the API answers every figure is a dash: a dash means "not known yet", a zero means "none".
 */
export function buildOrderCards(counts: FollowUp["counts"] | null, queues: readonly FollowUpQueue[] = FOLLOW_UP_QUEUES): CatalogBannerData[] {
    const figure = (queue: keyof FollowUp["counts"]): string => (counts ? count.format(counts[queue]) : "—");
    const cards: CatalogBannerData[] = [
        { id: "all", title: "Total de órdenes", value: figure("all"), caption: "En todas las bandejas", icon: "total", tone: "neutral" },
        { id: "approvals", title: "Pendientes de aprobación", value: figure("approvals"), caption: "Órdenes", icon: "pending", tone: "pending" },
        {
            id: "contracts",
            metrics: (
                [
                    { queue: "send", label: "Por enviar" },
                    { queue: "signature", label: "Pendientes de firma" },
                ] as const
            )
                .filter((metric) => queues.includes("contracts") || queues.includes(metric.queue))
                .map((metric) => ({ label: metric.label, value: figure(metric.queue) })),
            title: "Contratos pendientes",
            value: figure("contracts"),
            caption: "Órdenes",
            icon: "contract",
            tone: "pending",
        },
        { id: "bank", title: "Gestión bancaria", value: figure("bank"), caption: "Órdenes", icon: "bank", tone: "neutral" },
        { id: "balance", title: "Pendientes de saldo", value: figure("balance"), caption: "Órdenes", icon: "contract", tone: "neutral" },
        { id: "transfer", title: "Traspasos pendientes", value: figure("transfer"), caption: "Órdenes", icon: "selected", tone: "pending" },
        { id: "signed", title: "Traspaso firmado", value: figure("signed"), caption: "Órdenes", icon: "active", tone: "success" },
        { id: "closed", title: "Formalizaciones cerradas este año", value: figure("closed"), caption: "Órdenes", icon: "active", tone: "success" },
    ];
    return cards.filter((card) => (card.id === "contracts" ? ["contracts", "send", "signature"].some((queue) => queues.includes(queue as FollowUpQueue)) : queues.includes(card.id as FollowUpQueue)));
}
