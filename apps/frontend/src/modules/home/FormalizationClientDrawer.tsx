import "../administration/components/UserDetailDrawer.css";
import "../administration/catalogs/CatalogItemsPage.css";
import "../administration/catalogs/ProjectsView.css";
import "../administration/catalogs/EnterpriseSurface.css";
import "./FormalizationClientDrawer.css";

import UserOutlined from "@ant-design/icons/UserOutlined";
import WhatsAppOutlined from "@ant-design/icons/WhatsAppOutlined";
import Button from "antd/es/button";
import Card from "antd/es/card";
import Descriptions from "antd/es/descriptions";
import Drawer from "antd/es/drawer";
import Typography from "antd/es/typography";
import { useEffect, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderClientDetail, type OrderClientDetail } from "../../services/formalization/order-client-service";
import { normalizeWhatsAppPhone } from "../../services/formalization/whatsapp-phone";
import { canReadLeadProfile, leadProfilePath } from "../../services/leads/lead-profile-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { FormalizationDrawerLoading } from "./FormalizationDrawerLoading";
import { FormalizationScheduleEvent } from "./FormalizationScheduleEvent";

interface ClientContentProps {
    readonly onCalendarClosed?: (() => void) | undefined;
    readonly item: FollowUpItem;
    readonly contactOnly?: boolean;
    readonly onNavigate?: ((path: string) => void) | undefined;
    readonly effectivePermissions: readonly { readonly code: string; readonly effect: string }[];
}
/** Cada orden y reintento monta una lectura nueva; una respuesta anterior nunca cambia el cliente visible. */
export function FormalizationClientContent(props: ClientContentProps) {
    const [attempt, setAttempt] = useState(0);
    return (
        <ClientContent
            key={`${props.item.source}:${props.item.id}:${String(attempt)}`}
            {...props}
            onRetry={() => {
                setAttempt((value) => value + 1);
            }}
        />
    );
}

function ClientContent({ item, onRetry, effectivePermissions, onNavigate, onCalendarClosed, contactOnly = false }: ClientContentProps & { readonly onRetry: () => void }) {
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
    if (!data) return <FormalizationDrawerLoading label="Información del cliente" title="Cargando información del cliente…" cards={[3]} />;
    if (data.warnings.length > 0) return <p role="status">La relación con el cliente no está disponible o es ambigua. No se seleccionó otro cliente.</p>;
    return (
        <div className="user-detail-drawer__sections">
            <div className="record-actions">
                <WhatsAppAction data={data} permissions={effectivePermissions} />
                <FormalizationScheduleEvent key={`${item.source}:${item.id}`} item={item} effectivePermissions={effectivePermissions} onClosed={onCalendarClosed} />
                {canReadLeadProfile(effectivePermissions) && data.leadIdentity && (
                    <Button
                        href={leadProfilePath(data.leadIdentity)}
                        onClick={(event) => {
                            if (!onNavigate || !data.leadIdentity || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
                            // La navegación interna conserva la sesión; los accesos directos siguen protegidos por la ruta.
                            event.preventDefault();
                            onNavigate(leadProfilePath(data.leadIdentity));
                        }}
                        icon={<UserOutlined aria-hidden="true" />}
                    >
                        Ver perfil del cliente
                    </Button>
                )}
            </div>
            {/* El resumen presenta únicamente grupos del cliente; los datos de la orden y el expediente pertenecen a sus propias vistas. */}
            {data.groups
                .filter((group) => !contactOnly || group.title === "Contacto")
                .map((group) => (
                    <Card key={group.title} size="small" title={group.title} className="formalization-compact-card formalization-compact-card--rows">
                        <Descriptions column={1} colon={false} size="small" items={group.fields.map((field) => ({ key: field.label, label: field.label, children: field.value === "Sin dato" ? <span className="client-detail__empty">Sin dato</span> : field.value }))} />
                    </Card>
                ))}
        </div>
    );
}

function WhatsAppAction({ data, permissions }: { readonly data: OrderClientDetail; readonly permissions: ClientContentProps["effectivePermissions"] }) {
    const matches = permissions.filter((permission) => permission.code === "formalizacion.orders.whatsapp");
    if (!matches.some((permission) => permission.effect === "allow") || matches.some((permission) => permission.effect === "deny")) return null;
    const phone = normalizeWhatsAppPhone(data.phone, data.countryCode);
    return (
        <div>
            <Button icon={<WhatsAppOutlined aria-hidden="true" />} {...(phone ? { href: `https://web.whatsapp.com/send?phone=${phone}` } : {})} target="_blank" rel="noopener noreferrer" disabled={!phone}>
                Ir a WhatsApp
            </Button>
            {!phone && <p role="status">El cliente no tiene un teléfono válido para WhatsApp. Usa un solo número con prefijo internacional; para Costa Rica se aceptan 8 dígitos.</p>}
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

/** De quién es el panel, en el mismo bloque de identidad que usa el detalle de usuario. */
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

/** El mismo panel derecho. Cada apertura hace una lectura autorizada nueva. */
export function FormalizationClientDrawer({ item, open, onClose, effectivePermissions = [], onNavigate, onCalendarClosed }: { readonly item: FollowUpItem; readonly open: boolean; readonly onClose: () => void; readonly onNavigate?: ((path: string) => void) | undefined; readonly onCalendarClosed?: (() => void) | undefined; readonly effectivePermissions?: readonly { readonly code: string; readonly effect: string }[] }) {
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
            <FormalizationClientContent item={item} onNavigate={onNavigate} effectivePermissions={effectivePermissions} onCalendarClosed={onCalendarClosed} />
        </Drawer>
    );
}
