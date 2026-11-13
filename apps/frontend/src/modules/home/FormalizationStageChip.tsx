import { stageToneOf } from "./formalization-stage-tone";

/** La etapa como pastilla. Una orden sin etapa se muestra más tenue porque todavía no empezó. */
export function StageChip({ label, code, saleLost = false }: { readonly label: string; readonly code?: string; readonly saleLost?: boolean }) {
    const none = label.startsWith("Sin etapa");
    const tone = stageToneOf(code);
    return (
        <span className={`formalization-state${none ? " formalization-state--none" : ""}`} data-tone={none ? undefined : tone} data-sale-lost={saleLost}>
            {saleLost ? `${label} / Caída` : label}
        </span>
    );
}
