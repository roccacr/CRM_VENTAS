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

/** Tono de una etapa, para que la fila y la pastilla compartan el color de su tarjeta. */
export const stageToneOf = (code: string | undefined): "pending" | "neutral" | "success" | undefined => (code ? STAGE_TONE[code] : undefined);
