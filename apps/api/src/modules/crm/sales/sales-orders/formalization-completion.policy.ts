/** Reglas finales aprobadas en las imágenes; NULL nunca equivale a un check desmarcado. */
export interface CompletionFlags {
    installmentsFullyPaid: boolean | null;
    unitTransferred: boolean | null;
    keysDelivered: boolean | null;
    unitDelivered: boolean | null;
}

export const COMPLETION_STAGES = ["pending_transfer", "transfer_signed", "closed"] as const;
export type CompletionStage = (typeof COMPLETION_STAGES)[number];

/** Cierre tiene prioridad por entrega física; cuotas siguen siendo obligatorias en las dos etapas de traspaso. */
export function formalizationCompletionTarget(flags: CompletionFlags): CompletionStage | null {
    if (flags.unitDelivered === true) return "closed";
    if (flags.installmentsFullyPaid !== true || flags.unitDelivered !== false) return null;
    if (flags.unitTransferred === false) return "pending_transfer";
    if (flags.unitTransferred === true && flags.keysDelivered === false) return "transfer_signed";
    return null;
}

/** La observacion ERP acredita pasos ya completados; el avance manual conserva su propia validacion. */
export function netsuiteFormalizationTarget(flags: Omit<CompletionFlags, "keysDelivered"> & { purchaseFundsOrigin: unknown }) {
    if (flags.unitTransferred === true || flags.unitDelivered === true) return "closed";
    if (flags.installmentsFullyPaid === true) return "pending_transfer";
    return flags.purchaseFundsOrigin === "own_funds" ? "pending_balance" : "bank_management";
}
