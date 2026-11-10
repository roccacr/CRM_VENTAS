import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import CommentOutlined from "@ant-design/icons/CommentOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import PlusCircleOutlined from "@ant-design/icons/PlusCircleOutlined";
import RollbackOutlined from "@ant-design/icons/RollbackOutlined";
import SwapOutlined from "@ant-design/icons/SwapOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import Button from "antd/es/button";
import Spin from "antd/es/spin";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { ORDER_STAGES } from "../../services/formalization/order-stage-service";
import { getRecentOrderActivity, type RecentOrderActivity } from "../../services/formalization/recent-activity-service";

/** El lector personal se monta solo en el Inicio visible y autorizado. Volver a Inicio lee datos frescos. */
/** El feed trae solo las acciones de la persona autenticada. El servidor elige al actor, así que quien se muestra es esa persona. */
export function FormalizationHomeInsights({ enabled = false, visible = true, refreshVersion = 0, actorName = "" }: { readonly enabled?: boolean; readonly visible?: boolean; readonly refreshVersion?: number; readonly actorName?: string }) {
    return (
        <section className="formalization-card formalization-activity" aria-labelledby="preview-activity-title">
            <div className="formalization-activity__heading">
                <h2 id="preview-activity-title">Movimientos recientes</h2>
                <p>Tus últimas 6 acciones sobre órdenes de venta.</p>
            </div>
            {enabled && visible ? <RecentActivity key={refreshVersion} actorName={actorName.trim() || "Tú"} /> : <p className="formalization-grid__empty">Los movimientos recientes aún no están disponibles.</p>}
        </section>
    );
}

function RecentActivity({ actorName }: { readonly actorName: string }) {
    const [items, setItems] = useState<readonly RecentOrderActivity[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const pending = useRef<ReturnType<typeof getRecentOrderActivity> | null>(null);
    useEffect(() => {
        let active = true;
        pending.current ??= getRecentOrderActivity();
        void pending.current.then(
            (data) => {
                if (active) setItems(data);
            },
            () => {
                if (active) setFailed(true);
            },
        );
        return () => {
            active = false;
        };
    }, [attempt]);
    if (failed)
        return (
            <div className="formalization-grid__empty">
                <p role="alert">No se pudieron cargar tus movimientos recientes.</p>
                <Button
                    onClick={() => {
                        pending.current = null;
                        setFailed(false);
                        setAttempt((value) => value + 1);
                    }}
                >
                    Reintentar movimientos
                </Button>
            </div>
        );
    if (!items)
        return (
            <div className="formalization-grid__empty" role="status">
                <Spin size="small" /> Cargando movimientos…
            </div>
        );
    if (!items.length) return <p className="formalization-grid__empty">Aún no has registrado movimientos en órdenes de venta.</p>;
    return (
        <ol className="formalization-activity__list" aria-label="Tus movimientos recientes">
            {items.map((item) => (
                <li key={item.id} data-action={item.action}>
                    <span className="formalization-activity__icon" aria-hidden="true">
                        {ACTION_ICONS.get(item.action) ?? <FileTextOutlined />}
                    </span>
                    <div className="formalization-activity__body">
                        <strong>
                            <code>{item.orderNumber}</code> {activityLabel(item.action)}
                        </strong>
                        <span>{activityDescription(item)}</span>
                        <small className="formalization-activity__actor">
                            <UserOutlined aria-hidden="true" /> {actorName} · {formatDay(item.at)}, {formatHour(item.at)}
                        </small>
                    </div>
                    <time dateTime={item.at}>
                        <span>{formatDay(item.at)}</span>
                        <span>{formatHour(item.at)}</span>
                    </time>
                </li>
            ))}
        </ol>
    );
}

/** Un ícono por tipo de movimiento, para recorrer la lista antes de leerla. */
const ACTION_ICONS: ReadonlyMap<string, ReactNode> = new Map<string, ReactNode>([
    ["approval_change", <CheckCircleOutlined key="a" />],
    ["state_change", <SwapOutlined key="s" />],
    ["revert", <RollbackOutlined key="r" />],
    ["update", <EditOutlined key="u" />],
    ["create", <PlusCircleOutlined key="c" />],
    ["annotation", <CommentOutlined key="n" />],
]);
const formatDay = (at: string) => new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", timeZone: "America/Costa_Rica" }).format(new Date(at));
const formatHour = (at: string) => new Intl.DateTimeFormat("es-CR", { hour: "numeric", minute: "2-digit", timeZone: "America/Costa_Rica" }).format(new Date(at));
const ACTIONS: ReadonlyMap<string, string> = new Map([
    ["approval_change", "Cambio de aprobación"],
    ["state_change", "Cambio de etapa"],
    ["revert", "Reversión registrada"],
    ["update", "Orden actualizada"],
    ["create", "Orden creada"],
    ["annotation", "Anotación registrada"],
]);
function activityLabel(action: string): string {
    return ACTIONS.get(action) ?? "Movimiento registrado";
}
function stageLabel(code: string): string {
    if (code === "pending_approval") return "Pendientes de aprobación";
    return ORDER_STAGES.find((stage) => stage.code === code)?.label ?? "Estado no identificado";
}
function activityDescription(item: RecentOrderActivity): string {
    if (item.fromState && item.toState && item.fromState !== item.toState) return `${stageLabel(item.fromState)} → ${stageLabel(item.toState)}`;
    if (item.approval === "approved") return "Aprobación de Formalización registrada";
    if (item.approval === "not_approved") return "Aprobación de Formalización desmarcada";
    return "Acción registrada en la bitácora de la orden";
}
