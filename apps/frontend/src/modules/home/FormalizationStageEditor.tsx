import "./FormalizationStageEditor.css";

import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ORDER_STAGES, type OrderStage, updateOrderStage } from "../../services/formalization/order-stage-service";

interface Props {
    readonly item: FollowUpItem;
    readonly allowed: boolean;
    readonly onSaved: () => void;
    readonly onRefresh: () => void;
}
/** The parent keys this editor by order/version; retry keys survive network errors within that edit. */
function useStageEdit({ item, allowed, onSaved }: Props) {
    const [target, setTarget] = useState(item.state.code);
    const [reason, setReason] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stale, setStale] = useState(false);
    const operation = useRef<string | null>(null);
    const pending = useRef(false);
    const currentIndex = ORDER_STAGES.findIndex((stage) => stage.code === item.state.code);
    const selected = ORDER_STAGES.find((stage) => stage.code === target);
    const backwards = ORDER_STAGES.findIndex((stage) => stage.code === target) < currentIndex;
    const restriction = stageEditingRestriction(item, allowed);
    const eligible = restriction === null;
    const refreshRequired = stale || restriction?.startsWith("Actualiza") === true;
    const disabled = [!eligible, busy, stale].some(Boolean);
    const canSave = stageSaveAllowed({ disabled: disabled || stageTargetRestriction(item, target) !== null, selected, different: target !== item.state.code, backwards, reason });
    const changed = () => {
        operation.current = null;
        setError(null);
    };
    const save = async () => {
        if (!canSave || pending.current) return;
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
            operation.current ??= crypto.randomUUID();
            await updateOrderStage({ source: item.source, id: item.id, expectedSequence: item.stateVersion ?? 0, operationId: operation.current, targetState: target as OrderStage, ...stageReason(backwards, reason) });
            onSaved();
        } catch (failure) {
            const result = stageFailure(failure);
            setStale(result.stale);
            setError(result.message);
        } finally {
            pending.current = false;
            setBusy(false);
            setConfirming(false);
        }
    };
    return { target, setTarget, reason, setReason, confirming, setConfirming, busy, error, stale, selected, backwards, eligible, restriction, refreshRequired, disabled, canSave, changed, save, pending };
}

function stageReason(backwards: boolean, reason: string): { reason?: string } {
    return backwards ? { reason: reason.trim() } : {};
}
/** Version zero is valid for an order with no recorded transition yet. */
function stageEditingRestriction(item: FollowUpItem, allowed: boolean): string | null {
    if (!allowed) return "No tienes permiso para cambiar la etapa.";
    if (item.approvalsComplete === undefined) return "Actualiza la orden para verificar sus aprobaciones.";
    if (!item.approvalsComplete) return "Faltan aprobaciones para cambiar la etapa.";
    if (!Number.isSafeInteger(item.stateVersion) || (item.stateVersion ?? -1) < 0) return "Actualiza la orden para cargar su estado actual.";
    return null;
}
function stageSaveAllowed({ disabled, selected, different, backwards, reason }: { disabled: boolean; selected: unknown; different: boolean; backwards: boolean; reason: string }): boolean {
    if (disabled || !selected || !different) return false;
    return !backwards || reason.trim().length > 0;
}

/** One-click action of each stage, worded as a command ("Marcar como…"): it asks, and only the confirmation dialog saves. */
const ADVANCE_LABELS: Partial<Record<OrderStage, string>> = {
    contract_pending_send: "Marcar como enviado",
    contract_pending_signature: "Marcar como firmado",
    bank_management: "Marcar gestión bancaria lista",
    pending_balance: "Marcar saldo como pagado",
    pending_transfer: "Marcar traspaso como firmado",
    transfer_signed: "Cerrar formalización",
};

/** Moves to the following stage; the confirmation dialog still asks before anything is saved. */
function AdvanceAction({ item, model }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit> }) {
    const index = ORDER_STAGES.findIndex((stage) => stage.code === item.state.code);
    const next = ORDER_STAGES[index + 1];
    const label = ADVANCE_LABELS[item.state.code as OrderStage];
    if (index < 0 || !next || !label) return null;
    return (
        <div className="formalization-stage-editor__advance">
            <Button
                className="formalization-advance-btn"
                icon={<ArrowRightOutlined aria-hidden="true" />}
                disabled={model.disabled || model.confirming || stageTargetRestriction(item, next.code) !== null}
                onClick={() => {
                    model.changed();
                    model.setTarget(next.code);
                    model.setConfirming(true);
                }}
            >
                {label}
            </Button>
            <span>
                Pasará a <strong>{next.label}</strong>
            </span>
        </div>
    );
}

/** Confirmation is explicit and failed mutations keep the editor and its operation key. */
export function FormalizationStageEditor(props: Props) {
    const model = useStageEdit(props);
    return <StageEditorView {...props} model={model} />;
}

function StageEditorView({ item, onRefresh, model }: Props & { readonly model: ReturnType<typeof useStageEdit> }) {
    const { target, setTarget, reason, setReason, confirming, setConfirming, busy, error, refreshRequired, backwards, restriction, disabled, canSave, changed } = model;
    return (
        <section className="formalization-stage-editor" aria-label="Cambiar etapa">
            <header className="formalization-stage-editor__head">
                <h3>Etapa de Formalización</h3>
                <span>Actual: {item.state.label}</span>
            </header>
            <AdvanceAction item={item} model={model} />
            <SignatureRequirement item={item} />
            <label>
                Corregir o cambiar a otra etapa
                <select
                    aria-label="Etapa de Formalización"
                    value={target}
                    disabled={disabled || confirming}
                    onChange={(event) => {
                        changed();
                        setTarget(event.target.value);
                    }}
                >
                    {!ORDER_STAGES.some((stage) => stage.code === target) && <option value={target}>{item.state.label}</option>}
                    {ORDER_STAGES.map((stage) => (
                        <option key={stage.code} value={stage.code} disabled={stageTargetRestriction(item, stage.code) !== null}>
                            {stage.label}
                        </option>
                    ))}
                </select>
            </label>
            {backwards && (
                <label>
                    Motivo del retroceso
                    <textarea
                        aria-label="Motivo del retroceso"
                        required
                        maxLength={500}
                        value={reason}
                        disabled={disabled || confirming}
                        onChange={(event) => {
                            changed();
                            setReason(event.target.value);
                        }}
                    />
                </label>
            )}
            {restriction && <p>{restriction}</p>}
            {error && <p role="alert">{error}</p>}
            {refreshRequired && <Button onClick={onRefresh}>Actualizar orden</Button>}
            <Button
                aria-label="Guardar"
                disabled={!canSave}
                loading={busy}
                onClick={() => {
                    setConfirming(true);
                }}
            >
                Guardar
            </Button>
            <StageConfirmation item={item} model={model} />
        </section>
    );
}
function StageConfirmation({ item, model }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit> }) {
    const { confirming, eligible, busy, canSave, setConfirming, setTarget, pending, save, selected, backwards, reason } = model;
    if (!confirming) return null;
    return (
        <Modal
            title="Confirmar cambio de etapa"
            open={eligible}
            okText="Confirmar cambio"
            cancelText="Cancelar"
            confirmLoading={busy}
            okButtonProps={{ disabled: !canSave, "aria-label": "Confirmar cambio" }}
            cancelButtonProps={{ disabled: busy }}
            closable={!busy}
            mask={{ closable: !busy }}
            onCancel={() => {
                if (pending.current) return;
                setConfirming(false);
                setTarget(item.state.code);
            }}
            onOk={() => {
                void save();
            }}
        >
            <p>
                ¿Guardar la etapa {selected?.label} para la orden {item.number}?
            </p>
            {backwards && <p>Motivo: {reason.trim()}</p>}
        </Modal>
    );
}

const SIGNATURE_REQUIRED = "Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores.";
const SEND_REQUIRED = "Primero registra el envío del contrato y completa la etapa Pendiente de firma.";
/** Unknown/missing signature never enables a later destination; the API repeats this under the order lock. */
function stageTargetRestriction(item: FollowUpItem, target: string): string | null {
    if (ORDER_STAGES.findIndex((stage) => stage.code === target) < 2) return null;
    if (item.contractSigned !== true) return SIGNATURE_REQUIRED;
    return ORDER_STAGES.findIndex((stage) => stage.code === item.state.code) < 1 ? SEND_REQUIRED : null;
}
function SignatureRequirement({ item }: { readonly item: FollowUpItem }) {
    return item.contractSigned === true ? null : <p>{SIGNATURE_REQUIRED}</p>;
}
function stageFailure(failure: unknown): { stale: boolean; message: string } {
    if (!(failure instanceof ApiClientError) || failure.status !== 409) return { stale: false, message: "No se pudo guardar la etapa. Puedes reintentar el mismo cambio." };
    const body = failure.responseBody;
    const code = body && typeof body === "object" ? (Reflect.get(body, "code") as unknown) : null;
    if (code === "CONTRACT_SIGNATURE_REQUIRED") return { stale: false, message: SIGNATURE_REQUIRED };
    if (code === "CONTRACT_SEND_REQUIRED") return { stale: false, message: SEND_REQUIRED };
    return { stale: true, message: "La orden cambió. Actualiza la orden antes de guardar." };
}
