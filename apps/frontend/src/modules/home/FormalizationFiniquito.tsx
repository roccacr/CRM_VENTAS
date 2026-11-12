import "./FormalizationFiniquito.css";

import Button from "antd/es/button";
import Card from "antd/es/card";
import Modal from "antd/es/modal";
import Tag from "antd/es/tag";
import { useEffect, useRef, useState } from "react";

import { ApiClientError, apiRequest } from "../../services/api/api-client";
import { FINIQUITO_SECTIONS, type FiniquitoManualChange, type FiniquitoOperation, type FiniquitoSnapshot as Snapshot, nextFiniquitoAction, parseFiniquitoSnapshot as parse } from "../../services/formalization/finiquito-service";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ORDER_STAGES } from "../../services/formalization/order-stage-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import { FormalizationFiniquitoStageEditor } from "./FormalizationFiniquitoStageEditor";

const steps = FINIQUITO_SECTIONS;
const actions = { balance_validated: "Marcar saldo validado", sent: "Marcar finiquito enviado", signed: "Marcar finiquito recibido" };
const confirmations = {
    balance_validated: { title: "¿Confirmar saldo validado?", text: "Confirma que revisaste el saldo de la reserva. Esta marca es propia de Habita y no cambia Reserva Aplicada ni los checks de NetSuite." },
    sent: { title: "¿Confirmar finiquito enviado?", text: "Confirma que el correo de finiquito ya fue enviado al cliente. Esta acción registra el envío realizado." },
    signed: { title: "¿Confirmar finiquito recibido?", text: "Confirma que recibiste el finiquito firmado y devuelto por el cliente." },
};
function writeFailure(failure: unknown) {
    const stale = failure instanceof ApiClientError && [400, 401, 403, 404, 409].includes(failure.status);
    return { stale, message: stale ? "La orden o tus permisos cambiaron. Actualiza el finiquito." : "No se confirmó el cambio. Reintenta la misma operación." };
}
/** Las dos banderas confirmadas abren la rama. El servidor las vuelve a comprobar en cada mutación. */
export function FormalizationFiniquito({ item, allowed, onSaved }: { readonly item: FollowUpItem; readonly allowed: boolean; readonly onSaved?: (() => void) | undefined }) {
    if (item.saleLost !== true && item.finiquitoInFlow !== true) return null;
    return <FiniquitoContent key={`${item.source}:${item.id}`} item={item} allowed={allowed} onSaved={onSaved} />;
}
function useFiniquito(item: FollowUpItem, allowed: boolean, onSaved: (() => void) | undefined) {
    const identity = { source: item.source, id: item.id.replace(/^legacy:/, "") };
    const [data, setData] = useState<Snapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [stale, setStale] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const pending = useRef(false);
    const operation = useRef<FiniquitoOperation | null>(null);
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
    }, [item.source, item.id, item.contractSigned, item.saleLost, item.finiquitoInFlow, revision]);
    const next = data ? nextFiniquitoAction(data) : null;
    // El reintento de una respuesta incierta se queda con su operación original.
    // eslint-disable-next-line complexity
    const save = async (manual?: FiniquitoManualChange) => {
        if (!data || (!next && !manual && !operation.current)) return;
        if ([!allowed, !data.canUpdate, !data.eligible, stale, pending.current].some(Boolean)) return;
        if (!operation.current) {
            if (manual) operation.current = { ...identity, status: "set_stage", ...manual, expectedVersion: data.version, operationId: crypto.randomUUID() };
            else if (next) operation.current = { ...identity, status: next, expectedVersion: data.version, operationId: crypto.randomUUID() };
        }
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
            onSaved?.();
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
function FiniquitoContent({ item, allowed, onSaved }: { readonly item: FollowUpItem; readonly allowed: boolean; readonly onSaved: (() => void) | undefined }) {
    const { data, error, busy, confirming, setConfirming, stale, uncertain, next, save, refresh } = useFiniquito(item, allowed, onSaved);
    const originLabels: Record<string, string> = { ...Object.fromEntries(ORDER_STAGES.map((stage) => [stage.code, stage.label])), pending_approval: "Pendientes de aprobación", unclassified: "Sin clasificar" };
    const origin = originLabels[data?.originStage ?? ""] ?? item.state.label;
    const editable = [Boolean(next), data?.eligible, allowed, data?.canUpdate, !uncertain, next === "balance_validated" || data?.contractSigned].every(Boolean);
    const confirmation = confirmations[next ?? "balance_validated"];
    const showRefresh = [stale, [!data, Boolean(error)].every(Boolean)].some(Boolean);
    return (
        <Card size="small" className="formalization-finiquito" title="Gestión de finiquito">
            {data?.balanceValidated && (
                <p>
                    Venta caída en: <strong>{origin}</strong>
                    {" · "}Contrato firmado: <strong>{data.contractSigned ? "Sí" : "No"}</strong>. La etapa comercial se conserva.
                </p>
            )}
            {!data && !error && <p role="status">Consultando finiquito…</p>}
            {data && (
                <>
                    <FiniquitoTimeline data={data} />
                    {allowed && data.canUpdate && data.eligible && <FormalizationFiniquitoStageEditor key={data.version} data={data} disabled={stale || uncertain} busy={busy} onSave={save} />}
                    {data.balanceValidated && data.received && <Tag color="green">Proceso de finiquito completado</Tag>}
                    {editable && next && (
                        <Button
                            disabled={stale}
                            loading={busy}
                            onClick={() => {
                                setConfirming(true);
                            }}
                        >
                            {actions[next]}
                        </Button>
                    )}
                    {!data.eligible && <p role="status">La orden ya no cumple las condiciones del finiquito.</p>}
                    {data.balanceValidated && !data.contractSigned && !data.sent && !data.received && <p role="status">Saldo validado. Falta confirmar Contrato firmado en NetSuite para enviar el finiquito mediante el paso ordinario.</p>}
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
                title={confirmation.title}
                okText="Confirmar registro"
                cancelText="Cancelar"
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                onOk={() => void save()}
                onCancel={() => {
                    setConfirming(false);
                }}
            >
                <p>{confirmation.text}</p>
            </Modal>
        </Card>
    );
}

function FiniquitoTimeline({ data }: { readonly data: Snapshot }) {
    const index = { balance_validated: 0, sent: 1, signed: 2, complete: 3 }[nextFiniquitoAction(data) ?? "complete"];
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
