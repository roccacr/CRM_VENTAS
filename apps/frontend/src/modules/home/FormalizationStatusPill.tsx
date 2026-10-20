import { type FormalizationExample, isUnassigned } from "./formalization-preview.model";

/** Estado con texto visible; el tono de advertencia solo marca órdenes sin responsable. */
export function FormalizationStatusPill({ item, label }: { readonly item: FormalizationExample; readonly label?: string }) {
    return <span className={`formalization-status${isUnassigned(item) ? " formalization-status--attention" : ""}`}>{label ?? item.state}</span>;
}

/** Valor ausente en grilla: guion discreto visible y texto completo para lectores de pantalla. */
export function FormalizationEmptyValue() {
    return (
        <span className="formalization-empty-value" title="Sin asignar">
            <span aria-hidden="true">—</span>
            <span className="formalization-sr">Sin asignar</span>
        </span>
    );
}
