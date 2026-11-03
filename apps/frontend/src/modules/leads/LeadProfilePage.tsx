import "./LeadProfilePage.css";

import Button from "antd/es/button";
import Result from "antd/es/result";
import Skeleton from "antd/es/skeleton";
import { useEffect, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import type { IdentityProfile } from "../../services/auth/identity-contracts";
import { canReadLeadProfile, getLeadProfile, type LeadIdentity, type LeadProfileResult, readLeadIdentity } from "../../services/leads/lead-profile-service";
import { fieldValue, isProfileTab, profileEvents, profileOrders, type ProfileTab, stampParts } from "./lead-profile-model";
import { LeadProfileActions } from "./LeadProfileActions";
import { LeadProfileCommercial } from "./LeadProfileCommercial";
import { LeadProfileEvents } from "./LeadProfileEvents";
import { LeadProfileHero, type ProfileStat } from "./LeadProfileHero";
import { LeadProfileHistory } from "./LeadProfileHistory";
import { LeadProfileOrders } from "./LeadProfileOrders";
import { ConsolidatedPanel } from "./LeadProfilePanels";
import { EventsPrepared, FilesPrepared } from "./LeadProfilePrepared";
import { LeadProfileSidebar } from "./LeadProfileSidebar";
import { LeadProfileTabs } from "./LeadProfileTabs";

/** La página valida también permisos para impedir lecturas si se monta fuera del router. */
export function LeadProfilePage({ effectivePermissions = [] }: { readonly effectivePermissions?: IdentityProfile["permissions"] }) {
    if (!canReadLeadProfile(effectivePermissions)) return <Result status="403" title="Acceso denegado" subTitle="No tienes permiso para ver el perfil completo del lead." />;
    const identity = readLeadIdentity(window.location.search);
    if (!identity) return <Result status="404" title="Lead no encontrado" subTitle="El identificador o el origen de la dirección no es válido." />;
    return <ProfileContent key={`${identity.source}:${identity.id}`} identity={identity} permissions={effectivePermissions} />;
}

interface Loaded {
    readonly key: string;
    readonly result: LeadProfileResult;
}
const initialTab = (): ProfileTab => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return isProfileTab(tab) ? tab : "log";
};
/** The chosen section lives in the address (?tab=) so a link opens it; it replaces the entry instead of adding history. */
function rememberTab(tab: ProfileTab) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url);
}

/** Data comes from the same single read as before; the sections only decide how it is shown. Paging keeps the page on screen and refreshes just the section. */
function useLeadProfile({ source, id }: LeadIdentity) {
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [status, setStatus] = useState<number | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [cursor, setCursor] = useState<string | undefined>();
    const [orderPage, setOrderPage] = useState(1);
    const key = `${cursor ?? ""}:${String(orderPage)}:${String(attempt)}`;
    useEffect(() => {
        let active = true;
        void getLeadProfile({ source, id }, cursor, orderPage).then(
            (result) => {
                if (active) {
                    setLoaded({ key, result });
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
    }, [source, id, cursor, orderPage, attempt, key]);
    const reload = () => {
        setStatus(null);
        setAttempt((value) => value + 1);
    };
    return { data: loaded?.result ?? null, status, refreshing: loaded !== null && loaded.key !== key && status === null, cursor, setCursor, orderPage, setOrderPage, reload };
}

interface PanelProps {
    readonly tab: ProfileTab;
    readonly data: LeadProfileResult;
    readonly profile: ReturnType<typeof useLeadProfile>;
}
/** The section the person chose; each one only needs the part of the read that belongs to it. */
function ProfilePanel({ tab, data, profile }: PanelProps) {
    const history = {
        history: data.history,
        refreshing: profile.refreshing,
        atStart: !profile.cursor,
        onFirst: () => {
            profile.setCursor(undefined);
        },
        onNext: () => {
            profile.setCursor(data.history.nextCursor ?? undefined);
        },
    };
    if (tab === "events") return data.events ? <LeadProfileEvents events={data.events} page={profile.orderPage} refreshing={profile.refreshing} onPage={profile.setOrderPage} /> : <EventsPrepared />;
    if (tab === "files") return <FilesPrepared />;
    if (tab === "info") return <ConsolidatedPanel data={data} />;
    if (tab === "orders") return <LeadProfileOrders orders={data.orders} page={profile.orderPage} refreshing={profile.refreshing} onPage={profile.setOrderPage} />;
    if (tab === "opportunities") return <LeadProfileCommercial title="Oportunidades" data={data.opportunities} refreshing={profile.refreshing} onPage={profile.setOrderPage} />;
    if (tab === "estimates") return <LeadProfileCommercial title="Estimaciones" data={data.estimates} refreshing={profile.refreshing} onPage={profile.setOrderPage} />;
    return <LeadProfileHistory {...history} />;
}
const more = (data: LeadProfileResult) => (data.history.hasMore ? "+" : "");
const tabCounts = (data: LeadProfileResult): Partial<Record<ProfileTab, string>> => {
    const orders = profileOrders(data.orders, "all").length;
    const count = (kind: "opportunities" | "estimates") => (data[kind]?.available ? String(data[kind].total) : "—");
    return { log: `${String(data.history.items.length)}${more(data)}`, events: data.events ? String(profileEvents(data.events, "all").length) : "—", opportunities: count("opportunities"), estimates: count("estimates"), orders: orders > 0 ? String(orders) : "" };
};

/** Figures shown under the name; each opens the section it comes from. */
function profileStats(data: LeadProfileResult, counts: Partial<Record<ProfileTab, string>>): ProfileStat[] {
    const since = stampParts(fieldValue(data.sections, "createdAt")).date;
    return [
        { id: "log", label: "Registros en bitácora", value: counts.log ?? "0", tab: "log" },
        { id: "events", label: "Eventos", value: counts.events ?? "—", tab: "events" },
        { id: "opportunities", label: "Oportunidades", value: counts.opportunities ?? "0", tab: "opportunities" },
        { id: "estimates", label: "Estimaciones", value: counts.estimates ?? "0", tab: "estimates" },
        { id: "orders", label: "Órdenes vinculadas", value: counts.orders || "0", tab: "orders" },
        { id: "since", label: "Cliente desde", value: since || "—", tab: "info" },
    ];
}

function ProfileContent({ identity, permissions }: { readonly identity: LeadIdentity; readonly permissions: IdentityProfile["permissions"] }) {
    const profile = useLeadProfile(identity);
    const [tab, setTab] = useState<ProfileTab>(initialTab);
    const { data } = profile;
    if (profile.status !== null) return <ProfileError status={profile.status} retry={profile.reload} />;
    if (!data) return <ProfileLoading />;
    const choose = (next: ProfileTab) => {
        if (tab !== next) profile.setOrderPage(1);
        setTab(next);
        rememberTab(next);
    };
    const counts = tabCounts(data);
    return (
        <section className="global-home-dashboard lead-profile" aria-labelledby="lead-profile-title">
            <header className="global-home-page-header">
                <div>
                    <p className="global-home-page-header__eyebrow">Formalización / Perfil del cliente</p>
                    <h1 id="lead-profile-title">Perfil del cliente</h1>
                    <p>Información consolidada, seguimiento y órdenes vinculadas.</p>
                </div>
            </header>
            <LeadProfileHero data={data} name={fieldValue(data.sections, "fullName") ?? "Cliente sin nombre registrado"} stats={profileStats(data, counts)} onStat={choose} actions={<LeadProfileActions data={data} permissions={permissions} refreshing={profile.refreshing} onRefresh={profile.reload} />}>
                <LeadProfileTabs active={tab} counts={{}} onChange={choose} />
            </LeadProfileHero>
            <div className="profile-layout">
                <div className="profile-panel" role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`} tabIndex={0}>
                    <ProfilePanel tab={tab} data={data} profile={profile} />
                </div>
                <LeadProfileSidebar data={data} onOpenTab={choose} />
            </div>
        </section>
    );
}

/** La estructura anticipa el contenido sin mostrar datos ficticios ni bloquear el resto del sistema. */
function ProfileLoading() {
    return (
        <section className="global-home-dashboard lead-profile" role="status" aria-busy="true" aria-label="Cargando perfil completo del lead">
            <header className="global-home-page-header">
                <div>
                    <p className="global-home-page-header__eyebrow">Formalización · Perfil del cliente</p>
                    <h1>Preparando el perfil del cliente</h1>
                    <p>Estamos reuniendo su información. El perfil aparecerá en esta misma página.</p>
                </div>
            </header>
            <div className="profile-hero-card" aria-hidden="true">
                <div className="profile-cover" />
                <div className="profile-hero__body">
                    <Skeleton.Avatar active size={92} style={{ marginTop: -46 }} />
                    <Skeleton title={{ width: "34%" }} paragraph={{ rows: 2, width: ["52%", "40%"] }} active />
                </div>
                <div className="profile-tabs profile-tabs--loading">
                    {[150, 130, 120, 120, 150, 130, 90].map((width) => (
                        <Skeleton.Button key={width} active size="small" style={{ width }} />
                    ))}
                </div>
            </div>
            <div className="profile-layout" aria-hidden="true">
                <div className="profile-card">
                    <div className="profile-card__head">
                        <h2>Bitácora de seguimiento</h2>
                    </div>
                    <div className="profile-card__body">
                        <Skeleton title={false} paragraph={{ rows: 4, width: ["70%", "90%", "55%", "80%"] }} active />
                    </div>
                </div>
                <div className="profile-side-card">
                    <header>
                        <h2>Contacto</h2>
                    </header>
                    <div className="profile-card__body">
                        <Skeleton title={false} paragraph={{ rows: 3 }} active />
                    </div>
                </div>
            </div>
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
