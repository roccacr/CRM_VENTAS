import SyncOutlined from "@ant-design/icons/SyncOutlined";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { useEffect, useRef, useState } from "react";

import { getNetsuiteSynchronizationContext, type NetsuiteOrderIdentity, type NetsuiteSynchronizationContext, synchronizeNetsuiteOrder } from "../../services/formalization/netsuite-order-service";

interface SynchronizationProps {
    readonly identity: NetsuiteOrderIdentity;
    readonly allowed: boolean;
    readonly onEnvironment?: (environment: "production" | "sandbox") => void;
    readonly onSynchronized?: (() => void | Promise<void>) | undefined;
}
function synchronizationNotice(result: Awaited<ReturnType<typeof synchronizeNetsuiteOrder>>): string {
    if (result.result === "unchanged") return "La orden ya coincide con NetSuite. Sin cambios.";
    return `${String(result.changes)} campos actualizados en ${result.destination === "native" ? "CRM" : "el sistema anterior"}.`;
}
function useSynchronization({ identity, allowed, onEnvironment, onSynchronized }: SynchronizationProps) {
    const [context, setContext] = useState<NetsuiteSynchronizationContext | null>(null);
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [notice, setNotice] = useState("");
    const alive = useRef(false);
    const pending = useRef(false);
    const { source, id } = identity;
    useEffect(() => {
        let active = true;
        alive.current = true;
        void getNetsuiteSynchronizationContext({ source, id }).then(
            (value) => {
                if (!active) return;
                setContext(value);
                onEnvironment?.(value.environment);
            },
            () => {
                if (active) setNotice("No se pudo verificar el ambiente de NetSuite. Recarga la orden para reintentar.");
            },
        );
        return () => {
            active = false;
            alive.current = false;
        };
    }, [source, id, onEnvironment]);
    const refreshView = async () => {
        try {
            await onSynchronized?.();
        } catch {
            if (alive.current) setNotice("Sincronización guardada. Recarga la orden para ver los datos actualizados.");
        }
    };
    const synchronize = async () => {
        if ([pending.current, context?.canSynchronize !== true, !allowed].some(Boolean)) return;
        pending.current = true;
        setStatus("saving");
        setNotice("");
        try {
            const result = await synchronizeNetsuiteOrder({ source, id });
            if (!alive.current) return;
            setStatus("success");
            setOpen(false);
            setNotice(synchronizationNotice(result));
            await refreshView();
        } catch {
            if (alive.current) {
                setStatus("error");
                setOpen(false);
                setNotice("No se pudo confirmar la sincronización. Recarga la orden para verificar el resultado antes de reintentar.");
            }
        } finally {
            pending.current = false;
        }
    };
    const label = context?.environment === "production" ? "Producción" : "Sandbox";
    const canSynchronize = context?.canSynchronize === true;
    const unavailable = context !== null && !canSynchronize;
    return { context, label, canSynchronize, unavailable, open, setOpen, status, notice, pending, synchronize };
}
/** Environment and commit feedback remain scoped to the mounted order identity. */
export function NetsuiteSynchronizationActions(props: SynchronizationProps) {
    const { allowed, onEnvironment } = props;
    const { context, label, canSynchronize, unavailable, open, setOpen, status, notice, pending, synchronize } = useSynchronization(props);
    const noticeRole = status === "error" ? "alert" : "status";
    return (
        <div className="formalization-netsuite-sync">
            {!onEnvironment && context && <span>NetSuite {label}</span>}
            {allowed && (
                <Button
                    className="formalization-command"
                    icon={<SyncOutlined aria-hidden="true" />}
                    disabled={!canSynchronize}
                    loading={status === "saving"}
                    onClick={() => {
                        setOpen(true);
                    }}
                >
                    Sincronizar con NetSuite
                </Button>
            )}
            {allowed && unavailable && <span role="status">Sincronización deshabilitada para este ambiente.</span>}
            {notice && <span role={noticeRole}>{notice}</span>}
            <Modal
                title="Sincronizar datos de la orden"
                open={open}
                confirmLoading={status === "saving"}
                okText="Confirmar sincronización"
                cancelText="Cancelar"
                closable={status !== "saving"}
                mask={{ closable: false }}
                cancelButtonProps={{ disabled: status === "saving" }}
                onCancel={() => {
                    if (!pending.current) setOpen(false);
                }}
                onOk={() => {
                    void synchronize();
                }}
            >
                <p>
                    Origen: <strong>NetSuite {label}</strong>.
                </p>
                <p>Se actualizarán los campos mapeados de esta orden en su base correspondiente con los valores de NetSuite. Se conservarán los campos internos del CRM y los valores que NetSuite no envíe. Los indicadores recibidos pueden avanzar la etapa según las reglas existentes de Formalización.</p>
            </Modal>
        </div>
    );
}
