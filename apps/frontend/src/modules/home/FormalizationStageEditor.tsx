import "./FormalizationStageEditor.css";

import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import { isFiniquitoOrder } from "../../services/formalization/finiquito-service";
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
/** El padre identifica este editor por orden y versión. La clave de reintento sobrevive a un error de red dentro de esa edición. */
function useStageEdit({ item, allowed, permissions = [], onSaved }: Props) {
    const [target, setTarget] = useState(item.state.code);
    const [purchaseFundsOrigin, setPurchaseFundsOrigin] = useState<"own_funds" | "bank_financing" | "">(item.purchaseFundsOrigin ?? "");
    const nextCode = nextOrderStage(item, purchaseFundsOrigin);
    const [reason, setReason] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stale, setStale] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const operation = useRef<string | null>(null);
    const pending = useRef(false);
    const selected = ORDER_STAGES.find((stage) => stage.code === target);
    const canSkip = effectiveStagePermission(permissions, "formalizacion.orders.stage.skip");
    const destinationAllowed = (code: string) => effectiveStagePermission(permissions, `formalizacion.orders.stage.${code}`);
    const exceptional = target !== nextCode;
    const restriction = stageEditingRestriction(item, allowed);
    const eligible = restriction === null;
    const refreshRequired = [uncertain, stale, restriction?.startsWith("Actualiza") === true].some(Boolean);
    const disabled = [!eligible, busy, stale].some(Boolean);
    const canSave = stageSaveAllowed({ disabled: [disabled, [item.state.code === "contract_pending_signature", ORDER_STAGES.findIndex((stage) => stage.code === target) >= 2, !purchaseFundsOrigin].every(Boolean), !destinationAllowed(target), [exceptional, !canSkip].every(Boolean), stageTargetRestriction(item, target, canSkip) !== null].some(Boolean), selected, different: target !== item.state.code, requiresReason: exceptional, reason });
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
            await updateOrderStage({ source: item.source, id: item.id, expectedSequence: item.stateVersion ?? 0, operationId: operation.current, targetState: target as OrderStage, ...stageReason(exceptional, reason), ...stageFunds(item.state.code, target, purchaseFundsOrigin) });
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
    return { purchaseFundsOrigin, setPurchaseFundsOrigin, nextCode, uncertain, canSkip, destinationAllowed, exceptional, target, setTarget, reason, setReason, confirming, setConfirming, busy, error, stale, selected, eligible, restriction, refreshRequired, disabled, canSave, changed, save, pending };
}

/** El contrato se ramifica solo después de una elección explícita de fondos. La banca ya iniciada avanza por en curso. */
function nextOrderStage(item: FollowUpItem, origin: string): string | null {
    const current = item.state.code;
    const currentIndex = ORDER_STAGES.findIndex((stage) => stage.code === current);
    if (currentIndex >= ORDER_STAGES.findIndex((stage) => stage.code === "pending_balance")) {
        const destination = ORDER_STAGES.find((stage, index) => index > currentIndex && installmentsTargetRestriction(item, stage.code) === null);
        if (destination) return destination.code;
    }
    if (current === "contract_pending_signature") {
        if (origin === "own_funds") return "pending_balance";
        if (origin === "bank_financing") return "bank_management";
        return null;
    }
    return ORDER_STAGES[ORDER_STAGES.findIndex((stage) => stage.code === current) + 1]?.code ?? null;
}
function stageFunds(current: string, target: string, origin: "own_funds" | "bank_financing" | "") {
    return current === "contract_pending_signature" && ORDER_STAGES.findIndex((stage) => stage.code === target) >= 2 && origin ? { purchaseFundsOrigin: origin } : {};
}
function stageReason(requiresReason: boolean, reason: string): { reason?: string } {
    return requiresReason ? { reason: reason.trim() } : {};
}
/** La versión cero es válida en una orden que todavía no tiene una transición registrada. */
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

/** Los comandos registran el movimiento de etapa. No registran firmas ni pagos. */
const ADVANCE_LABELS: Partial<Record<OrderStage, string>> = {
    contract_pending_send: "Marcar como enviado",
    bank_management: "Iniciar gestión bancaria",
    bank_management_in_progress: "Marcar gestión bancaria lista",
    pending_balance: "Registrar paso a Pendiente de traspaso",
    pending_transfer: "Registrar etapa Traspaso firmado",
    transfer_signed: "Cerrar formalización",
};

/** Las etiquetas siguen el destino elegible real, incluido un cierre directo. */
function advanceLabel(item: FollowUpItem, next: { readonly code: string; readonly label: string }): string | undefined {
    let label = ADVANCE_LABELS[item.state.code as OrderStage];
    if (["pending_balance", "pending_transfer", "transfer_signed"].includes(item.state.code))
        label = new Map([
            ["pending_transfer", "Registrar paso a Pendiente de traspaso"],
            ["transfer_signed", "Registrar etapa Traspaso firmado"],
            ["closed", "Cerrar formalización"],
        ]).get(next.code);
    if (item.state.code === "contract_pending_signature") label = next.code ? `Registrar paso a ${next.label}` : "Registrar siguiente etapa";
    return label;
}

/** Avanza a la etapa siguiente. El diálogo de confirmación pregunta antes de guardar. */
function AdvanceAction({ item, model }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit> }) {
    const index = ORDER_STAGES.findIndex((stage) => stage.code === item.state.code);
    const next = ORDER_STAGES.find((stage) => stage.code === model.nextCode) ?? { code: "", label: "Selecciona el origen de fondos" };
    const label = advanceLabel(item, next);
    if (index < 0 || !label || (next.code && !model.destinationAllowed(next.code))) return null;
    return (
        <div className="formalization-stage-editor__advance">
            <Button
                aria-label={label}
                className="formalization-advance-btn"
                icon={<ArrowRightOutlined aria-hidden="true" />}
                disabled={[!next.code, model.disabled, model.confirming, [model.uncertain, model.target !== next.code].every(Boolean), !model.destinationAllowed(next.code), stageTargetRestriction(item, next.code) !== null].some(Boolean)}
                onClick={() => {
                    if (!next.code) return;
                    if (model.target !== next.code) model.changed();
                    model.setTarget(next.code);
                    model.setConfirming(true);
                }}
            >
                Paso siguiente
            </Button>
            <AdvanceDestination item={item} next={next} />
        </div>
    );
}

/** Explica el destino bloqueado junto al botón de siguiente paso deshabilitado. */
function AdvanceDestination({ item, next }: { readonly item: FollowUpItem; readonly next: { code: string; label: string } }) {
    const restriction = stageTargetRestriction(item, next.code);
    const guidance = restriction ?? manualSignatureWarning(item, next.code);
    return (
        <span>
            {next.code ? (
                <>
                    {restriction ? "Destino: " : "Pasará a "}
                    <strong>{next.label}</strong>
                    {guidance && (
                        <>
                            <br />
                            {guidance}
                        </>
                    )}
                </>
            ) : (
                next.label
            )}
        </span>
    );
}

/** Una reversa usa el comando excepcional existente, el permiso del destino y un motivo obligatorio. */
function PreviousAction({ item, model, onChoose }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit>; readonly onChoose: (code: string) => void }) {
    if (!model.canSkip) return null;
    let code = ORDER_STAGES[ORDER_STAGES.findIndex((stage) => stage.code === item.state.code) - 1]?.code;
    if (item.state.code === "pending_balance" && item.purchaseFundsOrigin === "own_funds") code = "contract_pending_signature";
    const previous = ORDER_STAGES.find((stage) => stage.code === code);
    if (!previous) return null;
    const restriction = model.destinationAllowed(previous.code) ? stageTargetRestriction(item, previous.code, true) : "No tienes permiso para volver a esta etapa.";
    const disabled = [model.disabled, model.confirming, model.uncertain, restriction !== null].some(Boolean);
    return (
        <div className="formalization-stage-editor__advance">
            <Button
                aria-label={`Paso anterior: ${previous.label}`}
                disabled={disabled}
                onClick={() => {
                    onChoose(previous.code);
                }}
            >
                Paso anterior
            </Button>
            <span>
                {restriction ?? (
                    <>
                        Volverá a <strong>{previous.label}</strong>
                    </>
                )}
            </span>
        </div>
    );
}

/** La confirmación es explícita. Una mutación fallida conserva el editor y su clave de operación. */
export function FormalizationStageEditor(props: Props) {
    const model = useStageEdit(props);
    return isFiniquitoOrder(props.item) ? null : <StageEditorView {...props} model={model} />;
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
            <PurchaseFundsSelector item={item} model={model} />
            <div className="formalization-stage-editor__actions">
                <AdvanceAction item={item} model={model} />
                <PreviousAction
                    item={item}
                    model={model}
                    onChoose={(code) => {
                        model.changed();
                        model.setTarget(code);
                        setExceptionOpen(true);
                    }}
                />
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
function PurchaseFundsSelector({ item, model }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit> }) {
    if (item.state.code !== "contract_pending_signature") return null;
    return (
        <label>
            Origen de fondos de compra
            <select
                aria-label="Origen de fondos de compra"
                required
                value={model.purchaseFundsOrigin}
                disabled={[model.disabled, model.confirming, model.uncertain].some(Boolean)}
                onChange={(event) => {
                    model.changed();
                    model.setPurchaseFundsOrigin(event.target.value as "own_funds" | "bank_financing" | "");
                }}
            >
                <option value="">Selecciona el origen de fondos</option>
                <option value="own_funds">Fondos propios</option>
                <option value="bank_financing">Financiamiento bancario</option>
            </select>
        </label>
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
            <DestinationRequirement item={item} target={target} />
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

function DestinationRequirement({ item, target }: { readonly item: FollowUpItem; readonly target: string }) {
    const restriction = stageTargetRestriction(item, target, true);
    return restriction ? <p>{restriction}</p> : null;
}

function StageConfirmation({ item, model }: { readonly item: FollowUpItem; readonly model: ReturnType<typeof useStageEdit> }) {
    const { confirming, eligible, busy, canSave, setConfirming, setTarget, pending, save, selected, exceptional, reason } = model;
    if (!confirming) return null;
    const warning = manualSignatureWarning(item, selected?.code);
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
            {warning && <p>{warning}</p>}
            {exceptional && <p>Motivo: {reason.trim()}</p>}
        </Modal>
    );
}

function manualSignatureWarning(item: FollowUpItem, target?: string): string | null {
    if (item.state.code !== "pending_transfer" || target !== "transfer_signed" || item.unitTransferred === true) return null;
    return "NetSuite aún no confirma «Unidad traspasada». Si ya se firmó el traspaso, puedes registrarlo manualmente.";
}

const SIGNATURE_REQUIRED = "Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores.";
const INSTALLMENTS_REQUIRED = "Confirma en NetSuite que esté marcado «Cuotas pagadas por completo».";
const PENDING_TRANSFER_REQUIRED = "En NetSuite, marca «Cuotas pagadas por completo» y deja desmarcadas «Unidad traspasada» y «Unidad entregada». La entrega de llaves es opcional en esta etapa.";
const TRANSFER_SIGNED_REQUIRED = "En NetSuite, marca «Cuotas pagadas por completo» y «Unidad traspasada». Deja desmarcadas «Entrega de llaves» y «Unidad entregada».";
const CLOSED_REQUIRED = "Se requiere confirmar Unidad entregada: Sí en NetSuite para cerrar. Cuotas pagadas por completo, Unidad traspasada y Llaves entregadas no condicionan el cierre.";
const BALANCE_RETURN_FORBIDDEN = "No se permite volver a Pendiente de saldo desde traspaso o etapas posteriores.";
const SEND_REQUIRED = "Primero registra el envío del contrato y completa la etapa Pendiente de firma.";
/** Una firma desconocida o ausente no habilita un destino posterior. El API lo repite bajo el bloqueo de la orden. */
function stageTargetRestriction(item: FollowUpItem, target: string, skip = false): string | null {
    const paidRestriction = installmentsTargetRestriction(item, target);
    if (paidRestriction) return paidRestriction;
    if (ORDER_STAGES.findIndex((stage) => stage.code === target) < 2) return null;
    if (item.contractSigned !== true) return SIGNATURE_REQUIRED;
    return !skip && ORDER_STAGES.findIndex((stage) => stage.code === item.state.code) < 1 ? SEND_REQUIRED : null;
}
/** El cierre desde Traspaso firmado ejecuta el flujo externo; otros cierres requieren entrega ya observada. */
function installmentsTargetRestriction(item: FollowUpItem, target: string): string | null {
    const transferIndex = ORDER_STAGES.findIndex((stage) => stage.code === "pending_transfer");
    const currentIndex = ORDER_STAGES.findIndex((stage) => stage.code === item.state.code);
    if ([target === "pending_balance", currentIndex >= transferIndex].every(Boolean)) return BALANCE_RETURN_FORBIDDEN;
    if (target === "closed") return [item.state.code === "transfer_signed", item.unitDelivered === true].some(Boolean) ? null : CLOSED_REQUIRED;
    if (target === "pending_transfer") return [item.installmentsFullyPaid === true, item.unitTransferred === false, item.unitDelivered === false].every(Boolean) ? null : PENDING_TRANSFER_REQUIRED;
    if (target === "transfer_signed") return [item.installmentsFullyPaid === true, [item.unitTransferred === true, item.state.code === "pending_transfer"].some(Boolean), item.keysDelivered === false, item.unitDelivered === false].every(Boolean) ? null : TRANSFER_SIGNED_REQUIRED;
    return null;
}
function SignatureRequirement({ item }: { readonly item: FollowUpItem }) {
    return item.contractSigned === true ? null : <p>{SIGNATURE_REQUIRED}</p>;
}
function stageOutcomeUncertain(failure: unknown): boolean {
    return !(failure instanceof ApiClientError) || failure.status >= 500;
}
/** Los resultados inciertos de un workflow externo nunca invitan a repetir la escritura. */
function unitTransferFailure(failure: unknown): { stale: boolean; message: string } | null {
    if (!(failure instanceof ApiClientError)) return null;
    const body = failure.responseBody;
    if (!body || typeof body !== "object") return null;
    const code: unknown = Reflect.get(body, "code");
    const message = new Map<unknown, string>([
        ["UNIT_TRANSFER_RECONCILIATION_REQUIRED", "La etapa no fue guardada. El flujo de Unidad traspasada en NetSuite requiere conciliación antes de reintentar."],
        ["UNIT_TRANSFER_LOCAL_COMMIT_UNCONFIRMED", "No se confirmó el guardado de la etapa. Actualiza la orden y concilia la ejecución externa antes de reintentar."],
        ["UNIT_TRANSFER_UNAVAILABLE", "La etapa no fue guardada. No se pudo reservar el flujo NetSuite; solicita revisar su configuración."],
        ["UNIT_TRANSFER_REFERENCE_REQUIRED", "La etapa no fue guardada. Falta una referencia NetSuite válida y única para esta orden."],
    ]).get(code);
    return message ? { stale: true, message } : null;
}
function stageFailure(failure: unknown): { stale: boolean; message: string } {
    if (stageAuthorizationRejected(failure)) return { stale: true, message: "Tu acceso cambió. Actualiza la orden para verificar tus permisos antes de guardar." };
    const workflowFailure = unitTransferFailure(failure);
    if (workflowFailure) return workflowFailure;
    if (!(failure instanceof ApiClientError) || failure.status !== 409) return { stale: false, message: "No se pudo guardar la etapa. Puedes reintentar el mismo cambio." };
    const body = failure.responseBody;
    const code = body && typeof body === "object" ? (Reflect.get(body, "code") as unknown) : null;
    const message = new Map<unknown, string>([
        ["PURCHASE_FUNDS_ORIGIN_REQUIRED", "Selecciona el origen de fondos de compra para salir de Contratos."],
        ["CONTRACT_SIGNATURE_REQUIRED", SIGNATURE_REQUIRED],
        ["INSTALLMENTS_FULLY_PAID_REQUIRED", INSTALLMENTS_REQUIRED],
        ["FORMALIZATION_COMPLETION_FLAGS_REQUIRED", "Avance bloqueado: revisa Cuotas pagadas por completo, Unidad traspasada, Llaves entregadas y Unidad entregada en NetSuite para la etapa seleccionada."],
        ["PENDING_BALANCE_RETURN_FORBIDDEN", BALANCE_RETURN_FORBIDDEN],
        ["CONTRACT_SEND_REQUIRED", SEND_REQUIRED],
    ]).get(code);
    if (message) return { stale: false, message };
    return { stale: true, message: "La orden cambió. Actualiza la orden antes de guardar." };
}

function effectiveStagePermission(permissions: readonly { code: string; effect: string }[], code: string): boolean {
    const matches = permissions.filter((entry) => entry.code === code);
    return matches.some((entry) => entry.effect === "allow") && !matches.some((entry) => entry.effect === "deny");
}

function stageAuthorizationRejected(failure: unknown): boolean {
    return failure instanceof ApiClientError && [401, 403].includes(failure.status);
}
