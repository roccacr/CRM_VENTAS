import "./NotesSavingOverlay.css";

import Spin from "antd/es/spin";

/**
 * Precarga compartida por cada acción de nota: crear, editar, compartir, responder y cambiar el estado.
 * Una pastilla con un spinner flota arriba del panel que la contiene mientras una escritura está en curso. No oscurece ni bloquea el panel.
 * Los controles se bloquean solos. El texto también es el mensaje de la región viva para lectores de pantalla.
 */
export function NotesSavingOverlay({ label = "Guardando…" }: { readonly label?: string }) {
    return (
        <div className="notes-saving-overlay" role="status" aria-live="polite">
            <div className="notes-saving-overlay__card">
                <Spin size="small" />
                <span>{label}</span>
            </div>
        </div>
    );
}
