import "./FormalizationFiniquito.css";

import Button from "antd/es/button";
import Card from "antd/es/card";
import Modal from "antd/es/modal";
import Tag from "antd/es/tag";
import { useEffect, useRef, useState } from "react";

import { ApiClientError, apiRequest } from "../../services/api/api-client";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ORDER_STAGES } from "../../services/formalization/order-stage-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";

type Status = "pending_send" | "sent" | "signed";
interface Snapshot {
    eligible: boolean;
    status: Status | null;
    version: number;
    originStage: string | null;
    canUpdate: boolean;
}
const steps = [
    { code: "pending_send", label: "Finiquito por enviar" },
    { code: "sent", label: "Finiquito enviado" },
    { code: "signed", label: "Finiquito firmado" },
] as const;
const actions = { pending_send: "Gestionar finiquito", sent: "Registrar envío", signed: "Registrar firma" };
function parse(value: unknown): Snapshot {
    if (!value || typeof value !== "object") throw new Error("Respuesta de finiquito inválida");
    const data = value as Snapshot;
    if ([typeof data.eligible !== "boolean", typeof data.canUpdate !== "boolean", !Number.isSafeInteger(data.version), data.version < 0, ![null, "pending_send", "sent", "signed"].includes(data.status), ![data.originStage === null, typeof data.originStage === "string"].some(Boolean)].some(Boolean)) throw new Error("Respuesta de finiquito inválida");
    return data;
}
function writeFailure(failure: unknown) {
    const stale = failure instanceof ApiClientError && [400, 401, 403, 404, 409].includes(failure.status);
    return { stale, message: stale ? "La orden o tus permisos cambiaron. Actualiza el finiquito." : "No se confirmó el cambio. Reintenta la misma operación." };
}
/** Las dos banderas confirmadas abren la rama. El servidor las vuelve a comprobar en cada mutación. */
export function FormalizationFiniquito({ item, allowed }: { readonly item: FollowUpItem; readonly allowed: boolean }) {
    if (item.saleLost !== true || item.contractSigned !== true) return null;
    return <FiniquitoContent key={`${item.source}:${item.id}`} item={item} allowed={allowed} />;
}
function useFiniquito(item: FollowUpItem, allowed: boolean) {
    const identity = { source: item.source, id: item.id.replace(/^legacy:/, "") };
    const [data, setData] = useState<Snapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [stale, setStale] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const pending = useRef(false);
    const operation = useRef<{ source: "native" | "legacy"; id: string; status: Status; expectedVersion: number; operationId: string } | null>(null);
    const generation = useRef(0);
    useEffect(() => {
        const current = ++generation.current;
        void apiRequest<unknown>(`/formalization/orders/finiquito?${new URLSearchParams({ source: item.source, id: item.id.replace(/^legacy:/, "") })}`)
            .then((result) => {
                if (current === generation.current) setData(parse(result));
            })
            .catch(() => {
                if (current === generation.current) setError("No fue posible consultar el finiquito.");
            });
        return () => {
            generation.current += 1;
        };
    }, [item.source, item.id, revision]);
    const next = ({ none: "pending_send", pending_send: "sent", sent: "signed", signed: null } as const)[data?.status ?? "none"];
    // El reintento de una respuesta incierta se queda con su operación original.
    // eslint-disable-next-line complexity
    const save = async () => {
        if (!data || !next) return;
        if ([!allowed, !data.canUpdate, !data.eligible, stale, pending.current].some(Boolean)) return;
        operation.current ??= { ...identity, status: next, expectedVersion: data.version, operationId: crypto.randomUUID() };
        const current = generation.current;
        pending.current = true;
        setBusy(true);
        setConfirming(false);
        setError(null);
        try {
            const result = parse(await apiRequest<unknown>("/formalization/orders/finiquito", { method: "POST", body: operation.current, retryOnUnauthorized: false }));
            if (current !== generation.current) return;
            setData(result);
            operation.current = null;
            setUncertain(false);
        } catch (failure) {
            if (current !== generation.current) return;
            const failureState = writeFailure(failure);
            setStale(failureState.stale);
            setUncertain(!failureState.stale);
            setError(failureState.message);
        } finally {
            pending.current = false;
            if (current === generation.current) setBusy(false);
        }
    };
    const refresh = () => {
        if (pending.current || uncertain) return;
        setData(null);
        setStale(false);
        setError(null);
        operation.current = null;
        setRevision((value) => value + 1);
    };
    return { data, error, busy, confirming, setConfirming, stale, uncertain, next, save, refresh };
}
// El render condicional deja juntas la rama y su aviso.
// eslint-disable-next-line complexity
function FiniquitoContent({ item, allowed }: { readonly item: FollowUpItem; readonly allowed: boolean }) {
    const { data, error, busy, confirming, setConfirming, stale, uncertain, next, save, refresh } = useFiniquito(item, allowed);
    const originLabels: Record<string, string> = { ...Object.fromEntries(ORDER_STAGES.map((stage) => [stage.code, stage.label])), pending_approval: "Pendientes de aprobación", unclassified: "Sin clasificar" };
    const origin = originLabels[data?.originStage ?? ""] ?? item.state.label;
    const editable = [Boolean(next), data?.eligible, allowed, data?.canUpdate, !uncertain].every(Boolean);
    const showRefresh = [stale, [!data, Boolean(error)].every(Boolean)].some(Boolean);
    return (
        <Card size="small" className="formalization-finiquito" title="Venta caída · Finiquito">
            <p>
                Venta caída en: <strong>{origin}</strong>
            </p>
            <p className="client-detail__note">Contrato firmado. La etapa de la orden se conserva.</p>
            {!data && !error && <p role="status">Consultando finiquito…</p>}
            {data && (
                <>
                    <FiniquitoTimeline status={data.status} />
                    {data.status === "signed" && <Tag color="green">Proceso de finiquito completado</Tag>}
                    {editable && next && (
                        <Button
                            disabled={stale}
                            loading={busy}
                            onClick={() => {
                                if (next === "pending_send") void save();
                                else setConfirming(true);
                            }}
                        >
                            {actions[next]}
                        </Button>
                    )}
                    {!data.eligible && <p role="status">La orden ya no cumple las condiciones del finiquito.</p>}
                </>
            )}
            {error && <p role="alert">{error}</p>}
            {uncertain && (
                <Button loading={busy} onClick={() => void save()}>
                    Reintentar registro
                </Button>
            )}
            {showRefresh && <Button onClick={refresh}>Actualizar finiquito</Button>}
            <Modal
                open={confirming}
                title={next === "signed" ? "¿Confirmar finiquito firmado?" : "¿Confirmar finiquito enviado?"}
                okText="Confirmar registro"
                cancelText="Cancelar"
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                onOk={() => void save()}
                onCancel={() => {
                    setConfirming(false);
                }}
            >
                <p>{next === "signed" ? "Confirma que recibiste el finiquito firmado." : "Confirma que el finiquito ya fue enviado. Esta acción registra el envío realizado."}</p>
            </Modal>
        </Card>
    );
}

function FiniquitoTimeline({ status }: { readonly status: Status | null }) {
    const index = steps.findIndex((step) => step.code === status);
    return (
        <ol className="formalization-finiquito__steps" aria-label="Rama de finiquito">
            {steps.map((step, position) => (
                <li key={step.code} data-status={position <= index ? "reached" : "pending"} aria-current={position === index ? "step" : undefined}>
                    <span aria-hidden="true">{position < index ? "✓" : position + 1}</span>
                    <strong>{step.label}</strong>
                </li>
            ))}
        </ol>
    );
}
