import FileAddOutlined from "@ant-design/icons/FileAddOutlined";
import Button from "antd/es/button";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import { type ComponentProps, useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderAddendum, markOrderAddendumPending, type OrderAddendum, type PendingAddendumCommand } from "../../services/formalization/order-addendum-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import { type AddendumPermission, canMarkOrderAddendum } from "./order-addendum-permissions";

interface Props {
    readonly item: FollowUpItem;
    readonly permissions: readonly AddendumPermission[];
    readonly onSaved?: (() => void | Promise<void>) | undefined;
}
/** La marcación manual es independiente de agendar un evento y no se deduce del rol Owner. */
export function FormalizationMarkAddendum(props: Props) {
    if (!canMarkOrderAddendum(props.permissions)) return null;
    return <MarkAddendumAction key={`${props.item.source}:${props.item.id}`} {...props} />;
}
function MarkAddendumAction({ item, onSaved }: Props) {
    const [open, setOpen] = useState(false);
    const [attempt, setAttempt] = useState(0);
    return (
        <>
            <Button
                icon={<FileAddOutlined aria-hidden="true" />}
                onClick={() => {
                    setOpen(true);
                }}
            >
                Marcar adéndum pendiente
            </Button>
            {open && (
                <MarkAddendumDialog
                    key={String(attempt)}
                    item={item}
                    onSaved={onSaved}
                    onClose={() => {
                        setOpen(false);
                    }}
                    onReload={() => {
                        setAttempt((value) => value + 1);
                    }}
                />
            )}
        </>
    );
}
function failureMessage(error: unknown) {
    const definite = error instanceof ApiClientError && [400, 401, 403, 404, 409].includes(error.status);
    return { uncertain: !definite, message: definite ? "La orden o tus permisos cambiaron. Actualiza la información antes de marcar el adéndum." : "No se confirmó la marcación. Reintenta la misma operación para verificar el resultado." };
}
type DialogProps = Pick<Props, "item" | "onSaved"> & { readonly onClose: () => void; readonly onReload: () => void };
function useManualAddendum({ item, onSaved, onClose }: DialogProps) {
    const [snapshot, setSnapshot] = useState<OrderAddendum | null>(null);
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [stale, setStale] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const generation = useRef(0);
    const pending = useRef(false);
    const operation = useRef<PendingAddendumCommand | null>(null);
    useEffect(() => {
        const current = ++generation.current;
        void getOrderAddendum({ source: item.source, id: item.id }).then(
            (result) => {
                if (current === generation.current) setSnapshot(result);
            },
            () => {
                if (current === generation.current) setError("No fue posible consultar la orden antes de marcar el adéndum.");
            },
        );
        return () => {
            generation.current += 1;
        };
    }, [item.source, item.id]);
    const ready = [snapshot !== null, snapshot?.canMarkPending === true, snapshot?.status !== "pending", !stale, !confirmed].every(Boolean);
    const save = async () => {
        if ([!ready, pending.current, !snapshot, note.trim().length < 3, note.trim().length > 2000].some(Boolean)) return;
        const state = snapshot as OrderAddendum;
        operation.current ??= { source: state.source, id: state.id, expectedVersion: state.version, operationId: crypto.randomUUID(), note: note.trim() };
        const current = generation.current;
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
            await markOrderAddendumPending(operation.current);
            if (current !== generation.current) return;
            setConfirmed(true);
            setUncertain(false);
            await Promise.resolve()
                .then(onSaved)
                .catch(() => {
                    setError("Adéndum marcado. Actualiza la orden para consultar los contadores.");
                });
            onClose();
        } catch (error) {
            if (current !== generation.current) return;
            const failure = failureMessage(error);
            setError(failure.message);
            setUncertain(failure.uncertain);
            setStale(!failure.uncertain);
        } finally {
            pending.current = false;
            if (current === generation.current) setBusy(false);
        }
    };
    return { snapshot, note, setNote, error, busy, uncertain, stale, confirmed, ready, save };
}
function MarkAddendumDialog(props: DialogProps) {
    const model = useManualAddendum(props);
    const locked = [model.busy, model.uncertain, model.confirmed].some(Boolean);
    const reloadNeeded = [model.stale, [!model.snapshot, Boolean(model.error)].every(Boolean)].some(Boolean);
    const canReload = [reloadNeeded, !model.uncertain].every(Boolean);
    return (
        <AddendumReasonModal
            open
            // La capa global de oscurecimiento también cubre modales con el nivel predeterminado de AntD.
            title={`Marcar adéndum pendiente · ${props.item.number}`}
            onCancel={() => {
                if (!model.busy) props.onClose();
            }}
            closable={!model.busy}
            mask={{ closable: !model.busy }}
            keyboard={!model.busy}
            footer={
                <>
                    <Button disabled={model.busy} onClick={props.onClose}>
                        Cerrar
                    </Button>
                    <Button
                        type="primary"
                        aria-label={model.uncertain ? "Reintentar la misma marcación" : "Marcar pendiente"}
                        disabled={[!model.ready, model.busy, model.note.trim().length < 3, model.note.trim().length > 2000].some(Boolean)}
                        loading={model.busy}
                        onClick={() => {
                            void model.save();
                        }}
                    >
                        {model.uncertain ? "Reintentar la misma marcación" : "Marcar pendiente"}
                    </Button>
                </>
            }
        >
            <p>Marca el adéndum de esta orden como pendiente sin crear un evento en el calendario.</p>
            <ManualReadNotice model={model} />
            <AddendumReasonInput value={model.note} disabled={locked || !model.ready} onChange={model.setNote} />
            {model.error && <p role="alert">{model.error}</p>}
            {canReload && (
                <Button disabled={model.busy} onClick={props.onReload}>
                    Actualizar información del adéndum
                </Button>
            )}
        </AddendumReasonModal>
    );
}

/** El flujo individual y la selección masiva comparten la misma capa de modal y campo de motivo. */
export function AddendumReasonModal(props: ComponentProps<typeof Modal>) {
    return <Modal zIndex={ADMINISTRATION_MODAL_Z_INDEX} {...props} />;
}

/** Mantiene los límites del motivo existentes para ambas formas de marcación. */
export function AddendumReasonInput({ value, disabled, onChange }: { readonly value: string; readonly disabled: boolean; readonly onChange: (value: string) => void }) {
    return (
        <label>
            Motivo
            <Input.TextArea
                required
                minLength={3}
                maxLength={2000}
                rows={4}
                value={value}
                disabled={disabled}
                onChange={(event) => {
                    onChange(event.target.value);
                }}
            />
        </label>
    );
}
function ManualReadNotice({ model }: { readonly model: ReturnType<typeof useManualAddendum> }) {
    if (!model.snapshot) return !model.error && <p role="status">Consultando versión y permisos de la orden…</p>;
    if (model.snapshot.status === "pending") return <p role="status">La orden ya tiene un adéndum pendiente.</p>;
    if (!model.snapshot.canMarkPending) return <p role="status">No tienes permiso para marcar el adéndum de esta orden.</p>;
    return null;
}
