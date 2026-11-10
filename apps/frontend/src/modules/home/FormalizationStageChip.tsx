/** La etapa como pastilla. Una orden sin etapa se muestra más tenue porque todavía no empezó. */
export function StageChip({ label }: { readonly label: string }) {
    return <span className={`formalization-state${label.startsWith("Sin etapa") ? " formalization-state--none" : ""}`}>{label}</span>;
}
