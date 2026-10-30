import "./NotesSavingOverlay.css";

import Spin from "antd/es/spin";

/**
 * Preloader shared by every note action (create, edit, share, reply, state changes).
 * A small pill with a spinner that floats at the top of the panel that holds it while a write is in flight. It never dims or blocks the panel;
 * the controls lock themselves. The text is also the live-region message for screen readers.
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
