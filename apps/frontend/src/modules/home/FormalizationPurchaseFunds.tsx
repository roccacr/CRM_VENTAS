import "./FormalizationPurchaseFunds.css";

import Button from "antd/es/button";
import Card from "antd/es/card";
import Tag from "antd/es/tag";
import { useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { type FundsCommand, type FundsSnapshot, getPurchaseFunds, type PurchaseFundsOrigin, savePurchaseFunds } from "../../services/formalization/purchase-funds-service";

interface Props {
    readonly item: FollowUpItem;
    readonly allowed: boolean;
    readonly onSaved: () => void | Promise<void>;
    readonly onRefresh: () => void;
}
const fundsLabel = (value: PurchaseFundsOrigin | null | undefined) => (value === "own_funds" ? "Fondos propios" : value === "bank_financing" ? "Financiamiento bancario" : "Sin definir");

/** Parent keys by order/version so asynchronous responses cannot change another order's form. */
function useFundsEdit({ item, allowed, onSaved }: Props) {
    const [snapshot, setSnapshot] = useState<FundsSnapshot | null>(null);
    const [origin, setOrigin] = useState<PurchaseFundsOrigin | "">("");
    const [confirmed, setConfirmed] = useState<PurchaseFundsOrigin | undefined>(undefined);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uncertain, setUncertain] = useState(false);
    const [stale, setStale] = useState(false);
    const pending = useRef(false);
    const operation = useRef<FundsCommand | null>(null);
    const load = async () => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
            const data = await getPurchaseFunds(item.source, item.id);
            setSnapshot(data);
            setOrigin(data.purchaseFundsOrigin ?? "");
        } catch {
            setError("No se pudieron cargar los fondos. Vuelve a intentarlo.");
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    const save = async () => {
        if (!allowed || !snapshot || !origin) return;
        if ([pending.current, stale, confirmed !== undefined].some(Boolean)) return;
        pending.current = true;
        setBusy(true);
        setError(null);
        operation.current ??= { source: item.source, id: item.id, operationId: crypto.randomUUID(), expectedSequence: snapshot.sequence, expectedAuditSequence: snapshot.auditSequence, expectedPurchaseFundsOrigin: snapshot.purchaseFundsOrigin, purchaseFundsOrigin: origin };
        try {
            await savePurchaseFunds(operation.current);
            setConfirmed(operation.current.purchaseFundsOrigin);
            setSnapshot(null);
            setUncertain(false);
            await Promise.resolve()
                .then(onSaved)
                .catch(() => {
                    setError("Fondos guardados. Actualiza la orden para ver el dato actualizado.");
                });
        } catch (failure) {
            const outcome = fundsFailure(failure);
            setStale(outcome.stale);
            setUncertain(outcome.uncertain);
            setError(outcome.message);
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    const change = (value: PurchaseFundsOrigin) => {
        setOrigin(value);
        operation.current = null;
        setError(null);
    };
    const cancel = () => {
        setSnapshot(null);
        operation.current = null;
        setError(null);
    };
    return { snapshot, origin, confirmed, busy, error, uncertain, stale, load, save, change, cancel };
}

function fundsFailure(failure: unknown) {
    if (!(failure instanceof ApiClientError)) return { stale: false, uncertain: true, message: "No se confirmó el guardado. Reintenta con la misma selección o actualiza la orden." };
    if (failure.status >= 500) return { stale: false, uncertain: true, message: "No se confirmó el guardado. Reintenta con la misma selección o actualiza la orden." };
    return { stale: [401, 403, 404, 409].includes(failure.status), uncertain: false, message: failure.status === 409 ? "La orden cambió. Actualízala antes de guardar." : "No se pudieron guardar los fondos. Revisa tu acceso y actualiza la orden." };
}

/** Compact classification card shared by the drawer and full order. */
export function FormalizationPurchaseFunds(props: Props) {
    const edit = useFundsEdit(props);
    const current = edit.confirmed ?? (edit.snapshot ? edit.snapshot.purchaseFundsOrigin : props.item.purchaseFundsOrigin);
    return (
        <Card size="small" title="Fondos de compra">
            <div className="formalization-purchase-funds">
                <div>
                    Origen: <Tag color={current ? "green" : "red"}>{fundsLabel(current)}</Tag>
                </div>
                {props.allowed && <FundsEditor edit={edit} />}
                {edit.confirmed !== undefined && <span role="status">Fondos guardados.</span>}
                {edit.error && <div role="alert">{edit.error}</div>}
                {[edit.stale, edit.uncertain, edit.confirmed !== undefined].some(Boolean) && (
                    <Button size="small" disabled={edit.busy} onClick={props.onRefresh}>
                        Actualizar orden
                    </Button>
                )}
            </div>
        </Card>
    );
}

function FundsEditor({ edit }: { readonly edit: ReturnType<typeof useFundsEdit> }) {
    if (edit.confirmed !== undefined) return null;
    if (!edit.snapshot)
        return (
            <Button
                size="small"
                loading={edit.busy}
                onClick={() => {
                    void edit.load();
                }}
            >
                Editar fondos de compra
            </Button>
        );
    return (
        <>
            <label>
                Origen de los fondos
                <select
                    value={edit.origin}
                    disabled={[edit.busy, edit.uncertain, edit.stale].some(Boolean)}
                    onChange={(event) => {
                        edit.change(event.target.value as PurchaseFundsOrigin);
                    }}
                >
                    <option value="" disabled>
                        Selecciona una opción
                    </option>
                    <option value="own_funds">Fondos propios</option>
                    <option value="bank_financing">Financiamiento bancario</option>
                </select>
            </label>
            <div className="formalization-purchase-funds__actions">
                <Button
                    size="small"
                    type="primary"
                    loading={edit.busy}
                    disabled={[!edit.origin, edit.origin === edit.snapshot.purchaseFundsOrigin, edit.stale].some(Boolean)}
                    onClick={() => {
                        void edit.save();
                    }}
                >
                    {edit.uncertain ? "Reintentar guardado" : "Guardar fondos"}
                </Button>
                {!edit.uncertain && (
                    <Button
                        size="small"
                        disabled={edit.busy}
                        onClick={() => {
                            edit.cancel();
                        }}
                    >
                        Cancelar
                    </Button>
                )}
            </div>
        </>
    );
}
