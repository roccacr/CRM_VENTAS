import Button from "antd/es/button";
import Card from "antd/es/card";
import Popover from "antd/es/popover";
import { useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderAddendum, markOrderAddendumSent, type OrderAddendum, type OrderAddendumCommand, updateOrderAddendum } from "../../services/formalization/order-addendum-service";
import { type AddendumPermission, canMarkOrderAddendumSent, canReadOrderAddendum, canUpdateOrderAddendum } from "./order-addendum-permissions";

const labels = { none: "Sin adéndum", pending: "Pendiente", completed: "Completado", cancelled: "Cancelado", sent: "Enviado" };
type OnChanged = (() => void | Promise<void>) | undefined;
function writeFailure(failure: unknown) {
    const stale = failure instanceof ApiClientError && [400, 401, 403, 404, 409].includes(failure.status);
    return { stale, message: stale ? "La orden o tus permisos cambiaron. Actualiza el adéndum antes de continuar." : "No se confirmó el cambio. Reintenta la misma operación para verificar el resultado." };
}

/** Marcador único por orden; sus acciones no completan ni cancelan los eventos del calendario. */
export function FormalizationOrderAddendum({ item, permissions, refreshVersion = 0, onChanged, marker = false }: { readonly item: FollowUpItem; readonly permissions: readonly AddendumPermission[]; readonly refreshVersion?: number; readonly onChanged?: OnChanged; readonly marker?: boolean }) {
    if (!canReadOrderAddendum(permissions)) return null;
    const Content = marker ? OrderAddendumMarker : OrderAddendumContent;
    return <Content key={`${item.source}:${item.id}:${String(refreshVersion)}`} item={item} canUpdate={canUpdateOrderAddendum(permissions)} canMarkSent={canMarkOrderAddendumSent(permissions)} onChanged={onChanged} />;
}

/** Marcador compacto bajo la etapa; sus acciones viven en un popover para no ocupar una sección. */
function OrderAddendumMarker({ item, canUpdate, canMarkSent, onChanged }: { readonly item: FollowUpItem; readonly canUpdate: boolean; readonly canMarkSent: boolean; readonly onChanged: OnChanged }) {
    const model = useOrderAddendum(item, canUpdate, canMarkSent, onChanged);
    const status = model.data?.status ?? "none";
    const label = model.data ? labels[status] : model.error ? "No disponible" : "Consultando…";
    const hasActions = [model.editable, model.sendable, Boolean(model.error), model.stale].some(Boolean);
    const chip = (
        <button type="button" className="addendum-marker" data-status={model.data ? status : "loading"} aria-label="Adéndum de la orden" aria-busy={model.busy} disabled={!hasActions}>
            <span className="addendum-marker__dot" aria-hidden="true" />
            Adéndum: <strong>{label}</strong>
        </button>
    );
    if (!hasActions) return chip;
    return (
        <Popover
            trigger="click"
            placement="bottomLeft"
            content={
                <div className="addendum-marker__panel">
                    {model.data && <AddendumDetails model={model} compact />}
                    <AddendumFailure model={model} />
                </div>
            }
        >
            {chip}
        </Popover>
    );
}

function useOrderAddendum(item: FollowUpItem, canUpdate: boolean, canMarkSent: boolean, onChanged: OnChanged) {
    const [data, setData] = useState<OrderAddendum | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [stale, setStale] = useState(false);
    const pending = useRef(false);
    const generation = useRef(0);
    const operation = useRef<(Omit<OrderAddendumCommand, "status"> & { readonly status: OrderAddendumCommand["status"] | "sent" }) | null>(null);
    useEffect(() => {
        const current = ++generation.current;
        void getOrderAddendum({ source: item.source, id: item.id }).then(
            (result) => {
                if (current === generation.current) setData(result);
            },
            () => {
                if (current === generation.current) setError("No fue posible consultar el adéndum de esta orden.");
            },
        );
        return () => {
            generation.current += 1;
        };
    }, [item.source, item.id, revision]);
    const editable = [canUpdate, data?.canUpdate, ["pending", "sent"].includes(data?.status ?? ""), !stale].every(Boolean);
    const sendable = [canMarkSent, data?.canMarkSent === true, data?.status === "pending", !stale].every(Boolean);
    const save = async (status: OrderAddendumCommand["status"] | "sent") => {
        if ([pending.current, !(status === "sent" ? sendable : editable), !data].some(Boolean)) return;
        const snapshot = data as OrderAddendum;
        operation.current ??= { source: snapshot.source, id: snapshot.id, status, expectedVersion: snapshot.version, operationId: crypto.randomUUID() };
        const current = generation.current;
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
            const { status: target, ...command } = operation.current;
            const saved = await persistAddendum(target, command);
            if (current !== generation.current) return;
            setData(saved);
            setUncertain(false);
            operation.current = null;
            // La escritura ya está confirmada: un fallo de recarga nunca debe ofrecer repetir ese cambio.
            await Promise.resolve()
                .then(() => {
                    if (current === generation.current && onChanged) return onChanged();
                    return undefined;
                })
                .catch(() => {
                    if (current === generation.current) setError("Cambio guardado. Actualiza la orden para consultar el tablero y sus pendientes.");
                });
        } catch (failure) {
            if (current !== generation.current) return;
            const result = writeFailure(failure);
            setStale(result.stale);
            setUncertain(!result.stale);
            setError(result.message);
        } finally {
            pending.current = false;
            if (current === generation.current) setBusy(false);
        }
    };
    const refresh = () => {
        if (pending.current || uncertain) return;
        setData(null);
        setError(null);
        setStale(false);
        operation.current = null;
        setRevision((value) => value + 1);
    };
    return {
        data,
        error,
        busy,
        uncertain,
        editable,
        sendable,
        stale,
        save,
        refresh,
        retry: () => {
            if (operation.current) void save(operation.current.status);
        },
    };
}

function OrderAddendumContent({ item, canUpdate, canMarkSent, onChanged }: { readonly item: FollowUpItem; readonly canUpdate: boolean; readonly canMarkSent: boolean; readonly onChanged: OnChanged }) {
    const model = useOrderAddendum(item, canUpdate, canMarkSent, onChanged);
    return (
        <Card size="small" title="Adéndum" aria-label="Adéndum de la orden" aria-busy={model.busy}>
            <AddendumDetails model={model} />
            <AddendumFailure model={model} />
        </Card>
    );
}
type AddendumModel = ReturnType<typeof useOrderAddendum>;
function AddendumDetails({ model, compact = false }: { readonly model: AddendumModel; readonly compact?: boolean }) {
    if (!model.data) return !model.error && <p>Consultando adéndum…</p>;
    return (
        <>
            {!compact && (
                <p>
                    Condición: <strong>{labels[model.data.status ?? "none"]}</strong>
                </p>
            )}
            <AddendumMetadata data={model.data} />
            {model.sendable && (
                <Button
                    disabled={[model.busy, model.uncertain].some(Boolean)}
                    onClick={() => {
                        void model.save("sent");
                    }}
                >
                    Marcar adéndum como enviado
                </Button>
            )}
            {model.editable && (
                <div className="record-actions">
                    <Button
                        disabled={[model.busy, model.uncertain].some(Boolean)}
                        onClick={() => {
                            void model.save("completed");
                        }}
                    >
                        Marcar adéndum como completado
                    </Button>
                    <Button
                        disabled={[model.busy, model.uncertain].some(Boolean)}
                        onClick={() => {
                            void model.save("cancelled");
                        }}
                    >
                        Cancelar adéndum
                    </Button>
                </div>
            )}
        </>
    );
}
function AddendumMetadata({ data }: { readonly data: OrderAddendum }) {
    return (
        <>
            {data.note && <p>Motivo: {data.note}</p>}
            {data.changedAt && (
                <p>
                    Actualizado: <time dateTime={data.changedAt}>{new Date(data.changedAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}</time>
                </p>
            )}
        </>
    );
}
function AddendumFailure({ model }: { readonly model: AddendumModel }) {
    return (
        <>
            {model.error && <p role="alert">{model.error}</p>}
            {model.uncertain ? (
                <Button disabled={model.busy || !(model.editable || model.sendable)} onClick={model.retry}>
                    Reintentar el mismo cambio
                </Button>
            ) : (
                (model.error || model.stale) && (
                    <Button disabled={model.busy} onClick={model.refresh}>
                        Actualizar adéndum
                    </Button>
                )
            )}
        </>
    );
}

function persistAddendum(status: OrderAddendumCommand["status"] | "sent", command: Omit<OrderAddendumCommand, "status">) {
    return status === "sent" ? markOrderAddendumSent(command) : updateOrderAddendum({ ...command, status });
}
