import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import notification from "antd/es/notification";
import { useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { approveFormalizationOrder } from "../../services/formalization/order-approval-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";

interface Props {
    readonly item: FollowUpItem;
    readonly onSaved: () => void | Promise<void>;
    readonly onRefresh: () => void;
    readonly onApproved?: (() => void) | undefined;
}
/** The keyed parent isolates each order/version; uncertain retries keep the same operation UUID. */
export function FormalizationApprovalAction({ item, onSaved, onRefresh, onApproved }: Props) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pending = useRef(false);
    const operation = useRef<string | null>(null);
    const versionMissing = !validVersion(item.stateVersion);
    const disabled = [busy, blocked, versionMissing].some(Boolean);
    const approve = async () => {
        if ([disabled, pending.current].some(Boolean)) return;
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
            operation.current ??= crypto.randomUUID();
            const result = await approveFormalizationOrder({ source: item.source, id: item.id, expectedSequence: Number(item.stateVersion), operationId: operation.current });
            // Lock a completed command even if the targeted refresh fails or has not remounted us yet.
            const successMessage = result.alreadyApproved ? "NetSuite ya tenía marcada la aprobación de Formalización. El CRM quedó sincronizado." : "Aprobación de Formalización guardada en NetSuite y en el CRM.";
            notification.success({ title: "Aprobación completada", description: successMessage, placement: "bottomLeft", duration: 6 });
            setBlocked(true);
            setConfirming(false);
            onApproved?.();
            await Promise.resolve()
                .then(onSaved)
                .catch(() => {
                    setError("Orden aprobada. No se pudo actualizar la vista; actualiza la orden.");
                });
        } catch (failure) {
            const conflict = failure instanceof ApiClientError && [404, 409].includes(failure.status);
            const forbidden = failure instanceof ApiClientError && [401, 403].includes(failure.status);
            setBlocked([conflict, forbidden].some(Boolean));
            setError(approvalError(failure));
        } finally {
            pending.current = false;
            setBusy(false);
            setConfirming(false);
        }
    };
    return (
        <section className="formalization-stage-editor" aria-label="Aprobación de Formalización">
            <header className="formalization-stage-editor__head">
                <h3>Acciones de la etapa</h3>
                <span>Actual: {item.state.label}</span>
            </header>
            <Button
                className="formalization-advance-btn"
                disabled={[disabled, confirming].some(Boolean)}
                loading={busy}
                onClick={() => {
                    setConfirming(true);
                }}
            >
                Aprobar Formalización
            </Button>
            {error && <Alert type="error" showIcon title={error} role="alert" />}
            {versionMissing && <p>Actualiza la orden para cargar su estado actual.</p>}
            {[blocked, versionMissing].some(Boolean) && <Button onClick={onRefresh}>Actualizar orden</Button>}
            <Modal
                className="formalization-exception-modal"
                title="Confirmar aprobación de Formalización"
                centered
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                open={confirming}
                okText="Confirmar aprobación"
                cancelText="Cancelar"
                confirmLoading={busy}
                okButtonProps={{ disabled }}
                cancelButtonProps={{ disabled: busy }}
                closable={!busy}
                keyboard={!busy}
                mask={{ closable: !busy }}
                onCancel={() => {
                    if (!pending.current) setConfirming(false);
                }}
                onOk={() => {
                    void approve();
                }}
            >
                <p>¿Aprobar Formalización para la orden {item.number}?</p>
                <p>Pasará a Por enviar.</p>
            </Modal>
        </section>
    );
}
function approvalError(failure: unknown): string {
    if (!(failure instanceof ApiClientError)) return "No se pudo confirmar la aprobación. Puedes reintentar la misma operación.";
    const code = approvalErrorCode(failure.responseBody);
    if (failure.status === 503 && code === "FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED") return "NetSuite confirmó la aprobación, pero falta sincronizar el CRM. Reintenta la misma operación.";
    if ([404, 409].includes(failure.status)) return APPROVAL_REJECTIONS.get(code) ?? "La orden cambió o ya no está disponible. Actualiza la orden antes de aprobar.";
    if ([401, 403].includes(failure.status)) return "No tienes permiso vigente para aprobar esta orden. Actualiza la orden para verificar tu acceso.";
    return "No se pudo confirmar la aprobación. Puedes reintentar la misma operación.";
}

function validVersion(value: unknown): boolean {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

// Only fixed messages are shown; a provider or server message cannot inject arbitrary details.
const APPROVAL_REJECTIONS: ReadonlyMap<string, string> = new Map([
    ["CRM_SALES_ORDER_NOT_FOUND", "La orden de venta ya no existe o no está disponible en el CRM."],
    ["CRM_SALES_ORDER_UNAVAILABLE", "No se puede aprobar: la orden está inactiva o marcada como venta caída en el CRM."],
    ["CRM_APPROVAL_PREREQUISITES_REQUIRED", "En el CRM faltan las aprobaciones de Jefe de Ventas y/o Desarrolladora."],
    ["NETSUITE_SALES_ORDER_NOT_FOUND", "La orden de venta no existe en NetSuite en el entorno configurado. No se aprobó ni se modificó el CRM."],
    ["APPROVAL_PREREQUISITES_REQUIRED", "NetSuite rechazó la aprobación: faltan las aprobaciones de Jefe de Ventas y/o Desarrolladora. Revisa la orden en el entorno configurado."],
    ["SALES_ORDER_CANCELLED", "NetSuite rechazó la aprobación porque la orden está marcada como venta caída."],
]);
function approvalErrorCode(body: unknown): string {
    const code: unknown = body !== null && typeof body === "object" ? Reflect.get(body, "code") : undefined;
    return typeof code === "string" ? code : "";
}
