import { FOLLOW_UP_QUEUES, type FollowUp, type FollowUpQueue } from "../../services/formalization/follow-up-service";
import type { CatalogBannerData } from "../administration/catalogs/catalog-summary";
import { FORMALIZATION_QUEUE_HELP } from "./formalization-queue-help";

const count = new Intl.NumberFormat("es-CR");

/**
 * Contadores de la lista de órdenes, tomados de los totales por cola que el API de seguimiento ya devuelve.
 * Describen todo el portafolio, no el filtro actual, así que un filtro no hace que una tarjeta lea un cero falso.
 * Hasta que el API responde, cada cifra es una raya. La raya significa que todavía no se sabe. El cero significa que no hay ninguno.
 */
export function buildOrderCards(counts: FollowUp["counts"] | null, queues: readonly FollowUpQueue[] = FOLLOW_UP_QUEUES): CatalogBannerData[] {
    const figure = (queue: keyof FollowUp["counts"]): string => {
        const value = counts?.[queue];
        return value === undefined ? "—" : count.format(value);
    };
    const cards: CatalogBannerData[] = [
        { id: "all", title: "Total de órdenes", value: figure("all"), caption: "En todas las bandejas", icon: "total", tone: "neutral" },
        { id: "approvals", title: "Pendientes de aprobación", value: figure("approvals"), caption: "Órdenes", icon: "pending", tone: "pending" },
        { id: "addendum", title: "Pendientes de adéndum", value: figure("addendum"), caption: "Marca pendiente", icon: "contract", tone: "pending" },
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
        {
            id: "bank",
            title: "Gestión bancaria",
            metrics: [
                { label: "Sin iniciar", value: counts && counts.bankInProgress !== undefined ? count.format(counts.bank - counts.bankInProgress) : "—" },
                { label: "En proceso", value: figure("bankInProgress") },
            ],
            value: figure("bank"),
            caption: "Órdenes",
            icon: "bank",
            tone: "neutral",
        },
        { id: "balance", title: "Pendientes de saldo", value: figure("balance"), caption: "Órdenes", icon: "contract", tone: "neutral" },
        { id: "transfer", title: "Traspasos pendientes", value: figure("transfer"), caption: "Órdenes", icon: "selected", tone: "pending" },
        { id: "signed", title: "Traspaso firmado", value: figure("signed"), caption: "Órdenes", icon: "active", tone: "success" },
        { id: "closed", title: "Formalizaciones cerradas este año", value: figure("closed"), caption: "Órdenes", icon: "active", tone: "success" },
    ];
    return cards.filter((card) => (card.id === "contracts" ? ["contracts", "send", "signature"].some((queue) => queues.includes(queue as FollowUpQueue)) : queues.includes(card.id as FollowUpQueue))).map((card) => ({ ...card, helpText: FORMALIZATION_QUEUE_HELP[card.id as FollowUpQueue] }));
}
