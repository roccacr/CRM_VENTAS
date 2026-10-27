/** Stage as a chip; an order without a stage is shown quieter because nothing has started yet. */
export function StageChip({ label }: { readonly label: string }) {
    return <span className={`formalization-state${label.startsWith("Sin etapa") ? " formalization-state--none" : ""}`}>{label}</span>;
}
