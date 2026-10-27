import "../administration/components/UserDetailDrawer.css";
import "../administration/catalogs/CatalogItemsPage.css";
import "../administration/catalogs/ProjectsView.css";
import "../administration/catalogs/EnterpriseSurface.css";

import Button from "antd/es/button";
import Card from "antd/es/card";
import Descriptions from "antd/es/descriptions";
import Drawer from "antd/es/drawer";
import Skeleton from "antd/es/skeleton";
import { useEffect, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderClientDetail, type OrderClientDetail } from "../../services/formalization/order-client-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";

function ClientContent({ item, onRetry }: { readonly item: FollowUpItem; readonly onRetry: () => void }) {
    const [data, setData] = useState<OrderClientDetail | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        void getOrderClientDetail({ source: item.source, id: item.id }).then(
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
                <p>No fue posible consultar el cliente. Puede que no tengas acceso o que la información no esté disponible.</p>
                <Button onClick={onRetry}>Reintentar</Button>
            </div>
        );
    if (!data)
        return (
            <div role="status" aria-busy="true">
                <p>Cargando información del cliente…</p>
                <Skeleton active paragraph={{ rows: 8 }} />
            </div>
        );
    if (data.warnings.length > 0) return <p role="status">La relación con el cliente no está disponible o es ambigua. No se seleccionó otro cliente.</p>;
    return (
        <div className="user-detail-drawer__sections">
            {data.groups.map((group) => (
                <Card key={group.title} size="small" title={group.title}>
                    <Descriptions column={1} colon={false} size="small" items={group.fields.map((field) => ({ key: field.label, label: field.label, children: field.value }))} />
                </Card>
            ))}
        </div>
    );
}

/** Shared right-hand drawer appearance, with a fresh authorized read on every opening. */
export function FormalizationClientDrawer({ item, open, onClose }: { readonly item: FollowUpItem; readonly open: boolean; readonly onClose: () => void }) {
    const [attempt, setAttempt] = useState(0);
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName="user-detail-drawer catalog-item-detail-drawer catalog-item-detail-drawer--projects"
            title="Detalle del cliente"
            open={open}
            onClose={onClose}
            destroyOnHidden
            closable={{ "aria-label": "Cerrar detalle del cliente", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            styles={{ ...ADMINISTRATION_DRAWER_PROPS.styles, wrapper: { ...ADMINISTRATION_DRAWER_PROPS.styles.wrapper, maxWidth: "100vw" }, body: { minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" } }}
        >
            <ClientContent
                key={item.source + ":" + item.id + ":" + String(attempt)}
                item={item}
                onRetry={() => {
                    setAttempt((value) => value + 1);
                }}
            />
        </Drawer>
    );
}
