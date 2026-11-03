import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Card from "antd/es/card";
import Descriptions from "antd/es/descriptions";
import Result from "antd/es/result";
import Space from "antd/es/space";
import Spin from "antd/es/spin";
import Tag from "antd/es/tag";
import { useEffect, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { IdentityProfile } from "../../services/auth/identity-contracts";
import { canReadLeadProfile, getLeadProfile, type LeadIdentity, type LeadProfileResult, readLeadIdentity } from "../../services/leads/lead-profile-service";

const originLabel = { native: "Nuevo", legacy: "Legacy" };

/** La página valida también permisos para impedir lecturas si se monta fuera del router. */
export function LeadProfilePage({ effectivePermissions = [] }: { readonly effectivePermissions?: IdentityProfile["permissions"] }) {
    if (!canReadLeadProfile(effectivePermissions)) return <Result status="403" title="Acceso denegado" subTitle="No tienes permiso para ver el perfil completo del lead." />;
    const identity = readLeadIdentity(window.location.search);
    if (!identity) return <Result status="404" title="Lead no encontrado" subTitle="El identificador o el origen de la dirección no es válido." />;
    return <ProfileContent key={`${identity.source}:${identity.id}`} identity={identity} />;
}

function ProfileContent({ identity }: { readonly identity: LeadIdentity }) {
    const [data, setData] = useState<LeadProfileResult | null>(null);
    const [status, setStatus] = useState<number | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [cursor, setCursor] = useState<string | undefined>();
    const [orderPage, setOrderPage] = useState(1);
    const { source, id } = identity;
    useEffect(() => {
        let active = true;
        void getLeadProfile({ source, id }, cursor, orderPage).then(
            (result) => {
                if (active) {
                    setData(result);
                    setStatus(null);
                }
            },
            (error: unknown) => {
                if (active) setStatus(error instanceof ApiClientError ? error.status : 503);
            },
        );
        return () => {
            active = false;
        };
    }, [source, id, cursor, orderPage, attempt]);
    const retry = () => {
        setStatus(null);
        setAttempt((value) => value + 1);
    };
    if (status !== null) return <ProfileError status={status} retry={retry} />;
    if (!data)
        return (
            <div role="status" aria-label="Cargando perfil completo del lead">
                <Spin />
                <p>Cargando perfil completo del lead…</p>
            </div>
        );
    return (
        <section className="global-home-dashboard" aria-labelledby="lead-profile-title">
            <header className="global-home-page-header">
                <h1 id="lead-profile-title">Perfil completo del lead</h1>
                <Space wrap>
                    {data.sources.map((source) => (
                        <Tag key={source}>{originLabel[source]}</Tag>
                    ))}
                    <span>Origen principal: {originLabel[data.source]}</span>
                </Space>
            </header>
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {data.sections.map((section) => (
                    <Card key={section.title} title={section.title}>
                        <Descriptions
                            column={{ xs: 1, sm: 2 }}
                            items={section.fields.map((field) => ({
                                key: field.code,
                                label: field.label,
                                children: (
                                    <>
                                        <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{field.value ?? "Sin dato"}</span>
                                        {field.source && <Tag>{originLabel[field.source]}</Tag>}
                                        {field.legacyValue && <Alert type="warning" title={`Valor legacy distinto: ${field.legacyValue}`} />}
                                    </>
                                ),
                            }))}
                        />
                    </Card>
                ))}
                <Card title="Historial">
                    <ul>
                        {data.history.items.map((entry) => (
                            <li key={entry.id}>
                                <Tag>{entry.source === "native" ? "Nuevo" : "Legacy"}</Tag>
                                <strong>{entry.action}</strong> · {entry.sourceDate ?? entry.occurredAt ?? entry.recordedAt ?? "Sin fecha"}
                                <p>{entry.detail}</p>
                                <span>{entry.actorName ?? "Sin actor registrado"}</span>
                            </li>
                        ))}
                    </ul>
                    {data.history.items.length === 0 && <p>Sin historial registrado.</p>}
                    <Space>
                        <Button
                            disabled={!cursor}
                            onClick={() => {
                                setData(null);
                                setCursor(undefined);
                            }}
                        >
                            Volver al inicio del historial
                        </Button>
                        <Button
                            disabled={!data.history.nextCursor}
                            onClick={() => {
                                setData(null);
                                setCursor(data.history.nextCursor ?? undefined);
                            }}
                        >
                            Siguiente página del historial
                        </Button>
                    </Space>
                </Card>
                <Card title="Órdenes de venta">
                    {(["native", "legacy"] as const).map((source) => (
                        <section key={source} aria-label={`Órdenes ${originLabel[source]}`}>
                            <h3>{source === "native" ? "Órdenes nativas" : "Órdenes vinculadas desde legacy"}</h3>
                            {data.orders[source].items.length === 0 ? (
                                <p>Sin órdenes en esta página.</p>
                            ) : (
                                <Descriptions
                                    column={1}
                                    items={data.orders[source].items.map((order) => ({
                                        key: order.id,
                                        label: order.number ?? order.id,
                                        children: (
                                            <>
                                                <Tag>{originLabel[order.source]}</Tag>
                                                {[order.date, order.status, order.currency, order.amount].filter(Boolean).join(" · ")}
                                            </>
                                        ),
                                    }))}
                                />
                            )}
                        </section>
                    ))}
                    <Space>
                        <Button
                            disabled={orderPage === 1}
                            onClick={() => {
                                setData(null);
                                setOrderPage((page) => page - 1);
                            }}
                        >
                            Órdenes anteriores
                        </Button>
                        <span>Página {orderPage}</span>
                        <Button
                            disabled={!data.orders.native.hasMore && !data.orders.legacy.hasMore}
                            onClick={() => {
                                setData(null);
                                setOrderPage((page) => page + 1);
                            }}
                        >
                            Más órdenes
                        </Button>
                    </Space>
                </Card>
            </Space>
        </section>
    );
}

function ProfileError({ status, retry }: { readonly status: number; readonly retry: () => void }) {
    return <Result status={status === 403 ? "403" : "error"} title={errorTitle(status)} subTitle={status >= 500 ? "No fue posible consultar todas las fuentes. Reintenta la consulta." : undefined} extra={status === 403 || status === 404 ? undefined : <Button onClick={retry}>Reintentar</Button>} />;
}

function errorTitle(status: number): string {
    if (status === 403) return "Acceso denegado";
    if (status === 404) return "Lead no encontrado";
    if (status === 409) return "La relación del lead es ambigua";
    if (status === 400) return "Los parámetros del perfil no son válidos";
    return "No fue posible cargar el perfil completo";
}
