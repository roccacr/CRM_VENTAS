import "../administration/components/UserDetailDrawer.css";
import "../administration/catalogs/CatalogItemsPage.css";
import "../administration/catalogs/ProjectsView.css";
import "../administration/catalogs/EnterpriseSurface.css";
import "./FormalizationClientDrawer.css";

import UserOutlined from "@ant-design/icons/UserOutlined";
import Button from "antd/es/button";
import Card from "antd/es/card";
import Descriptions from "antd/es/descriptions";
import Drawer from "antd/es/drawer";
import Typography from "antd/es/typography";
import { Fragment, useEffect, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderClientDetail, type OrderClientDetail } from "../../services/formalization/order-client-service";
import { canReadLeadProfile, leadProfilePath } from "../../services/leads/lead-profile-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { FormalizationClientHistory } from "./FormalizationClientHistory";
import { FormalizationDrawerLoading } from "./FormalizationDrawerLoading";

function ClientContent({ item, onRetry, effectivePermissions }: { readonly item: FollowUpItem; readonly onRetry: () => void; readonly effectivePermissions: readonly { readonly code: string; readonly effect: string }[] }) {
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
    if (!data) return <FormalizationDrawerLoading label="Información del cliente" title="Cargando información del cliente…" cards={[3, 4, 3]} />;
    if (data.warnings.length > 0) return <p role="status">La relación con el cliente no está disponible o es ambigua. No se seleccionó otro cliente.</p>;
    return (
        <div className="user-detail-drawer__sections">
            {canReadLeadProfile(effectivePermissions) && data.leadIdentity && (
                <Button href={leadProfilePath(data.leadIdentity)} icon={<UserOutlined aria-hidden="true" />}>
                    Ver perfil del cliente
                </Button>
            )}
            {data.groups.map((group) => (
                <Fragment key={group.title}>
                    <Card size="small" title={group.title}>
                        <Descriptions column={1} colon={false} size="small" items={group.fields.map((field) => ({ key: field.label, label: field.label, children: field.value === "Sin dato" ? <span className="client-detail__empty">Sin dato</span> : field.value }))} />
                    </Card>
                    {group.title === "Captación y seguimiento" && <FormalizationClientHistory initial={data.history ?? null} identity={{ source: item.source, id: item.id }} />}
                </Fragment>
            ))}
        </div>
    );
}

const initialsOf = (name: string): string =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");

/** Who the drawer is about, in the same identity block the user detail uses. */
function ClientIdentity({ item }: { readonly item: FollowUpItem }) {
    const name = item.client ?? "Cliente";
    return (
        <div className="user-detail-drawer__identity">
            <span className="client-detail__avatar" aria-hidden="true">
                {initialsOf(name)}
            </span>
            <div className="user-detail-drawer__identity-copy">
                <Typography.Title level={4}>{name}</Typography.Title>
                <Typography.Text type="secondary">Cliente de la orden {item.number}</Typography.Text>
            </div>
        </div>
    );
}

/** Shared right-hand drawer appearance, with a fresh authorized read on every opening. */
export function FormalizationClientDrawer({ item, open, onClose, effectivePermissions = [] }: { readonly item: FollowUpItem; readonly open: boolean; readonly onClose: () => void; readonly effectivePermissions?: readonly { readonly code: string; readonly effect: string }[] }) {
    const [attempt, setAttempt] = useState(0);
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName="user-detail-drawer client-detail-drawer catalog-item-detail-drawer catalog-item-detail-drawer--projects"
            title={<ClientIdentity item={item} />}
            aria-label="Detalle del cliente"
            open={open}
            onClose={onClose}
            destroyOnHidden
            closable={{ "aria-label": "Cerrar detalle del cliente", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            styles={{ ...ADMINISTRATION_DRAWER_PROPS.styles, wrapper: { ...ADMINISTRATION_DRAWER_PROPS.styles.wrapper, maxWidth: "100vw" }, body: { minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" } }}
        >
            <ClientContent
                key={item.source + ":" + item.id + ":" + String(attempt)}
                item={item}
                effectivePermissions={effectivePermissions}
                onRetry={() => {
                    setAttempt((value) => value + 1);
                }}
            />
        </Drawer>
    );
}
