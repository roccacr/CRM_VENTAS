/** Mismo criterio de color que las tarjetas de Inicio: ámbar requiere acción, azul grisáceo está en trámite, verde ya avanzó o cerró. */
const STAGE_TONE: Record<string, "pending" | "neutral" | "success"> = {
    pending_approval: "pending",
    contract_pending_send: "pending",
    contract_pending_signature: "pending",
    pending_transfer: "pending",
    bank_management: "neutral",
    bank_management_in_progress: "neutral",
    pending_balance: "neutral",
    transfer_signed: "success",
    closed: "success",
};

/** La etapa como pastilla. Una orden sin etapa se muestra más tenue porque todavía no empezó. */
export function StageChip({ label, code }: { readonly label: string; readonly code?: string }) {
    const none = label.startsWith("Sin etapa");
    const tone = code ? STAGE_TONE[code] : undefined;
    return (
        <span className={`formalization-state${none ? " formalization-state--none" : ""}`} data-tone={none ? undefined : tone}>
            {label}
        </span>
    );
}
