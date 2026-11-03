import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import CloseCircleOutlined from "@ant-design/icons/CloseCircleOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import { useState } from "react";

import { type CalendarEvent, type CalendarStatusCommand, changeCalendarStatus } from "../../services/calendar/calendar-service";

const labels = { complete: "Completar evento", cancel: "Cancelar evento", reactivate: "Reactivar evento" };
const explanations = { complete: "Se marcará como completado en CRM. La cita histórica se conserva en Outlook.", cancel: "Se cancelará en CRM y Outlook. Microsoft enviará la cancelación a los invitados.", reactivate: "Volverá a estar programado. Si estaba cancelado, se creará una nueva invitación en Outlook." };

/** Solo presenta capacidades del servidor; cada comando revalida autoría, permisos y versión. */
export function CalendarEventActions({ event, onChanged }: { readonly event: CalendarEvent | null | undefined; readonly onChanged?: (() => void) | undefined }) {
    const [action, setAction] = useState<CalendarStatusCommand["action"] | null>(null);
    if (!event?.canManageStatus || event.source !== "native") return null;
    return (
        <section className="calendar-event-actions" aria-label="Gestionar estado del evento">
            {event.status === "scheduled" ? (
                <>
                    <Button
                        icon={<CheckCircleOutlined aria-hidden="true" />}
                        onClick={() => {
                            setAction("complete");
                        }}
                    >
                        Completar
                    </Button>
                    <Button
                        danger
                        icon={<CloseCircleOutlined aria-hidden="true" />}
                        onClick={() => {
                            setAction("cancel");
                        }}
                    >
                        Cancelar evento
                    </Button>
                </>
            ) : (
                <Button
                    icon={<ReloadOutlined aria-hidden="true" />}
                    onClick={() => {
                        setAction("reactivate");
                    }}
                >
                    Reactivar evento
                </Button>
            )}
            {action && (
                <StatusDialog
                    key={`${event.id}:${String(event.version)}:${action}`}
                    event={event}
                    action={action}
                    onClose={() => {
                        setAction(null);
                    }}
                    onChanged={onChanged}
                />
            )}
        </section>
    );
}

function StatusDialog({ event, action, onClose, onChanged }: { readonly event: CalendarEvent; readonly action: CalendarStatusCommand["action"]; readonly onClose: () => void; readonly onChanged?: (() => void) | undefined }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState("");
    const [success, setSuccess] = useState(false);
    const [attempt, setAttempt] = useState<CalendarStatusCommand | null>(null);
    const close = () => {
        onClose();
        if (success) onChanged?.();
    };
    const submit = async () => {
        if (busy || !event.originModule) return;
        const command = attempt ?? { moduleCode: event.originModule, action, expectedStatus: event.status, expectedVersion: event.version, operationId: crypto.randomUUID(), ...(event.outlookVersion ? { expectedOutlookVersion: event.outlookVersion } : {}), ...(action === "cancel" ? { reason: reason.trim() } : {}) };
        setAttempt(command);
        setBusy(true);
        setFailure("");
        try {
            const result = await changeCalendarStatus(event.id, command);
            if (!["synced", "crm_only"].includes(result.delivery.status)) {
                setFailure("El estado se guardó en CRM, pero Outlook no confirmó la operación. Reintenta con el mismo identificador.");
                return;
            }
            setSuccess(true);
        } catch {
            setFailure("No se confirmó la operación. Reintenta; se conserva el mismo identificador para evitar duplicados.");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal
            open
            title={labels[action]}
            onCancel={() => {
                if (!busy) close();
            }}
            mask={{ closable: !busy }}
            keyboard={!busy}
            footer={
                success ? (
                    <Button
                        type="primary"
                        onClick={() => {
                            close();
                        }}
                    >
                        Volver al calendario
                    </Button>
                ) : (
                    <>
                        <Button disabled={busy} onClick={onClose}>
                            Volver
                        </Button>
                        <Button
                            type="primary"
                            danger={action === "cancel"}
                            loading={busy}
                            disabled={action === "cancel" && !reason.trim()}
                            onClick={() => {
                                void submit();
                            }}
                        >
                            {attempt ? "Reintentar" : labels[action]}
                        </Button>
                    </>
                )
            }
        >
            <p>
                <strong>{event.title}</strong>
            </p>
            <p>{explanations[action]}</p>
            {[action === "cancel", !success].every(Boolean) && (
                <label>
                    Motivo de cancelación *
                    <Input.TextArea
                        aria-label="Motivo de cancelación"
                        required
                        maxLength={1000}
                        disabled={busy || attempt !== null}
                        value={reason}
                        onChange={(change) => {
                            setReason(change.target.value);
                        }}
                        rows={3}
                    />
                </label>
            )}
            {failure && <Alert type="warning" showIcon title={failure} />}
            {success && <Alert type="success" showIcon title="Estado del evento actualizado" />}
        </Modal>
    );
}
