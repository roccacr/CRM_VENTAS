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
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
import { type FormalizationExample, PREVIEW_FILTER_TITLES, type PreviewQueue } from "./formalization-preview.model";
import { canReadFormalizationOrder, formalizationReadQueues } from "./formalization-read-policy";
import { FormalizationFollowUpPreview } from "./FormalizationFollowUpPreview";
import { FormalizationHomeInsights } from "./FormalizationHomeInsights";
import { FormalizationOrderPreview, FormalizationOrderRecord } from "./FormalizationOrderPreview";
import { FormalizationPreviewBoundary } from "./FormalizationPreviewSession";
import { FormalizationRecordLoading } from "./FormalizationRecordLoading";
import type { EffectiveNavigationPermission } from "./GlobalHomeShell";
import { useHomeSummary } from "./useHomeSummary";
import { useNetsuiteOrderConsole } from "./useNetsuiteOrderConsole";
import { useRestoredFormalizationOrder } from "./useRestoredFormalizationOrder";

/** Propiedades de la página; los permisos efectivos deciden qué banners y accesos aparecen. */
interface FormalizationHomeProps {
    readonly roles?: readonly IdentityRole[] | undefined;
    readonly currentUser?: Pick<IdentityUser, "displayName" | "email">;
    readonly effectivePermissions?: readonly EffectiveNavigationPermission[];
    readonly initialView?: "home" | "orders";
    readonly onNavigate?: ((path: string) => void) | undefined;
}

/** Nombre de quien actúa, para los movimientos recientes. */
const actorNameOf = (user: FormalizationHomeProps["currentUser"]) => user?.displayName ?? "";

/** Saludo con nombre o correo; sin datos, un saludo genérico. */
const greetingFor = (user: FormalizationHomeProps["currentUser"]) => {
    const name = user?.displayName.trim() || user?.email.trim() || "";
    return name ? `Hola, ${name}` : "Hola";
};

/** Patrón original de cuadrados; decorativo y fuera del árbol accesible. */
function BannerCorner() {
    return (
        <span className="formalization-banner__pattern" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
                <i key={index} />
            ))}
        </span>
    );
}

/** Preserve the empty list shell while refusing a revoked category queue. */
function visibleQueue(selected: PreviewQueue | null, allowedQueues: readonly string[]): PreviewQueue | null {
    if (!selected || selected.filter === "all" || allowedQueues.includes(selected.filter)) return selected;
    return null;
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
function StageBanners({ onOpen, enabled, refreshVersion, allowedQueues }: { readonly allowedQueues: readonly string[]; readonly onOpen: (filter: PreviewQueue["filter"]) => void; readonly enabled: boolean; readonly refreshVersion: number }) {
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
            {stages
                .filter((banner) => allowedQueues.includes(banner.parts[0].filter))
                .map((banner) => (
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
                    </div>
                    <p className="formalization-page-header__subtitle">Seguimiento de cada orden de venta por etapa, proyecto y bandeja.</p>
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

function canUpdateOrderStage(roles: FormalizationHomeProps["roles"], permissions: FormalizationHomeProps["effectivePermissions"]): boolean {
    const entries = (permissions ?? []).filter((entry) => entry.code === "formalizacion.orders.stage.update");
    return roles?.some((role) => ["formalizacion", "jefe_formalizaciones"].includes(role.code) && role.status === "active") === true && entries.some((entry) => entry.effect === "allow") && !entries.some((entry) => entry.effect === "deny");
}

/** Gate the consumer itself so revoked access cannot retain data or start a request. */
function FormalizationStageBanners({ canView, onOpen, enabled, refreshVersion, allowedQueues }: { readonly allowedQueues: readonly string[]; readonly canView: boolean; readonly onOpen: (filter: PreviewQueue["filter"]) => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    return canView ? <StageBanners allowedQueues={allowedQueues} onOpen={onOpen} enabled={enabled} refreshVersion={refreshVersion} /> : null;
}

/** Hidden previews never initiate stage-summary reads. */
const isHomeSummaryEnabled = (view: "home" | "orders", queue: PreviewQueue | null, selected: FormalizationExample | null) => view === "home" && queue === null && selected === null;

/** Cabecera de la página; el botón de refrescar solo existe si hay algún banner visible por permisos. */
function FormalizationHomeTitle({ canViewStages, canViewApprovals, onRefresh }: { readonly canViewStages: boolean; readonly canViewApprovals: boolean; readonly onRefresh: () => void }) {
    const canRefresh = canViewApprovals || canViewStages;
    return (
        <div className="formalization-home__titlebar">
            <div>
                <h1 id="formalization-home-title">Formalización</h1>
                <p className="formalization-home__subtitle">En qué etapa está cada orden de venta y qué necesita seguimiento.</p>
            </div>
            {canRefresh && (
                <Tooltip title="Recargar banners">
                    <Button className="formalization-command formalization-home__reload" icon={<ReloadOutlined />} aria-label="Recargar banners" onClick={onRefresh} />
                </Tooltip>
            )}
        </div>
    );
}

function VisibleHomeFollowUp({ visible, ...props }: React.ComponentProps<typeof FormalizationFollowUpPreview> & { readonly visible: boolean }) {
    return visible ? <FormalizationFollowUpPreview {...props} /> : null;
}

function activitySessionKey(user: FormalizationHomeProps["currentUser"]) {
    return user?.email ?? "session";
}

/** Gated canonical Home aggregates and follow-up; stage updates require their own effective permission. */
function FormalizationHomeContent({ currentUser, roles, effectivePermissions, initialView = "home", onNavigate }: FormalizationHomeProps) {
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [selectedQueue, setQueue] = useState<PreviewQueue | null>(() => (initialView === "orders" ? { filter: "all" } : null));
    const allowedQueues = formalizationReadQueues(roles, effectivePermissions);
    const canViewApprovals = allowedQueues.includes("approvals");
    const queue = visibleQueue(selectedQueue, allowedQueues);
    const canViewStages = allowedQueues.some((queue) => queue !== "all" && queue !== "approvals");
    const canReadList = allowedQueues.length > 0;
    const canReadOrders = canReadFormalizationOrder(roles, effectivePermissions);
    const canUpdateStage = canUpdateOrderStage(roles, effectivePermissions);
    const refreshOrders = () => {
        setRefreshVersion((value) => value + 1);
    };
    const [selected, setSelected] = useState<FormalizationExample | null>(null);
    const [record, setRecord] = useState<FollowUpItem | null>(null);
    const [recordRefreshVersion, setRecordRefreshVersion] = useState(0);
    const [restoreDismissed, setRestoreDismissed] = useState(false);
    const restoreStatus = useRestoredFormalizationOrder([canReadOrders, [!restoreDismissed, record !== null].some(Boolean)].every(Boolean), setRecord, { record, refreshVersion: recordRefreshVersion });
    const restoredStatus = dismissedRestoreStatus(restoreDismissed, record, restoreStatus);
    const netsuiteRead = useNetsuiteOrderConsole(record, [canReadOrders, record !== null].every(Boolean), recordRefreshVersion);
    const restoring = [!record, !["idle", "ready"].includes(restoredStatus)].every(Boolean);
    const detailOpen = [record, selected, restoring].some(Boolean);
    return (
        <ConfigProvider locale={esES} theme={PROJECTS_THEME}>
            <div className="global-home-dashboard formalization-home">
                <RestoringOrder
                    visible={restoring}
                    status={restoredStatus}
                    onRetry={() => {
                        setRecordRefreshVersion((version) => version + 1);
                    }}
                    onBack={() => {
                        setRestoreDismissed(true);
                        const url = new URL(window.location.href);
                        url.searchParams.delete("orderSource");
                        url.searchParams.delete("orderId");
                        window.history.replaceState(null, "", url);
                    }}
                />
                <CurrentFormalizationRecord
                    stagePermissions={effectivePermissions}
                    canUpdateStage={canUpdateStage}
                    onStageSaved={(updated) => {
                        setRecord(updated);
                        refreshOrders();
                    }}
                    item={record}
                    netsuiteStatus={recordReadStatus(restoredStatus, netsuiteRead.status)}
                    netsuiteErrorMessage={netsuiteRead.errorMessage}
                    primary={netsuiteRead.primary}
                    onRefresh={() => {
                        setRecordRefreshVersion((version) => version + 1);
                        refreshOrders();
                    }}
                    canView={canReadOrders}
                    onBack={() => {
                        setRecord(null);
                    }}
                />
                {selected && (
                    <FormalizationOrderPreview
                        order={selected}
                        onNavigate={onNavigate}
                        onBack={() => {
                            setSelected(null);
                        }}
                    />
                )}
                <div hidden={detailOpen || queue !== null}>
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
                                    enabled={isHomeSummaryEnabled(initialView, queue, selected)}
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
                            allowedQueues={allowedQueues}
                            refreshVersion={refreshVersion}
                            enabled={isHomeSummaryEnabled(initialView, queue, selected)}
                            canView={canViewStages}
                            onOpen={(filter) => {
                                setQueue({ filter });
                            }}
                        />
                    </section>
                    <div className="formalization-workspace">
                        <VisibleHomeFollowUp allowedQueues={allowedQueues} stagePermissions={effectivePermissions} onOpenRecord={setRecord} canUpdateStage={canUpdateStage} onRefresh={refreshOrders} visible={isHomeSummaryEnabled(initialView, queue, selected)} enabled={canReadList} canReadOrder={canReadOrders} refreshVersion={refreshVersion} canViewApprovals={canViewApprovals} tableOnly={false} scope={{ filter: "all" }} onOpenOrder={setSelected} />
                        <FormalizationHomeInsights key={activitySessionKey(currentUser)} enabled={canReadOrders} visible={[initialView === "home", !detailOpen, queue === null].every(Boolean)} refreshVersion={refreshVersion} actorName={actorNameOf(currentUser)} />
                    </div>
                </div>
                <div className="formalization-workspace" hidden={detailOpen || queue === null}>
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
                            <FormalizationFollowUpPreview allowedQueues={allowedQueues} stagePermissions={effectivePermissions} onOpenRecord={setRecord} canUpdateStage={canUpdateStage} onRefresh={refreshOrders} enabled={canReadList} canReadOrder={canReadOrders} refreshVersion={refreshVersion} canViewApprovals={canViewApprovals} key={`${queue.filter}-${queue.project ?? "all"}`} tableOnly scope={queue} onOpenOrder={setSelected} />
                        </>
                    )}
                </div>
            </div>
        </ConfigProvider>
    );
}

/** Permission-set changes unmount every read consumer, clearing open records and pending results before paint. */
export function FormalizationHomePage(props: FormalizationHomeProps) {
    return (
        <FormalizationPreviewBoundary>
            <FormalizationHomeContent key={JSON.stringify([formalizationReadQueues(props.roles, props.effectivePermissions), canReadFormalizationOrder(props.roles, props.effectivePermissions), props.effectivePermissions?.filter((permission) => permission.code === "formalizacion.orders.read")])} {...props} />
        </FormalizationPreviewBoundary>
    );
}

/** Reading the real record stays inside the same effective module/permission gate as its list. */
function CurrentFormalizationRecord({ item, canView, ...props }: Omit<React.ComponentProps<typeof FormalizationOrderRecord>, "item"> & { readonly item: FollowUpItem | null; readonly canView: boolean }) {
    if (!canView || !item) return null;
    return <FormalizationOrderRecord item={item} {...props} />;
}

function RestoringOrder({ visible, status, onRetry, onBack }: { readonly visible: boolean; readonly status: string; readonly onRetry: () => void; readonly onBack: () => void }) {
    if (!visible) return null;
    if (status === "loading") return <FormalizationRecordLoading complete />;
    const messages: Record<string, string> = { loading: "Validando acceso y cargando la orden…", denied: "No tienes acceso a esta orden de venta.", missing: "Orden no disponible.", error: "No fue posible cargar la orden. Actualiza para reintentar." };
    return (
        <section className="formalization-card formalization-record-loading" role="status">
            {messages[status]}
            <Button onClick={onRetry}>Reintentar carga de orden</Button>
            <Button onClick={onBack}>Volver a Formalización</Button>
        </section>
    );
}

/** Stale highlights must stay hidden if their own database refresh fails or is pending. */
function recordReadStatus(databaseStatus: string, providerStatus: "idle" | "loading" | "success" | "error"): "idle" | "loading" | "success" | "error" {
    if (databaseStatus === "loading") return "loading";
    if (["denied", "missing", "error"].includes(databaseStatus)) return "error";
    return providerStatus;
}

function dismissedRestoreStatus(dismissed: boolean, record: FollowUpItem | null, status: string): string {
    return dismissed && !record ? "idle" : status;
}
