import "./FormalizationHomePage.css";

import ArrowLeftOutlined from "@ant-design/icons/ArrowLeftOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import Spin from "antd/es/spin";
import Tooltip from "antd/es/tooltip";
import { useEffect, useRef, useState } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import type { IdentityRole, IdentityUser } from "../../services/auth/identity-contracts";
import { getApprovalCount } from "../../services/formalization/approval-summary-service";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getPendingAddendumCount } from "../../services/formalization/order-addendum-service";
import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
import type { FollowUpFilterRequest, FollowUpSelection } from "./formalization-filter-preferences";
import { type FormalizationExample, PREVIEW_FILTER_TITLES, type PreviewQueue } from "./formalization-preview.model";
import { FORMALIZATION_QUEUE_HELP } from "./formalization-queue-help";
import { canReadAddendumBanner, canReadFormalizationOrder, formalizationReadQueues } from "./formalization-read-policy";
import { FormalizationFollowUpPreview } from "./FormalizationFollowUpPreview";
import { FormalizationHomeInsights } from "./FormalizationHomeInsights";
import { FormalizationOrderPreview, FormalizationOrderRecord } from "./FormalizationOrderPreview";
import { FormalizationPreviewBoundary } from "./FormalizationPreviewSession";
import { FormalizationProjectDistribution } from "./FormalizationProjectDistribution";
import { FormalizationRecordLoading } from "./FormalizationRecordLoading";
import type { EffectiveNavigationPermission } from "./GlobalHomeShell";
import { canReadOrderAddendum } from "./order-addendum-permissions";
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

const BANNER_PLAN_PATHS = {
    approvals: "M25 15h28v34H25zM33 15v-4h12v4M31 26h15m-15 7h15m-15 7 4 4 8-8",
    addendum: "M21 22h27v29H21zM28 15h27v29M27 29h14m-14 6h14m-7 4v8m-4-4h8",
    contracts: "M24 12h20l10 10v28H24zm20 0v10h10M30 27h17m-17 6h17m-17 10 4-4 4 4 5-2h5",
    bank: "m19 24 20-12 20 12zM22 47h34m-31-4h28m-25-16v16m7-16v16m8-16v16m7-16v16",
    balance: "M23 13h31v36H23zm5 6h21v8H28zm0 14h4m5 0h4m5 0h4m-22 6h4m5 0h4m5 0h4m-22 6h4m5 0h4m5 0h4",
    transfer: "M22 18h31m-6-6 6 6-6 6M54 36H23m6-6-6 6 6 6",
    signed: "M24 12h22l8 8v30H24zm22 0v8h8M30 25h16m-16 6h13m-12 9 5 5 11-11",
    closed: "M22 27h33v22H22zm-3 0 19-14 20 14M32 38l5 5 9-10",
};

/** El motivo de plano acompaña la etapa y queda fuera del árbol accesible. */
function BannerCorner({ kind }: { readonly kind: keyof typeof BANNER_PLAN_PATHS }) {
    return (
        <svg className="formalization-banner__pattern" viewBox="0 0 180 84" preserveAspectRatio="xMaxYMin slice" fill="none" stroke="currentColor" aria-hidden="true" focusable="false">
            <path opacity=".38" d="M0 12h180M0 28h180M0 44h180M0 60h180M0 76h180M20 0v84M42 0v84M64 0v84M86 0v84M108 0v84M130 0v84M152 0v84M174 0v84" />
            <path opacity=".62" d="M12 62h40l20-18h46m-54 8v18h35m-23-50h32l10-8h54m-12-4v8m-42-8v8m-33 40h75m-52-4v8m28-8v8m24-8v8" />
            <path d={BANNER_PLAN_PATHS[kind]} transform="translate(112 2)" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

/** Conserva el cascarón vacío de la lista mientras rechaza una cola cuya categoría fue revocada. */
function visibleQueue(selected: PreviewQueue | null, allowedQueues: readonly string[]): PreviewQueue | null {
    if (!selected || selected.filter === "all" || allowedQueues.includes(selected.filter)) return selected;
    return null;
}

/** Las repeticiones del efecto se comparten dentro del montaje autorizado. Un reintento o un permiso nuevo leen datos frescos. */
function useBannerSummary<T>(load: () => Promise<T>, enabled: boolean, refreshVersion: number) {
    const [value, setValue] = useState<T | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const request = useRef<{ key: string; promise: Promise<T> } | null>(null);
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        const read = () => {
            setValue(null);
            setFailed(false);
            const key = `${String(attempt)}:${String(refreshVersion)}`;
            if (request.current?.key !== key) request.current = { key, promise: load() };
            return request.current.promise;
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
                if (request.current?.promise === pending) request.current = null;
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

const pendingBanners = {
    approvals: { title: "Pendientes de aprobación", subject: "aprobación", load: getApprovalCount },
    addendum: { title: "Pendientes de adéndum", subject: "adéndum", load: getPendingAddendumCount },
};

/** Los pendientes comparten presentación; cada fuente y permiso conserva su consulta independiente. */
function PendingStrip({ kind, canOpen = true, onOpen, enabled, refreshVersion }: { readonly kind: "approvals" | "addendum"; readonly canOpen?: boolean; readonly onOpen: () => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    const { title, subject, load } = pendingBanners[kind];
    const { value: count, failed, retry } = useBannerSummary(load, enabled, refreshVersion);
    const caption = failed ? "No disponible" : count === null ? "Consultando…" : "Por revisar";
    const loading = [count === null, !failed].every(Boolean);
    const action = failed ? { label: `Reintentar pendientes de ${subject}`, onClick: retry, suffix: " · Reintentar" } : { label: `Ver pendientes de ${subject} de Formalización`, onClick: onOpen, suffix: "" };
    return (
        <div className="formalization-banner formalization-banner--pending formalization-approval-strip" data-kind={kind} aria-busy={loading}>
            <button type="button" className="formalization-approval-strip__action" aria-label={action.label} aria-busy={loading} disabled={[!failed, !canOpen].every(Boolean)} onClick={action.onClick} />
            <span className="formalization-banner__content">
                <span className="formalization-title-help">
                    <span className="formalization-approval-strip__title">{title}</span>
                    <FormHelp label={`Condiciones de ${title}`} text={FORMALIZATION_QUEUE_HELP[kind]} />
                </span>
                <span className="formalization-banner__metrics">
                    <span className="formalization-banner__metric">
                        <span className="formalization-banner__value" aria-live="polite" aria-label={`Órdenes pendientes de ${subject}: ${count === null ? caption : String(count)}`}>
                            {loading ? (
                                <span className="formalization-banner__preload" role="status" aria-label={`Cargando pendientes de ${subject}`}>
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
            <BannerCorner kind={kind} />
        </div>
    );
}

/** Un solo dueño autorizado alimenta cada banner de etapa. Los montajes no comparten datos. */
function StageBanners({ onOpen, enabled, refreshVersion, allowedQueues }: { readonly allowedQueues: readonly string[]; readonly onOpen: (filter: FollowUpSelection) => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    const { value: summary, failed, retry } = useHomeSummary(enabled, refreshVersion);
    const counts = summary?.counts ?? { contracts: { toSend: undefined, pendingSignature: undefined }, banking: undefined, bankingInProgress: undefined, balance: undefined, transferPending: undefined, transferSigned: undefined, closedThisYear: undefined };
    const loading = !summary && !failed;
    const stages = [
        {
            code: "contracts",
            label: "Contratos pendientes",
            tone: "pending",
            parts: [
                { label: "Por enviar", value: counts.contracts.toSend, filter: "send" },
                { label: "Pendientes de firma", value: counts.contracts.pendingSignature, filter: "signature" },
            ],
        },
        {
            code: "bank",
            label: "Gestión bancaria",
            tone: "neutral",
            parts: [
                { label: "Sin iniciar", value: counts.banking, filter: "bank_not_started" },
                { label: "En proceso", value: counts.bankingInProgress, filter: "bank_in_progress" },
            ],
        },
        { code: "balance", label: "Pendientes de saldo", tone: "neutral", parts: [{ label: "Consulta financiera", value: counts.balance, filter: "balance" }] },
        { code: "transfer", label: "Traspasos pendientes", tone: "pending", parts: [{ label: "Por gestionar", value: counts.transferPending, filter: "transfer" }] },
        { code: "signed", label: "Traspaso firmado", tone: "success", parts: [{ label: "Firma registrada · Llaves pendientes", value: counts.transferSigned, filter: "signed" }] },
        { code: "closed", label: "Formalizaciones cerradas este año", tone: "success", parts: [{ label: "Proceso finalizado", value: counts.closedThisYear, filter: "closed" }] },
    ] as const;
    return (
        <>
            {stages
                .filter((banner) => allowedQueues.includes(banner.code === "bank" ? "bank" : banner.parts[0].filter))
                .map((banner) => (
                    <article key={banner.code} className={`formalization-banner formalization-banner--${banner.tone}`} aria-labelledby={`formalization-${banner.code}`} aria-busy={loading}>
                        <div className="formalization-banner__content">
                            <div className="formalization-title-help">
                                <h2 id={`formalization-${banner.code}`}>{banner.label}</h2>
                                <FormHelp label={`Condiciones de ${banner.label}`} text={FORMALIZATION_QUEUE_HELP[banner.code]} />
                            </div>
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
                                        key={part.label}
                                        type="button"
                                        className="formalization-banner__metric formalization-banner__metric-button"
                                        aria-label={`Abrir ${part.label}`}
                                        onClick={() => {
                                            onOpen(part.filter);
                                        }}
                                    >
                                        <span className="formalization-banner__value" aria-live="polite" aria-label={summary && part.value !== undefined ? `Valor: ${part.label}, ${String(part.value)}` : failed ? `${part.label}: sin verificar` : undefined}>
                                            {loading ? (
                                                <span className="formalization-banner__preload" role="status" aria-label={`Cargando ${part.label}`}>
                                                    <Spin size="small" />
                                                </span>
                                            ) : (
                                                (part.value ?? "—")
                                            )}
                                        </span>
                                        <span className="formalization-banner__caption">{part.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <BannerCorner kind={banner.code} />
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

function canUpdateOrderStage(_roles: FormalizationHomeProps["roles"], permissions: FormalizationHomeProps["effectivePermissions"]): boolean {
    const entries = (permissions ?? []).filter((entry) => entry.code === "formalizacion.orders.stage.update");
    return entries.some((entry) => entry.effect === "allow") && !entries.some((entry) => entry.effect === "deny");
}

/** La puerta está en el consumidor. Un acceso revocado no conserva datos ni inicia una petición. */
function FormalizationStageBanners({ canView, onOpen, enabled, refreshVersion, allowedQueues }: { readonly allowedQueues: readonly string[]; readonly canView: boolean; readonly onOpen: (filter: FollowUpSelection) => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    return canView ? <StageBanners allowedQueues={allowedQueues} onOpen={onOpen} enabled={enabled} refreshVersion={refreshVersion} /> : null;
}

/** Una vista previa oculta no inicia la lectura del resumen de etapas. */
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

/** Agregados y seguimiento canónicos, detrás de su permiso. Cambiar la etapa exige su propio permiso efectivo. */
function FormalizationHomeContent({ currentUser, roles, effectivePermissions = [], initialView = "home", onNavigate }: FormalizationHomeProps) {
    const filterStorageKey = filterPreferenceKey(currentUser);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [filterRequest, setFilterRequest] = useState<FollowUpFilterRequest>();
    const selectBanner = (selection: FollowUpSelection) => {
        setFilterRequest((previous) => ({ selection, version: (previous?.version ?? 0) + 1 }));
    };
    const [selectedQueue, setQueue] = useState<PreviewQueue | null>(() => (initialView === "orders" ? { filter: "all" } : null));
    const allowedQueues = formalizationReadQueues(roles, effectivePermissions);
    const canViewApprovals = allowedQueues.includes("approvals");
    const canViewAddendumBanner = canReadAddendumBanner(roles, effectivePermissions);
    const queue = visibleQueue(selectedQueue, allowedQueues);
    const canViewStages = allowedQueues.some((queue) => !["all", "approvals", "addendum"].includes(queue));
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
                    onAddendumChanged={refreshOrders}
                    onNavigate={onNavigate}
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
                            canViewApprovals={[canViewApprovals, canViewAddendumBanner].some(Boolean)}
                            onRefresh={() => {
                                setRefreshVersion((value) => value + 1);
                            }}
                        />
                        <div className="formalization-home__intro" data-has-approvals={canViewApprovals} data-pending-count={Number(canViewApprovals) + Number(canViewAddendumBanner)}>
                            {[
                                { kind: "approvals" as const, visible: canViewApprovals, canOpen: true },
                                { kind: "addendum" as const, visible: canViewAddendumBanner, canOpen: canReadOrderAddendum(effectivePermissions) },
                            ]
                                .filter((banner) => banner.visible)
                                .map((banner) => (
                                    <PendingStrip
                                        key={banner.kind}
                                        kind={banner.kind}
                                        canOpen={banner.canOpen}
                                        enabled={isHomeSummaryEnabled(initialView, queue, selected)}
                                        refreshVersion={refreshVersion}
                                        onOpen={() => {
                                            selectBanner(banner.kind);
                                        }}
                                    />
                                ))}
                            <section className="formalization-welcome" aria-label="Bienvenida a Formalización">
                                <div className="formalization-welcome__copy">
                                    <p className="formalization-welcome__title">{greetingFor(currentUser)}</p>
                                    <p className="formalization-welcome__text">Gestión contractual</p>
                                    <FormalizationProjectDistribution enabled={canReadList} />
                                </div>
                                <img className="formalization-welcome__art" src={`${import.meta.env.BASE_URL}illustrations/rocca-formalization-generated.png`} alt="" width={1754} height={897} decoding="async" />
                            </section>
                        </div>
                    </section>
                    <section className="formalization-home__banners" aria-label="Resumen de formalización">
                        <FormalizationStageBanners allowedQueues={allowedQueues} refreshVersion={refreshVersion} enabled={isHomeSummaryEnabled(initialView, queue, selected)} canView={canViewStages} onOpen={selectBanner} />
                    </section>
                    <div className="formalization-workspace">
                        <VisibleHomeFollowUp
                            filterRequest={filterRequest}
                            filterStorageKey={filterStorageKey}
                            onNavigate={onNavigate}
                            allowedQueues={allowedQueues}
                            stagePermissions={effectivePermissions}
                            onOpenRecord={setRecord}
                            canUpdateStage={canUpdateStage}
                            onRefresh={refreshOrders}
                            visible={isHomeSummaryEnabled(initialView, queue, selected)}
                            enabled={canReadList}
                            canReadOrder={canReadOrders}
                            refreshVersion={refreshVersion}
                            canViewApprovals={canViewApprovals}
                            tableOnly={false}
                            scope={{ filter: "all" }}
                            onOpenOrder={setSelected}
                        />
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
                            <FormalizationFollowUpPreview filterStorageKey={filterStorageKey} onNavigate={onNavigate} allowedQueues={allowedQueues} stagePermissions={effectivePermissions} onOpenRecord={setRecord} canUpdateStage={canUpdateStage} onRefresh={refreshOrders} enabled={canReadList} canReadOrder={canReadOrders} refreshVersion={refreshVersion} canViewApprovals={canViewApprovals} key={`${queue.filter}-${queue.project ?? "all"}`} tableOnly scope={queue} onOpenOrder={setSelected} />
                        </>
                    )}
                </div>
            </div>
        </ConfigProvider>
    );
}

/** Un cambio del conjunto de permisos desmonta cada lectura, y limpia registros abiertos y resultados pendientes antes de pintar. */
export function FormalizationHomePage(props: FormalizationHomeProps) {
    return (
        <FormalizationPreviewBoundary>
            <FormalizationHomeContent key={JSON.stringify([formalizationReadQueues(props.roles, props.effectivePermissions), canReadFormalizationOrder(props.roles, props.effectivePermissions), props.effectivePermissions?.filter((permission) => permission.code === "formalizacion.orders.read")])} {...props} />
        </FormalizationPreviewBoundary>
    );
}

/** Leer el registro real queda en la misma puerta de módulo y permiso que su lista. */
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

/** Un destacado vencido permanece oculto si su propio refresco de base falla o sigue pendiente. */
function recordReadStatus(databaseStatus: string, providerStatus: "idle" | "loading" | "success" | "error"): "idle" | "loading" | "success" | "error" {
    if (databaseStatus === "loading") return "loading";
    if (["denied", "missing", "error"].includes(databaseStatus)) return "error";
    return providerStatus;
}

function dismissedRestoreStatus(dismissed: boolean, record: FollowUpItem | null, status: string): string {
    return dismissed && !record ? "idle" : status;
}

function filterPreferenceKey(user: FormalizationHomeProps["currentUser"]) {
    return user?.email;
}
