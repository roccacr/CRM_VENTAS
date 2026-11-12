import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { useState } from "react";

import { currentFiniquitoStage, DEFAULT_FINIQUITO_REASON, FINIQUITO_SECTIONS, type FiniquitoManualChange, type FiniquitoManualStage, type FiniquitoSnapshot } from "../../services/formalization/finiquito-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";

/** Ajuste explícito para órdenes históricas. El servidor vuelve a validar permiso, versión y elegibilidad. */
export function FormalizationFiniquitoStageEditor({ data, disabled, busy, onSave }: { readonly data: FiniquitoSnapshot; readonly disabled: boolean; readonly busy: boolean; readonly onSave: (change: FiniquitoManualChange) => Promise<void> }) {
    const current = currentFiniquitoStage(data);
    const [target, setTarget] = useState<FiniquitoManualStage>(current);
    const [reason, setReason] = useState(DEFAULT_FINIQUITO_REASON);
    const [confirmation, setConfirmation] = useState<FiniquitoManualChange | null>(null);
    const controlsDisabled = disabled || busy;
    const selected = FINIQUITO_SECTIONS.find((stage) => stage.code === confirmation?.targetStage);
    return (
        <div className="formalization-finiquito__manual">
            <p>Para órdenes antiguas puedes ajustar la etapa del finiquito. El cambio queda registrado y no modifica los checks de NetSuite.</p>
            <label>
                Estado del finiquito
                <select
                    disabled={controlsDisabled}
                    value={target}
                    onChange={(event) => {
                        setTarget(event.target.value as FiniquitoManualStage);
                    }}
                >
                    {FINIQUITO_SECTIONS.map((stage) => (
                        <option key={stage.code} value={stage.code}>
                            {stage.label}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                Motivo del cambio de finiquito (opcional)
                <textarea
                    disabled={controlsDisabled}
                    value={reason}
                    maxLength={1000}
                    rows={2}
                    onChange={(event) => {
                        setReason(event.target.value);
                    }}
                />
            </label>
            <div className="formalization-finiquito__manual-actions">
                <Button
                    disabled={[controlsDisabled, target === current].some(Boolean)}
                    onClick={() => {
                        setConfirmation({ targetStage: target, reason: reason.trim() || DEFAULT_FINIQUITO_REASON });
                    }}
                >
                    Guardar
                </Button>
                <Button
                    disabled={[controlsDisabled, current === "formalized"].some(Boolean)}
                    onClick={() => {
                        setConfirmation({ targetStage: "formalized", reason: reason.trim() || DEFAULT_FINIQUITO_REASON });
                    }}
                >
                    Terminar finiquito
                </Button>
            </div>
            <Modal
                open={confirmation !== null}
                title="Confirmar cambio de finiquito"
                okText="Confirmar cambio"
                cancelText="Cancelar"
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                confirmLoading={busy}
                closable={!busy}
                mask={{ closable: !busy }}
                keyboard={!busy}
                cancelButtonProps={{ disabled: busy }}
                onCancel={() => {
                    setConfirmation(null);
                }}
                onOk={() => {
                    if (!confirmation || busy) return;
                    void onSave(confirmation).finally(() => {
                        setConfirmation(null);
                    });
                }}
            >
                <p>¿Mover esta orden a {selected?.label}?</p>
                <p>Motivo: {confirmation?.reason}</p>
                <p>Se ajustarán las marcas del finiquito según el destino. El historial anterior se conserva. Este registro manual no envía correos ni modifica la etapa comercial.</p>
            </Modal>
        </div>
    );
}
