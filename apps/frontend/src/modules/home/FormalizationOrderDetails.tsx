import "./FormalizationClientDrawer.css";
import "./FormalizationOrderDetails.css";

import Button from "antd/es/button";
import Card from "antd/es/card";
import { type ReactNode, useEffect, useState } from "react";

import { ExpedienteLink } from "../../components/ExpedienteLink";
import { type DatabaseOrderDetail, type DatabaseOrderDetailField, getDatabaseOrder } from "../../services/formalization/database-order-service";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { canReadLeadProfile, leadProfilePath } from "../../services/leads/lead-profile-service";
import { FormalizationDrawerLoading } from "./FormalizationDrawerLoading";

/** Calendar dates retain the source day, independently of the browser timezone. Invalid dates remain visible. */
function dateValue(value: string): string {
    const day = /^\d{4}-\d{2}-\d{2}(?:$|T)/.exec(value)?.[0].slice(0, 10);
    if (!day || (value.length > 10 && Number.isNaN(Date.parse(value)))) return value;
    const parsed = new Date(day + "T00:00:00Z");
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day ? value : `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}
/** Format decimal text without converting the amount to floating point or guessing a currency. */
function moneyValue(value: string, currency: string | null): string {
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
    const amount = match ? `${match[1] ?? ""}${(match[2] ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${match[3] === undefined ? "" : "," + match[3]}` : value;
    return currency?.trim() ? `${amount} ${currency.trim()}` : amount;
}
function DetailValue({ field, currency }: { readonly field: DatabaseOrderDetailField; readonly currency: string | null }) {
    const value = field.value?.trim();
    if (!value) return <span className="client-detail__empty">—</span>;
    if (field.kind === "link") return <ExpedienteLink value={field.value} />;
    if (field.kind === "date") return <>{dateValue(value)}</>;
    if (field.kind === "money") return <>{moneyValue(value, currency)}</>;
    if (field.kind === "boolean") return <>{({ yes: "Sí", no: "No", unknown: "—" } as Record<string, string>)[value] ?? value}</>;
    return <>{field.value}</>;
}
/** Shared label/value layout for order sections, preserving each caller's display values. */
export function OrderSectionFields({ items }: { readonly items: readonly { readonly key: string; readonly label: string; readonly value: ReactNode }[] }) {
    return (
        <dl className="formalization-order-fields">
            {items.map((item) => (
                <div key={item.key}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}
function OrderFields({ fields, currency }: { readonly fields: readonly DatabaseOrderDetailField[]; readonly currency: string | null }) {
    return <OrderSectionFields items={fields.map((field) => ({ key: field.code, label: field.label, value: <DetailValue field={field} currency={currency} /> }))} />;
}
function ClientSummary({ detail, permissions }: { readonly detail: DatabaseOrderDetail; readonly permissions: readonly { readonly code: string; readonly effect: string }[] }) {
    const client = detail.client;
    return (
        <Card size="small" title="Cliente">
            <OrderFields
                currency={null}
                fields={(
                    [
                        ["name", "Nombre"],
                        ["identification", "Identificación"],
                        ["phone", "Teléfono"],
                        ["email", "Correo"],
                        ["advisor", "Asesor"],
                    ] as const
                ).map(([code, label]) => ({ code, label, value: client[code], kind: "text" }))}
            />
            {client.identity && canReadLeadProfile(permissions) && (
                <div className="client-detail__profile">
                    <Button href={leadProfilePath(client.identity)}>Ver perfil del cliente</Button>
                </div>
            )}
        </Card>
    );
}
function OrderDetailsContent({ item, permissions }: { readonly item: FollowUpItem; readonly permissions: readonly { readonly code: string; readonly effect: string }[] }) {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; detail: DatabaseOrderDetail | undefined; source: "native" | "legacy" }>({ status: "loading" });
    useEffect(() => {
        let active = true;
        void getDatabaseOrder({ source: item.source, id: item.id }).then(
            (result) => {
                if (active) setState({ status: "ready", detail: result.detail, source: result.source });
            },
            () => {
                if (active) setState({ status: "error" });
            },
        );
        return () => {
            active = false;
        };
    }, [item.source, item.id, attempt]);
    if (state.status === "loading") return <FormalizationDrawerLoading label="Detalle de la orden" title="Cargando detalle de la orden…" cards={[5, 5, 4]} />;
    if (state.status === "error")
        return (
            <div role="alert">
                <p>No fue posible consultar el detalle de la orden.</p>
                <Button
                    onClick={() => {
                        setState({ status: "loading" });
                        setAttempt((value) => value + 1);
                    }}
                >
                    Reintentar
                </Button>
            </div>
        );
    const detail = state.detail;
    if (!detail) return <p role="status">El detalle de la orden no está disponible.</p>;
    return (
        <div className="user-detail-drawer__sections formalization-order-details" aria-label="Detalle completo de la orden">
            <p className="client-detail__note">Datos de la orden · {state.source === "native" ? "CRM" : "Sistema anterior"}</p>
            {detail.warnings.includes("client:linked_sources") && <p role="status">Datos del cliente vinculados entre ambos sistemas.</p>}
            {detail.warnings.some((warning) => warning !== "client:linked_sources") && <p role="status">Algunas relaciones o datos de la orden no están disponibles. Se muestran únicamente los valores confirmados.</p>}
            <div className="formalization-order-details__grid">
                <ClientSummary detail={detail} permissions={permissions} />
                {detail.sections.map((section) => (
                    <Card size="small" title={section.title} key={section.title}>
                        <OrderFields currency={detail.currency} fields={section.title === "Registro" ? [...section.fields, { code: "stageChangedBy", label: "Último cambio por", value: state.source === item.source ? (item.changedBy?.name ?? null) : null, kind: "text" }] : section.fields} />
                    </Card>
                ))}
            </div>
        </div>
    );
}
/** Shared fresh authorized database detail. Keying by order/version prevents old responses and errors leaking across records. */
export function FormalizationOrderDetails({ item, permissions = [] }: { readonly item: FollowUpItem; readonly permissions?: readonly { readonly code: string; readonly effect: string }[] }) {
    return <OrderDetailsContent key={`${item.source}:${item.id}:${String(item.stateVersion)}`} item={item} permissions={permissions} />;
}
