import "./FormalizationHomePage.css";

import ArrowLeftOutlined from "@ant-design/icons/ArrowLeftOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import Spin from "antd/es/spin";
import Tooltip from "antd/es/tooltip";
import { useEffect, useRef, useState } from "react";

import type { IdentityRole, IdentityUser } from "../../services/auth/identity-contracts";
import { getApprovalCount } from "../../services/formalization/approval-summary-service";
import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
import { type FormalizationExample, formatOrderTotal, PREVIEW_FILTER_TITLES, type PreviewQueue } from "./formalization-preview.model";
import { FormalizationFollowUpPreview } from "./FormalizationFollowUpPreview";
import { FormalizationHomeInsights } from "./FormalizationHomeInsights";
import { FormalizationOrderPreview } from "./FormalizationOrderPreview";
import { FormalizationPreviewBoundary } from "./FormalizationPreviewSession";
import type { EffectiveNavigationPermission } from "./GlobalHomeShell";
import { useHomeSummary } from "./useHomeSummary";

/** Propiedades de la página; los permisos efectivos deciden qué banners y accesos aparecen. */
interface FormalizationHomeProps {
    readonly roles?: readonly IdentityRole[] | undefined;
    readonly currentUser?: Pick<IdentityUser, "displayName" | "email">;
    readonly effectivePermissions?: readonly EffectiveNavigationPermission[];
    readonly initialView?: "home" | "orders";
    readonly onNavigate?: ((path: string) => void) | undefined;
}

/** Saludo con nombre o correo; sin datos, un saludo genérico. */
const greetingFor = (user: FormalizationHomeProps["currentUser"]) => {
    const name = user?.displayName.trim() || user?.email.trim() || "";
    return name ? `Hola, ${name}` : "Hola";
};

/** Misma esquina, mismo recorte, en la aprobación y en las seis etapas. */
function BannerCorner() {
    return (
        <span className="formalization-banner__pattern" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
                <i key={index} />
            ))}
        </span>
    );
}

/** Deny wins; revocation also removes an already opened approval queue. */
function resolveApprovalVisibility(permissions: readonly EffectiveNavigationPermission[] | undefined, selectedQueue: PreviewQueue | null) {
    const entries = (permissions ?? []).filter((permission) => permission.code === "formalizacion.home.approvals.read");
    const canView = entries.some((permission) => permission.effect === "allow") && !entries.some((permission) => permission.effect === "deny");
    return { canView, queue: selectedQueue?.filter === "approvals" && !canView ? null : selectedQueue };
}

/** Share effect replays within a gated mount; retries and new grants read fresh data. */
function useBannerSummary<T>(load: () => Promise<T>, enabled: boolean, refreshVersion: number) {
    const [value, setValue] = useState<T | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const request = useRef<Promise<T> | null>(null);
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        const read = () => {
            setValue(null);
            setFailed(false);
            request.current ??= load();
            return request.current;
        };
        const pending = read();
        void pending
            .then((result) => {
                if (active) setValue(result);
            })
            .catch(() => {
                if (active) setFailed(true);
            })
            .finally(() => {
                if (request.current === pending) request.current = null;
            });
        return () => {
            active = false;
        };
    }, [load, enabled, attempt, refreshVersion]);
    /** Reintento manual: descarta la petición anterior y fuerza una nueva lectura. */
    const retry = () => {
        request.current = null;
        setValue(null);
        setFailed(false);
        setAttempt((current) => current + 1);
    };
    return { value, failed, retry };
}

/** Banner de aprobaciones pendientes. Si la consulta falla muestra «No disponible», nunca cero. */
function ApprovalStrip({ onOpen, enabled, refreshVersion }: { readonly onOpen: () => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    const { value: count, failed, retry } = useBannerSummary(getApprovalCount, enabled, refreshVersion);
    const caption = failed ? "No disponible" : count === null ? "Consultando…" : "Por revisar";
    const loading = count === null && !failed;
    const action = failed ? { label: "Reintentar pendientes de aprobación", onClick: retry, suffix: " · Reintentar" } : { label: "Ver pendientes de aprobación de Formalización", onClick: onOpen, suffix: "" };
    return (
        <button type="button" className="formalization-banner formalization-banner--pending formalization-approval-strip" aria-label={action.label} aria-busy={loading} onClick={action.onClick}>
            <span className="formalization-banner__icon" aria-hidden="true">
                <img src={`${import.meta.env.BASE_URL}illustrations/formalization-icons/approvals.svg`} width={24} height={24} alt="" />
            </span>
            <span className="formalization-banner__content">
                <span className="formalization-approval-strip__title">Pendientes de aprobación</span>
                <span className="formalization-banner__metrics">
                    <span className="formalization-banner__metric">
                        <span className="formalization-banner__value" aria-live="polite" aria-label={`Órdenes pendientes de aprobación: ${count === null ? caption : String(count)}`}>
                            {loading ? (
                                <span className="formalization-banner__preload" role="status" aria-label="Cargando pendientes de aprobación">
                                    <Spin size="small" />
                                </span>
                            ) : (
                                (count ?? "—")
                            )}
                        </span>
                        <span className="formalization-banner__caption">
                            <span>{caption}</span>
                            {action.suffix}
                        </span>
                    </span>
                </span>
            </span>
            <BannerCorner />
        </button>
    );
}

/** One gated owner supplies every stage banner without sharing data between mounts. */
function StageBanners({ onOpen, enabled, refreshVersion }: { readonly onOpen: (filter: PreviewQueue["filter"]) => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    const { value: summary, failed, retry } = useHomeSummary(enabled, refreshVersion);
    const counts = summary?.counts ?? { contracts: { toSend: 0, pendingSignature: 0 }, banking: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 };
    const loading = !summary && !failed;
    const stages = [
        {
            code: "contracts",
            label: "Contratos pendientes",
            icon: "contracts",
            tone: "pending",
            parts: [
                { label: "Por enviar", value: counts.contracts.toSend, filter: "send" },
                { label: "Pendientes de firma", value: counts.contracts.pendingSignature, filter: "signature" },
            ],
        },
        { code: "bank", label: "Gestión bancaria", icon: "bank", tone: "neutral", parts: [{ label: "Sin iniciar / En proceso", value: counts.banking, filter: "bank" }] },
        { code: "balance", label: "Pendientes de saldo", icon: "balance", tone: "neutral", parts: [{ label: "Consulta financiera", value: counts.balance, filter: "balance" }] },
        { code: "transfer", label: "Traspasos pendientes", icon: "transfer", tone: "pending", parts: [{ label: "Por gestionar", value: counts.transferPending, filter: "transfer" }] },
        { code: "signed", label: "Traspaso firmado", icon: "signed", tone: "success", parts: [{ label: "Firma registrada · Llaves pendientes", value: counts.transferSigned, filter: "signed" }] },
        { code: "closed", label: "Formalizaciones cerradas este año", icon: "closed", tone: "success", parts: [{ label: "Proceso finalizado", value: counts.closedThisYear, filter: "closed" }] },
    ] as const;
    return (
        <>
            {stages.map((banner) => (
                <article key={banner.code} className={`formalization-banner formalization-banner--${banner.tone}`} aria-labelledby={`formalization-${banner.code}`} aria-busy={loading}>
                    <span className="formalization-banner__icon" aria-hidden="true">
                        <img src={`${import.meta.env.BASE_URL}illustrations/formalization-icons/${banner.icon}.svg`} width={24} height={24} alt="" />
                    </span>
                    <div className="formalization-banner__content">
                        <h2 id={`formalization-${banner.code}`}>{banner.label}</h2>
                        {failed && (
                            <div className="formalization-contracts-status formalization-banner__caption">
                                <span role="alert">Sin verificar</span>
                                <Tooltip title={banner.code === "contracts" ? "No se pudieron verificar los conteos de contratos. Reintentar consulta." : `No se pudo verificar ${banner.label}. Reintentar consulta.`}>
                                    <Button type="text" size="small" icon={<ReloadOutlined />} aria-label={banner.code === "contracts" ? "Reintentar conteos de contratos" : `Reintentar ${banner.label}`} onClick={retry} />
                                </Tooltip>
                            </div>
                        )}
                        <div className="formalization-banner__metrics">
                            {banner.parts.map((part) => (
                                <button
                                    key={part.filter}
                                    type="button"
                                    className="formalization-banner__metric formalization-banner__metric-button"
                                    aria-label={`Abrir ${part.label}`}
                                    onClick={() => {
                                        onOpen(part.filter);
                                    }}
                                >
                                    <span className="formalization-banner__value" aria-live="polite" aria-label={summary ? `Valor: ${part.label}, ${String(part.value)}` : failed ? `${part.label}: sin verificar` : undefined}>
                                        {loading ? (
                                            <span className="formalization-banner__preload" role="status" aria-label={`Cargando ${part.label}`}>
                                                <Spin size="small" />
                                            </span>
                                        ) : (
                                            part.value
                                        )}
                                    </span>
                                    <span className="formalization-banner__caption">{part.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <BannerCorner />
                </article>
            ))}
        </>
    );
}

/** Título de la cola, con el proyecto cuando está filtrada. */
const getQueueTitle = (queue: PreviewQueue) => `${PREVIEW_FILTER_TITLES[queue.filter]}${queue.project ? ` · ${queue.project}` : ""}`;

/** Encabezado de la lista filtrada con la anatomía de Proyectos: ruta, título, total y acciones. */
function QueueHeader({ queue, onHome, onAll }: { readonly queue: PreviewQueue; readonly onHome: () => void; readonly onAll: () => void }) {
    const showAll = queue.filter !== "all" || queue.project !== undefined;
    return (
        <>
            <Button className="formalization-back" type="text" aria-label="Volver a Inicio" icon={<ArrowLeftOutlined />} onClick={onHome}>
                Volver a Inicio
            </Button>
            <header className="global-home-page-header formalization-page-header">
                <div>
                    <nav className="formalization-breadcrumb" aria-label="Ruta">
                        <span>Formalización</span>
                        <span aria-hidden="true">/</span>
                        <span>Órdenes de venta</span>
                    </nav>
                    <div className="formalization-title-row">
                        <h1
                            tabIndex={-1}
                            ref={(node) => {
                                node?.focus();
                            }}
                        >
                            {getQueueTitle(queue)}
                        </h1>
                        <span className="formalization-total">{formatOrderTotal(0)}</span>
                    </div>
                </div>
                {showAll && (
                    <div className="global-home-page-header__actions">
                        <Button className="formalization-command" onClick={onAll}>
                            Todas las órdenes
                        </Button>
                    </div>
                )}
            </header>
        </>
    );
}

/** Use only effective API roles and grants; Owner never bypasses a direct deny. */
function canReadFormalizationStages(roles: FormalizationHomeProps["roles"], permissions: FormalizationHomeProps["effectivePermissions"]) {
    const entries = (permissions ?? []).filter((permission) => permission.code === "formalizacion.home.stages.read");
    return roles?.some((role) => role.code === "formalizacion" && role.status === "active") === true && entries.some((permission) => permission.effect === "allow") && !entries.some((permission) => permission.effect === "deny");
}

/** Gate the consumer itself so revoked access cannot retain data or start a request. */
function FormalizationStageBanners({ canView, onOpen, enabled, refreshVersion }: { readonly canView: boolean; readonly onOpen: (filter: PreviewQueue["filter"]) => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    return canView ? <StageBanners onOpen={onOpen} enabled={enabled} refreshVersion={refreshVersion} /> : null;
}

/** Hidden previews never initiate stage-summary reads. */
const isHomeSummaryEnabled = (view: "home" | "orders", queue: PreviewQueue | null, selected: FormalizationExample | null) => view === "home" && queue === null && selected === null;

/** Cabecera de la página; el botón de refrescar solo existe si hay algún banner visible por permisos. */
function FormalizationHomeTitle({ canViewStages, canViewApprovals, onRefresh }: { readonly canViewStages: boolean; readonly canViewApprovals: boolean; readonly onRefresh: () => void }) {
    const canRefresh = canViewApprovals || canViewStages;
    return (
        <div className="formalization-home__titlebar">
            <h1 id="formalization-home-title">Formalización</h1>
            {canRefresh && (
                <Tooltip title="Recargar banners">
                    <Button className="formalization-command formalization-home__reload" icon={<ReloadOutlined />} aria-label="Recargar banners" onClick={onRefresh} />
                </Tooltip>
            )}
        </div>
    );
}

/** Real Home aggregates; follow-up awaits its canonical source. */
function FormalizationHomeContent({ currentUser, roles, effectivePermissions, initialView = "home", onNavigate }: FormalizationHomeProps) {
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [selectedQueue, setQueue] = useState<PreviewQueue | null>(() => (initialView === "orders" ? { filter: "all" } : null));
    const { canView: canViewApprovals, queue } = resolveApprovalVisibility(effectivePermissions, selectedQueue);
    const canViewStages = canReadFormalizationStages(roles, effectivePermissions);
    const [selected, setSelected] = useState<FormalizationExample | null>(null);
    return (
        <ConfigProvider locale={esES} theme={PROJECTS_THEME}>
            <div className="global-home-dashboard formalization-home">
                {selected && (
                    <FormalizationOrderPreview
                        order={selected}
                        onNavigate={onNavigate}
                        onBack={() => {
                            setSelected(null);
                        }}
                    />
                )}
                <div hidden={selected !== null || queue !== null}>
                    <section className="global-home-page-header formalization-home__header" aria-labelledby="formalization-home-title">
                        <FormalizationHomeTitle
                            canViewStages={canViewStages}
                            canViewApprovals={canViewApprovals}
                            onRefresh={() => {
                                setRefreshVersion((value) => value + 1);
                            }}
                        />
                        <div className="formalization-home__intro" data-has-approvals={canViewApprovals}>
                            {canViewApprovals && (
                                <ApprovalStrip
                                    enabled={initialView === "home"}
                                    refreshVersion={refreshVersion}
                                    onOpen={() => {
                                        setQueue({ filter: "approvals" });
                                    }}
                                />
                            )}
                            <section className="formalization-welcome" aria-label="Bienvenida a Formalización">
                                <div className="formalization-welcome__copy">
                                    <p className="formalization-welcome__title">{greetingFor(currentUser)}</p>
                                    <p className="formalization-welcome__text">Gestión contractual</p>
                                    <Button
                                        className="formalization-command"
                                        onClick={() => {
                                            setQueue({ filter: "all" });
                                        }}
                                    >
                                        Ver todas las órdenes
                                    </Button>
                                </div>
                                <img className="formalization-welcome__art" src={`${import.meta.env.BASE_URL}illustrations/rocca-formalization-generated.png`} alt="" width={1754} height={897} decoding="async" />
                            </section>
                        </div>
                    </section>
                    <section className="formalization-home__banners" aria-label="Resumen de formalización">
                        <FormalizationStageBanners
                            refreshVersion={refreshVersion}
                            enabled={isHomeSummaryEnabled(initialView, queue, selected)}
                            canView={canViewStages}
                            onOpen={(filter) => {
                                setQueue({ filter });
                            }}
                        />
                    </section>
                    <div className="formalization-workspace">
                        <FormalizationFollowUpPreview canViewApprovals={canViewApprovals} tableOnly={false} scope={{ filter: "all" }} onOpenOrder={setSelected} />
                        <FormalizationHomeInsights />
                    </div>
                </div>
                <div className="formalization-workspace" hidden={selected !== null || queue === null}>
                    {queue && (
                        <>
                            <QueueHeader
                                queue={queue}
                                onHome={() => {
                                    if (initialView === "orders" && onNavigate) {
                                        onNavigate("/home/formalization");
                                        return;
                                    }
                                    setQueue(null);
                                }}
                                onAll={() => {
                                    setQueue({ filter: "all" });
                                }}
                            />
                            <FormalizationFollowUpPreview canViewApprovals={canViewApprovals} key={`${queue.filter}-${queue.project ?? "all"}`} tableOnly scope={queue} onOpenOrder={setSelected} />
                        </>
                    )}
                </div>
            </div>
        </ConfigProvider>
    );
}

/** Only Home summaries use canonical APIs; queues retain their existing empty previews. */
export function FormalizationHomePage(props: FormalizationHomeProps) {
    return (
        <FormalizationPreviewBoundary>
            <FormalizationHomeContent {...props} />
        </FormalizationPreviewBoundary>
    );
}
