import "../administration/components/UserDetailDrawer.css";
import "../administration/catalogs/CatalogItemsPage.css";
import "../administration/catalogs/ProjectsView.css";
import "../administration/catalogs/EnterpriseSurface.css";
import "./FormalizationClientDrawer.css";

import Button from "antd/es/button";
import Card from "antd/es/card";
import Descriptions from "antd/es/descriptions";
import Drawer from "antd/es/drawer";
import Typography from "antd/es/typography";
import { useEffect, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderUnitDetail, type OrderUnitDetail } from "../../services/formalization/order-unit-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { FormalizationDrawerLoading } from "./FormalizationDrawerLoading";

const QUALIFIER = /^(.*?) \((unidad no informada|moneda no informada|sin equivalencia confirmada)\)$/;
const QUALIFIER_NOTES: Record<string, string> = { "unidad no informada": "El origen no informa la unidad de medida.", "moneda no informada": "El origen no informa la moneda.", "sin equivalencia confirmada": "El estado se muestra como viene del origen, sin equivalencia confirmada." };

/** The same caution on every row is noise: it is said once per group, and the labels stay short. */
function tidy(group: OrderUnitDetail["groups"][number]) {
    const notes = new Set<string>();
    const fields = group.fields.map((field) => {
        const match = QUALIFIER.exec(field.label);
        if (!match?.[1] || !match[2]) return field;
        notes.add(QUALIFIER_NOTES[match[2]] ?? "");
        return { ...field, label: match[1] };
    });
    return { title: group.title, notes: [...notes].filter(Boolean), filled: fields.filter((field) => field.value !== "Sin dato"), empty: fields.filter((field) => field.value === "Sin dato") };
}

function UnitGroup({ group }: { readonly group: OrderUnitDetail["groups"][number] }) {
    const { title, notes, filled, empty } = tidy(group);
    return (
        <Card size="small" title={title}>
            {notes.map((note) => (
                <p className="client-detail__note" key={note}>
                    {note}
                </p>
            ))}
            {filled.length > 0 && <Descriptions column={1} colon={false} size="small" items={filled.map((field) => ({ key: field.label, label: field.label, children: field.value }))} />}
            {empty.length > 0 && (
                <details className="client-detail__empties" data-alone={filled.length === 0} open={filled.length === 0}>
                    <summary>{empty.length === 1 ? "1 campo sin dato" : `${String(empty.length)} campos sin dato`}</summary>
                    <ul>
                        {empty.map((field) => (
                            <li key={field.label}>{field.label}</li>
                        ))}
                    </ul>
                </details>
            )}
        </Card>
    );
}

function UnitContent({ item, onRetry }: { readonly item: FollowUpItem; readonly onRetry: () => void }) {
    const [data, setData] = useState<OrderUnitDetail | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        void getOrderUnitDetail({ source: item.source, id: item.id }).then(
            (result) => {
                if (active) setData(result);
            },
            () => {
                if (active) setFailed(true);
            },
        );
        return () => {
            active = false;
        };
    }, [item.source, item.id]);
    if (failed)
        return (
            <div role="alert">
                <p>No fue posible consultar la unidad. Puede que no tengas acceso o que la información no esté disponible.</p>
                <Button onClick={onRetry}>Reintentar</Button>
            </div>
        );
    if (!data) return <FormalizationDrawerLoading label="Información de la unidad" title="Cargando información de la unidad…" cards={[5, 8, 4, 1]} />;
    if (data.warnings.length > 0) return <p role="status">La relación con la unidad no está disponible o es ambigua. No se seleccionó otra unidad.</p>;
    return (
        <div className="user-detail-drawer__sections">
            {data.groups.map((group) => (
                <UnitGroup key={group.title} group={group} />
            ))}
        </div>
    );
}

/** Shared right-hand drawer appearance, with a fresh authorized read on every opening. */
export function FormalizationUnitDrawer({ item, open, onClose }: { readonly item: FollowUpItem; readonly open: boolean; readonly onClose: () => void }) {
    const [attempt, setAttempt] = useState(0);
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName="user-detail-drawer client-detail-drawer catalog-item-detail-drawer catalog-item-detail-drawer--projects"
            title={
                <div className="user-detail-drawer__identity">
                    <div className="user-detail-drawer__identity-copy">
                        <Typography.Title level={4}>{item.unit ?? "Unidad"}</Typography.Title>
                        <Typography.Text type="secondary">{[item.project?.name, "Orden " + item.number].filter(Boolean).join(" · ")}</Typography.Text>
                    </div>
                </div>
            }
            aria-label="Detalle de la unidad"
            open={open}
            onClose={onClose}
            destroyOnHidden
            closable={{ "aria-label": "Cerrar detalle de la unidad", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            styles={{ ...ADMINISTRATION_DRAWER_PROPS.styles, wrapper: { ...ADMINISTRATION_DRAWER_PROPS.styles.wrapper, maxWidth: "100vw" }, body: { minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" } }}
        >
            {open && (
                <UnitContent
                    key={item.source + ":" + item.id + ":" + String(attempt)}
                    item={item}
                    onRetry={() => {
                        setAttempt((value) => value + 1);
                    }}
                />
            )}
        </Drawer>
    );
}
