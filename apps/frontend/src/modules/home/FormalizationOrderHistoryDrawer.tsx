import "./FormalizationClientDrawer.css";
import "./FormalizationOrderHistoryDrawer.css";
import "../administration/components/UserDetailDrawer.css";

import Button from "antd/es/button";
import Card from "antd/es/card";
import Drawer from "antd/es/drawer";
import Typography from "antd/es/typography";
import { useEffect, useRef, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderHistory, type OrderHistoryChange, type OrderHistoryEntry, type OrderHistoryPage } from "../../services/formalization/order-history-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { FormalizationDrawerLoading } from "./FormalizationDrawerLoading";

const fieldNames: Record<string, string> = { state: "Etapa", status: "Estado de aprobación", type: "Tipo de aprobación", version: "Versión", businessId: "Número de orden", contractSigned: "Contrato firmado", salePrice: "Precio de venta", netSalePrice: "Precio de venta neto", currency: "Moneda" };
const valueNames: Record<string, string> = { approved: "Aprobado", not_approved: "No aprobado", unknown: "Sin dato", active: "Activo", inactive: "Inactivo", yes: "Sí", no: "No", sales_management: "Jefe de Ventas", developer: "Desarrolladora", formalization: "Formalización" };
function value(value: OrderHistoryChange["before"], exists: boolean): string {
    if (!exists) return "No existía";
    if (value === null) return "Sin dato";
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return valueNames[String(value)] ?? String(value);
}
function Change({ change, event }: { readonly change: OrderHistoryChange; readonly event: OrderHistoryEntry }) {
    const before = change.field === "state" ? (event.fromStateLabel ?? value(change.before, change.beforeExists)) : value(change.before, change.beforeExists);
    const after = change.field === "state" ? (event.toStateLabel ?? value(change.after, change.afterExists)) : value(change.after, change.afterExists);
    return (
        <div className="order-history-change">
            <dt>{fieldNames[change.field] ?? change.field}</dt>
            <dd>
                <span>{before}</span>
                <span aria-label="cambió a"> → </span>
                <strong>{after}</strong>
            </dd>
        </div>
    );
}
/** The version counter is bookkeeping: it rides next to the title as a chip instead of taking a row of its own. */
function VersionChip({ event }: { readonly event: OrderHistoryEntry }) {
    const change = event.changes.find((entry) => entry.field === "version");
    if (!change) return null;
    return <span className="order-history__version">{`v${value(change.before, change.beforeExists)} → v${value(change.after, change.afterExists)}`}</span>;
}
const dateOf = (event: OrderHistoryEntry): number => {
    const date = event.occurredAt ?? event.recordedAt;
    return date ? new Date(date).getTime() : 0;
};
/** Newest first, whatever order the pages arrive in; the sort is stable so equal timestamps keep the server order. */
const newestFirst = (items: readonly OrderHistoryEntry[]): readonly OrderHistoryEntry[] => [...items].sort((a, b) => dateOf(b) - dateOf(a));
/** Title, newest marker and date of one entry. */
function EntryHead({ event, latest }: { readonly event: OrderHistoryEntry; readonly latest: boolean }) {
    const date = event.occurredAt ?? event.recordedAt;
    return (
        <div className="client-history__head">
            <span className="order-history__title">
                <strong>{event.label}</strong>
                {latest && <span className="order-history__latest">Más reciente</span>}
            </span>
            <time>{date ? new Date(date).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", dateStyle: "medium", timeStyle: "short" }) : "Sin fecha conocida"}</time>
        </div>
    );
}
function Entry({ event, latest }: { readonly event: OrderHistoryEntry; readonly latest: boolean }) {
    const changes = event.changes.filter((change) => change.field !== "version");
    return (
        <li data-source={event.source} data-latest={latest}>
            <EntryHead event={event} latest={latest} />
            <EvidenceDate event={event} />
            {event.reason && (
                <p className="order-history__reason">
                    <small>Motivo</small>
                    <span>{event.reason}</span>
                </p>
            )}
            {changes.length > 0 && (
                <dl>
                    {changes.map((change, index) => (
                        <Change key={change.field + String(index)} change={change} event={event} />
                    ))}
                </dl>
            )}
            {event.hiddenChanges > 0 && <p className="client-history__note">Hay campos adicionales fuera del contrato de lectura de esta vista.</p>}
            <p className="client-history__meta">
                <span>{event.actorName ?? "Responsable no registrado"}</span>
                <VersionChip event={event} />
                <span className="client-history__source">{event.source === "legacy" ? "Sistema anterior" : "Habita"}</span>
            </p>
        </li>
    );
}
function EvidenceDate({ event }: { readonly event: OrderHistoryEntry }) {
    return !event.occurredAt && event.recordedAt ? <small className="client-history__note">Fecha de registro; fecha efectiva desconocida.</small> : null;
}
function Timeline({ page }: { readonly page: OrderHistoryPage }) {
    return (
        <>
            <p className="client-history__note">{page.coverage.note}</p>
            {page.coverage.legacyLinked && !page.coverage.legacyAvailable && (
                <p role="status" className="client-history__note client-history__note--warn">
                    El historial de etapas legacy no está disponible; se muestra la auditoría conservada en Habita.
                </p>
            )}
            {!page.items.length && <p className="client-history__empty">No hay acciones registradas para esta orden. No se inventaron transiciones anteriores.</p>}
            <ol className="client-history order-history">
                {newestFirst(page.items).map((event, index) => (
                    <Entry key={event.id} event={event} latest={index === 0} />
                ))}
            </ol>
        </>
    );
}
function PageAction({ page, failed, loading, onLoad }: { readonly page: OrderHistoryPage | null; readonly failed: boolean; readonly loading: boolean; readonly onLoad: (cursor?: string) => Promise<void> }) {
    if (!failed && !page?.hasMore) return null;
    return (
        <Button
            loading={loading}
            onClick={() => {
                void onLoad(page?.nextCursor ?? undefined);
            }}
        >
            {failed ? "Reintentar" : "Cargar más registros"}
        </Button>
    );
}
function merge(previous: OrderHistoryPage | null, next: OrderHistoryPage): OrderHistoryPage {
    const items = previous?.items ?? [];
    return { ...next, items: [...items, ...next.items.filter((event) => !items.some((old) => old.id === event.id))] };
}
function Content({ item }: { readonly item: FollowUpItem }) {
    const [page, setPage] = useState<OrderHistoryPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const alive = useRef(true);
    async function load(cursor?: string) {
        setLoading(true);
        setFailed(false);
        try {
            const result = await getOrderHistory({ source: item.source, id: item.id }, cursor);
            if (alive.current) setPage((previous) => merge(previous, result));
        } catch {
            if (alive.current) setFailed(true);
        }
        if (alive.current) setLoading(false);
    }
    useEffect(() => {
        let current = true;
        alive.current = true;
        void getOrderHistory({ source: item.source, id: item.id })
            .then(
                (result) => {
                    if (current) setPage(result);
                },
                () => {
                    if (current) setFailed(true);
                },
            )
            .finally(() => {
                if (current) setLoading(false);
            });
        return () => {
            current = false;
            alive.current = false;
        };
    }, [item.source, item.id]);
    if (!page && loading) return <FormalizationDrawerLoading label="Bitácora de la orden" title="Cargando bitácora de la orden…" cards={[5]} />;
    return (
        <Card size="small" title="Historial de la orden de venta" className="order-history-card">
            {page && <Timeline page={page} />}
            {failed && (
                <p role="alert" className="client-history__note client-history__note--warn">
                    No fue posible consultar la bitácora. Revisa tu acceso o vuelve a intentarlo.
                </p>
            )}
            <PageAction page={page} failed={failed} loading={loading} onLoad={load} />
        </Card>
    );
}
/** Lazy read on opening, same enterprise side panel as the client; switching orders unmounts obsolete requests. */
export function FormalizationOrderHistoryDrawer({ item, open, onClose }: { readonly item: FollowUpItem; readonly open: boolean; readonly onClose: () => void }) {
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName="user-detail-drawer client-detail-drawer"
            title={
                <div className="user-detail-drawer__identity">
                    <div className="user-detail-drawer__identity-copy">
                        <Typography.Title level={4}>Bitácora de la orden</Typography.Title>
                        <Typography.Text type="secondary">{[item.project?.name, "Orden " + item.number].filter(Boolean).join(" · ")}</Typography.Text>
                    </div>
                </div>
            }
            aria-label="Bitácora de la orden"
            open={open}
            onClose={onClose}
            destroyOnHidden
            closable={{ "aria-label": "Cerrar bitácora de la orden", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            styles={{ ...ADMINISTRATION_DRAWER_PROPS.styles, wrapper: { ...ADMINISTRATION_DRAWER_PROPS.styles.wrapper, maxWidth: "100vw" } }}
        >
            {open && <Content key={item.source + ":" + item.id} item={item} />}
        </Drawer>
    );
}
