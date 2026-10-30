import "./FormalizationStageEditor.css";

import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ORDER_STAGES, type OrderStage, updateOrderStage } from "../../services/formalization/order-stage-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import { FormalizationApprovalAction } from "./FormalizationApprovalAction";

interface Props {
    readonly item: FollowUpItem;
    readonly allowed: boolean;
    readonly permissions?: readonly { code: string; effect: string }[] | undefined;
    readonly onSaved: () => void | Promise<void>;
    readonly onRefresh: () => void;
    readonly onApproved?: () => void;
}
/** The parent keys this editor by order/version; retry keys survive network errors within that edit. */
function useStageEdit({ item, allowed, permissions = [], onSaved }: Props) {
    const [target, setTarget] = useState(item.state.code);
    const [reason, setReason] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stale, setStale] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const operation = useRef<string | null>(null);
    const pending = useRef(false);
    const currentIndex = ORDER_STAGES.findIndex((stage) => stage.code === item.state.code);
    const selected = ORDER_STAGES.find((stage) => stage.code === target);
    const canSkip = effectiveStagePermission(permissions, "formalizacion.orders.stage.skip");
    const destinationAllowed = (code: string) => effectiveStagePermission(permissions, `formalizacion.orders.stage.${code}`);
    const exceptional = ORDER_STAGES.findIndex((stage) => stage.code === target) !== currentIndex + 1;
    const restriction = stageEditingRestriction(item, allowed);
    const eligible = restriction === null;
    const refreshRequired = [uncertain, stale, restriction?.startsWith("Actualiza") === true].some(Boolean);
    const disabled = [!eligible, busy, stale].some(Boolean);
    const canSave = stageSaveAllowed({ disabled: disabled || !destinationAllowed(target) || (exceptional && !canSkip) || stageTargetRestriction(item, target, canSkip) !== null, selected, different: target !== item.state.code, requiresReason: exceptional, reason });
    const changed = () => {
        if (uncertain) return;
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
            await updateOrderStage({ source: item.source, id: item.id, expectedSequence: item.stateVersion ?? 0, operationId: operation.current, targetState: target as OrderStage, ...stageReason(exceptional, reason) });
            setStale(true);
            await Promise.resolve()
                .then(onSaved)
                .catch(() => {
                    setError("Cambio guardado. Actualiza la orden para verificar su estado.");
                });
        } catch (failure) {
            setUncertain(stageOutcomeUncertain(failure));
            const result = stageFailure(failure);
            setStale(result.stale);
            setError(result.message);
        } finally {
            pending.current = false;
            setBusy(false);
            setConfirming(false);
        }
    };
    return { uncertain, canSkip, destinationAllowed, exceptional, target, setTarget, reason, setReason, confirming, setConfirming, busy, error, stale, selected, eligible, restriction, refreshRequired, disabled, canSave, changed, save, pending };
}

function stageReason(requiresReason: boolean, reason: string): { reason?: string } {
    return requiresReason ? { reason: reason.trim() } : {};
}
/** Version zero is valid for an order with no recorded transition yet. */
function stageEditingRestriction(item: FollowUpItem, allowed: boolean): string | null {
    if (!allowed) return "No tienes permiso para cambiar la etapa.";
    if (item.approvalsComplete === undefined) return "Actualiza la orden para verificar sus aprobaciones.";
    if (!item.approvalsComplete) return "Faltan aprobaciones para cambiar la etapa.";
    if (!Number.isSafeInteger(item.stateVersion) || (item.stateVersion ?? -1) < 0) return "Actualiza la orden para cargar su estado actual.";
    return null;
}
function stageSaveAllowed({ disabled, selected, different, requiresReason, reason }: { disabled: boolean; selected: unknown; different: boolean; requiresReason: boolean; reason: string }): boolean {
    if (disabled || !selected || !different) return false;
    return !requiresReason || reason.trim().length > 0;
}

/** Commands register stage movement; they do not record signatures or payments. */
const ADVANCE_LABELS: Partial<Record<OrderStage, string>> = {
    contract_pending_send: "Marcar como enviado",
    contract_pending_signature: "Registrar paso a Gestión bancaria",
    bank_management: "Marcar gestión bancaria lista",
    pending_balance: "Registrar paso a Pendiente de traspaso",
    pending_transfer: "Registrar etapa Traspaso firmado",
    transfer_signed: "Cerrar formalización",
};

/** Moves to the following stage; the confirmation dialog still asks before anything is saved. */
function AdvanceAction({ item, model }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit> }) {
    const index = ORDER_STAGES.findIndex((stage) => stage.code === item.state.code);
    const next = ORDER_STAGES[index + 1];
    const label = ADVANCE_LABELS[item.state.code as OrderStage];
    if (index < 0 || !next || !label || !model.destinationAllowed(next.code)) return null;
    return (
        <div className="formalization-stage-editor__advance">
            <Button
                className="formalization-advance-btn"
                icon={<ArrowRightOutlined aria-hidden="true" />}
                disabled={[model.disabled, model.confirming, [model.uncertain, model.target !== next.code].every(Boolean), !model.destinationAllowed(next.code), stageTargetRestriction(item, next.code) !== null].some(Boolean)}
                onClick={() => {
                    if (model.target !== next.code) model.changed();
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

function StageEditorView({ item, permissions = [], onRefresh, onSaved, onApproved, model }: Props & { readonly model: ReturnType<typeof useStageEdit> }) {
    const [exceptionOpen, setExceptionOpen] = useState(false);
    if (item.state.code === "pending_approval") {
        if (!effectiveStagePermission(permissions, "formalizacion.orders.approve")) return null;
        return <FormalizationApprovalAction key={`${item.source}:${item.id}:${String(item.stateVersion)}`} item={item} onSaved={onSaved} onRefresh={onRefresh} onApproved={onApproved} />;
    }
    return (
        <section className="formalization-stage-editor" aria-label="Cambiar etapa">
            <header className="formalization-stage-editor__head">
                <h3>Acciones de la etapa</h3>
                <span>Actual: {item.state.label}</span>
            </header>
            <div className="formalization-stage-editor__actions">
                <AdvanceAction item={item} model={model} />
                {model.canSkip && (
                    <Button
                        className="formalization-stage-editor__move"
                        disabled={model.disabled || model.confirming}
                        onClick={() => {
                            setExceptionOpen(true);
                        }}
                    >
                        Mover a otro estado
                    </Button>
                )}
            </div>
            <SignatureRequirement item={item} />
            {!exceptionOpen && <StageFeedback model={model} onRefresh={onRefresh} />}
            <Modal
                className="formalization-exception-modal"
                title="Mover a otro estado"
                width={520}
                centered
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                footer={null}
                destroyOnHidden
                open={exceptionOpen && model.canSkip}
                closable={!model.busy}
                mask={{ closable: !model.busy }}
                keyboard={!model.busy}
                onCancel={() => {
                    if (!model.busy) setExceptionOpen(false);
                }}
            >
                <p className="formalization-exception-modal__context">
                    Orden {item.number} · Actual: {item.state.label}
                </p>
                <StageFeedback model={model} onRefresh={onRefresh} />
                <ExceptionalStageEditor item={item} model={model} />
            </Modal>
            <StageConfirmation item={item} model={model} />
        </section>
    );
}
function StageFeedback({ model, onRefresh }: { readonly model: ReturnType<typeof useStageEdit>; readonly onRefresh: () => void }) {
    return (
        <>
            {model.restriction && <p>{model.restriction}</p>}
            {model.error && <p role="alert">{model.error}</p>}
            {model.refreshRequired && <Button onClick={onRefresh}>Actualizar orden</Button>}
        </>
    );
}

function ExceptionalStageEditor({ item, model }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit> }) {
    const { target, setTarget, reason, setReason, confirming, setConfirming, busy, disabled, canSave, changed } = model;
    if (!model.canSkip) return null;
    return (
        <div className="formalization-stage-editor__exception">
            <label>
                Cambio excepcional
                <select
                    aria-label="Etapa de Formalización"
                    value={target}
                    disabled={disabled || confirming || model.uncertain}
                    onChange={(event) => {
                        changed();
                        setTarget(event.target.value);
                    }}
                >
                    {!ORDER_STAGES.some((stage) => stage.code === target) && <option value={target}>{item.state.label}</option>}
                    {ORDER_STAGES.map((stage) => (
                        <option key={stage.code} value={stage.code} disabled={!model.destinationAllowed(stage.code) || stageTargetRestriction(item, stage.code, true) !== null}>
                            {stage.label}
                        </option>
                    ))}
                </select>
            </label>
            {model.exceptional && (
                <label>
                    Motivo del cambio excepcional
                    <textarea
                        aria-label="Motivo del cambio excepcional"
                        required
                        maxLength={500}
                        value={reason}
                        disabled={disabled || confirming || model.uncertain}
                        onChange={(event) => {
                            changed();
                            setReason(event.target.value);
                        }}
                    />
                </label>
            )}

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
        </div>
    );
}

function StageConfirmation({ item, model }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit> }) {
    const { confirming, eligible, busy, canSave, setConfirming, setTarget, pending, save, selected, exceptional, reason } = model;
    if (!confirming) return null;
    return (
        <Modal
            title="Confirmar cambio de etapa"
            centered
            zIndex={ADMINISTRATION_MODAL_Z_INDEX}
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
                if (!model.uncertain) setTarget(item.state.code);
            }}
            onOk={() => {
                void save();
            }}
        >
            <p>
                ¿Guardar la etapa {selected?.label} para la orden {item.number}?
            </p>
            {exceptional && <p>Motivo: {reason.trim()}</p>}
        </Modal>
    );
}

const SIGNATURE_REQUIRED = "Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores.";
const SEND_REQUIRED = "Primero registra el envío del contrato y completa la etapa Pendiente de firma.";
/** Unknown/missing signature never enables a later destination; the API repeats this under the order lock. */
function stageTargetRestriction(item: FollowUpItem, target: string, skip = false): string | null {
    if (ORDER_STAGES.findIndex((stage) => stage.code === target) < 2) return null;
    if (item.contractSigned !== true) return SIGNATURE_REQUIRED;
    return !skip && ORDER_STAGES.findIndex((stage) => stage.code === item.state.code) < 1 ? SEND_REQUIRED : null;
}
function SignatureRequirement({ item }: { readonly item: FollowUpItem }) {
    return item.contractSigned === true ? null : <p>{SIGNATURE_REQUIRED}</p>;
}
function stageOutcomeUncertain(failure: unknown): boolean {
    return !(failure instanceof ApiClientError) || failure.status >= 500;
}
function stageFailure(failure: unknown): { stale: boolean; message: string } {
    if (stageAuthorizationRejected(failure)) return { stale: true, message: "Tu acceso cambió. Actualiza la orden para verificar tus permisos antes de guardar." };
    if (!(failure instanceof ApiClientError) || failure.status !== 409) return { stale: false, message: "No se pudo guardar la etapa. Puedes reintentar el mismo cambio." };
    const body = failure.responseBody;
    const code = body && typeof body === "object" ? (Reflect.get(body, "code") as unknown) : null;
    if (code === "CONTRACT_SIGNATURE_REQUIRED") return { stale: false, message: SIGNATURE_REQUIRED };
    if (code === "CONTRACT_SEND_REQUIRED") return { stale: false, message: SEND_REQUIRED };
    return { stale: true, message: "La orden cambió. Actualiza la orden antes de guardar." };
}

function effectiveStagePermission(permissions: readonly { code: string; effect: string }[], code: string): boolean {
    const matches = permissions.filter((entry) => entry.code === code);
    return matches.some((entry) => entry.effect === "allow") && !matches.some((entry) => entry.effect === "deny");
}

function stageAuthorizationRejected(failure: unknown): boolean {
    return failure instanceof ApiClientError && [401, 403].includes(failure.status);
}
