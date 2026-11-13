import "./FormalizationHomePage.css";

import ArrowLeftOutlined from "@ant-design/icons/ArrowLeftOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import Spin from "antd/es/spin";
import Tooltip from "antd/es/tooltip";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import type { IdentityRole, IdentityUser } from "../../services/auth/identity-contracts";
import { getApprovalCount } from "../../services/formalization/approval-summary-service";
import { FINIQUITO_SECTIONS } from "../../services/formalization/finiquito-service";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOverdueSummary, type HomeSummary, type OverdueSummary } from "../../services/formalization/home-summary-service";
import { getPendingAddendumCount } from "../../services/formalization/order-addendum-service";
import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
import type { FollowUpFilterRequest, FollowUpSelection } from "./formalization-filter-preferences";
import { type FormalizationExample, PREVIEW_FILTER_TITLES, type PreviewQueue } from "./formalization-preview.model";
import { FORMALIZATION_QUEUE_HELP } from "./formalization-queue-help";
import { canReadAddendumBanner, canReadFormalizationOrder, formalizationReadQueues } from "./formalization-read-policy";
import { FormalizationFollowUpPreview } from "./FormalizationFollowUpPreview";
import { FormalizationOrderPreview, FormalizationOrderRecord } from "./FormalizationOrderPreview";
import { FormalizationPreviewBoundary } from "./FormalizationPreviewSession";
import { FormalizationProcessButton } from "./FormalizationProcessButton";
import { FormalizationProjectDistribution } from "./FormalizationProjectDistribution";
import { FormalizationRecordLoading } from "./FormalizationRecordLoading";
import type { EffectiveNavigationPermission } from "./GlobalHomeShell";
import { canReadOrderAddendum } from "./order-addendum-permissions";
import { useFiniquitoBanner } from "./useFiniquitoBanner";
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

/** Para qué sirve cada tarjeta, en una línea visible. Texto de producto: se edita aquí. */
const BANNER_PURPOSE: Record<string, string> = {
    approvals: "Órdenes esperando tu aprobación",
    addendum: "Órdenes con adéndum por revisar",
    contracts: "Contratos por enviar al cliente o por firmar",
    bank: "Órdenes en trámite con el banco",
    balance: "Órdenes que esperan la consulta de saldo",
    transfer: "Órdenes listas para gestionar el traspaso",
    signed: "Traspaso firmado; falta entregar las llaves",
    closed: "Órdenes cerradas en lo que va del año",
};

/** Interruptor de la urgencia (pastillas "+N h"). Apagado por ahora: el código y la ruta /overdue quedan listos para activarla. */
const SHOW_OVERDUE_BADGES = false;

/** Umbral de atraso legible: minutos por debajo de una hora, horas por encima. */
const thresholdLabel = (minutes = 4320) => (minutes < 60 ? `${String(minutes)} min` : `${String(Math.round(minutes / 60))} h`);

/** Título-separador de grupo del inicio: línea · TÍTULO · línea. Con `show` falso no se pinta. */
function HomeDivider({ title, show = true }: { readonly title: string; readonly show?: boolean }) {
    if (!show) return null;
    return (
        <div className="formalization-home-divider" role="separator" aria-label={title}>
            <span>{title}</span>
        </div>
    );
}

/** Cifra de una tarjeta: indicador de carga mientras se consulta y raya cuando todavía no se sabe. */
function BannerValue({ loading, preloadLabel, value, ariaLabel, empty = false }: { readonly loading: boolean; readonly preloadLabel: string; readonly value: number | null | undefined; readonly ariaLabel: string | undefined; readonly empty?: boolean }) {
    return (
        <span className="formalization-banner__value" data-empty={empty ? "true" : undefined} aria-live="polite" aria-label={ariaLabel}>
            {loading ? (
                <span className="formalization-banner__preload" role="status" aria-label={preloadLabel}>
                    <Spin size="small" />
                </span>
            ) : (
                (value ?? "—")
            )}
        </span>
    );
}

/** Leyenda del pendiente según el estado de su consulta. */
function pendingCaption(count: number | null, failed: boolean): string {
    if (failed) return "No disponible";
    if (count === null) return "Consultando…";
    return count === 0 ? "Todo al día" : "Por revisar";
}

/** Presentación compartida de pendientes, independiente de sus fuentes y acciones. */
function PendingStripContent({ title, purpose, help, children }: { readonly title: string; readonly purpose: string | undefined; readonly help: string; readonly children: ReactNode }) {
    return (
        <span className="formalization-banner__content">
            <span className="formalization-title-help">
                <span className="formalization-approval-strip__title">{title}</span>
                <FormHelp label={`Condiciones de ${title}`} text={help} />
            </span>
            <span className="formalization-banner__purpose">{purpose}</span>
            {children}
        </span>
    );
}

/** Los contadores y las órdenes proceden de la misma lectura real; un error no se muestra como cero. */
function SettlementPreviewBanner({ enabled, refreshVersion, onOpen }: { readonly enabled: boolean; readonly refreshVersion: number; readonly onOpen: (selection: FollowUpSelection) => void }) {
    const model = useFiniquitoBanner(enabled, refreshVersion);
    const pending = FINIQUITO_SECTIONS.some(({ code }) => (model.data?.counts[code] ?? 0) > 0);
    return (
        <>
            <div className="formalization-banner formalization-banner--pending formalization-approval-strip formalization-settlement-preview formalization-settlement-banner" data-kind="addendum" data-attention={pending ? "true" : undefined} role="region" aria-label="Ventas caídas · Gestión de finiquito">
                <PendingStripContent title="Ventas caídas · Gestión de finiquito" purpose="Gestión de reservas de ventas caídas" help="Solo ventas caídas con Reserva Aplicada confirmada. Saldo validado es un check independiente: primero se valida el saldo, después se registra el envío y finalmente la recepción firmada. Las marcas quedan en bitácora.">
                    <span className="formalization-banner__metrics">
                        {FINIQUITO_SECTIONS.map(({ code, label, queue }) => (
                            <button
                                type="button"
                                className="formalization-banner__metric"
                                key={code}
                                onClick={() => {
                                    onOpen(queue);
                                }}
                            >
                                <BannerValue loading={model.busy} preloadLabel={`Consultando ${label}`} value={model.data?.counts[code] ?? null} ariaLabel={label} empty={model.data?.counts[code] === 0} />
                                <span className="formalization-banner__caption">{label}</span>
                            </button>
                        ))}
                    </span>
                </PendingStripContent>
                <BannerCorner kind="addendum" />
            </div>
        </>
    );
}

/** Los pendientes comparten presentación; cada fuente y permiso conserva su consulta independiente. */
function PendingStrip({ kind, canOpen = true, onOpen, enabled, refreshVersion }: { readonly kind: "approvals" | "addendum"; readonly canOpen?: boolean; readonly onOpen: () => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    const { title, subject, load } = pendingBanners[kind];
    const { value: count, failed } = useBannerSummary(load, enabled, refreshVersion);
    const caption = pendingCaption(count, failed);
    const loading = [count === null, !failed].every(Boolean);
    const attention = [typeof count === "number", (count ?? 0) > 0].every(Boolean);
    const quiet = caption === "Por revisar";
    const action = { label: `Ver pendientes de ${subject} de Formalización`, onClick: onOpen };
    return (
        <div className="formalization-banner formalization-banner--pending formalization-approval-strip" data-kind={kind} data-attention={attention ? "true" : undefined} data-calm={count === 0 ? "true" : undefined} aria-busy={loading}>
            <button type="button" className="formalization-approval-strip__action" aria-label={action.label} aria-busy={loading} disabled={[failed, !canOpen].some(Boolean)} onClick={action.onClick} />
            <PendingStripContent title={title} purpose={BANNER_PURPOSE[kind]} help={FORMALIZATION_QUEUE_HELP[kind]}>
                <span className="formalization-banner__metrics">
                    <span className="formalization-banner__metric">
                        <BannerValue loading={loading} preloadLabel={`Cargando pendientes de ${subject}`} value={count} ariaLabel={`Órdenes pendientes de ${subject}: ${count === null ? caption : String(count)}`} />
                        {!failed && (
                            <span className={`formalization-banner__caption${quiet ? " formalization-banner__caption--quiet" : ""}`}>
                                <span>{caption}</span>
                            </span>
                        )}
                    </span>
                </span>
            </PendingStripContent>
            <BannerCorner kind={kind} />
        </div>
    );
}

/** Conteos vacíos mientras llega la respuesta: la raya significa "todavía no se sabe". */
const EMPTY_STAGE_COUNTS = { contracts: { toSend: undefined, pendingSignature: undefined }, banking: undefined, bankingInProgress: undefined, balance: undefined, transferPending: undefined, transferSigned: undefined, closedThisYear: undefined } as const;

/** Tarjetas de etapa con sus cifras. Cada parte abre su bandeja filtrada. */
function buildStages(counts: Pick<HomeSummary, "counts">["counts"] | typeof EMPTY_STAGE_COUNTS) {
    return [
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
}
type StageBannerData = ReturnType<typeof buildStages>[number];

/** Atraso por filtro. Si su lectura falla o está apagada, no hay valores y la pastilla no se muestra. */
function overdueByFilterOf(summary: OverdueSummary | null): Record<string, number | undefined> {
    if (!summary) return {};
    const { counts } = summary;
    return { send: counts.contractsToSend, signature: counts.contractsPendingSignature, bank_not_started: counts.banking, bank_in_progress: counts.bankingInProgress, balance: counts.balance, transfer: counts.transferPending, signed: counts.transferSigned };
}

/** Pastilla "N +umbral": cuántas órdenes de la cifra llevan demasiado en la misma etapa. */
function OverdueBadge({ count, minutes }: { readonly count: number | undefined; readonly minutes: number | undefined }) {
    if (!count) return null;
    const label = thresholdLabel(minutes);
    return (
        <span className="formalization-banner__overdue" title={`${String(count)} llevan más de ${label} en esta etapa (CRM nuevo)`}>
            {count} +{label}
        </span>
    );
}

/** Texto accesible de la cifra: el valor cuando se conoce y, si no, que está sin verificar. */
function metricAriaLabel(part: StageBannerData["parts"][number], known: boolean, failed: boolean): string | undefined {
    if (known && part.value !== undefined) return `Valor: ${part.label}, ${String(part.value)}`;
    return failed ? `${part.label}: sin verificar` : undefined;
}

/** Una cifra clicable de la tarjeta, con su leyenda y, si existe, su atraso. */
function StageMetric({ part, loading, failed, known, overdue, onOpen }: { readonly part: StageBannerData["parts"][number]; readonly loading: boolean; readonly failed: boolean; readonly known: boolean; readonly overdue: { readonly count: number | undefined; readonly minutes: number | undefined }; readonly onOpen: (filter: FollowUpSelection) => void }) {
    return (
        <button
            type="button"
            className="formalization-banner__metric formalization-banner__metric-button"
            aria-label={`Abrir ${part.label}`}
            onClick={() => {
                onOpen(part.filter);
            }}
        >
            <BannerValue loading={loading} preloadLabel={`Cargando ${part.label}`} value={part.value} ariaLabel={metricAriaLabel(part, known, failed)} empty={part.value === 0} />
            <span className="formalization-banner__caption">{part.label}</span>
            <OverdueBadge count={overdue.count} minutes={overdue.minutes} />
        </button>
    );
}

/** Tarjeta de una etapa: título, para qué sirve y sus cifras. */
function StageBanner({ banner, loading, failed, known, overdue, onOpen, retry }: { readonly retry: () => void; readonly banner: StageBannerData; readonly loading: boolean; readonly failed: boolean; readonly known: boolean; readonly overdue: { readonly byFilter: Record<string, number | undefined>; readonly minutes: number | undefined }; readonly onOpen: (filter: FollowUpSelection) => void }) {
    const attention = banner.code === "contracts" && banner.parts.some((part) => (part.value ?? 0) > 0);
    return (
        <article data-attention={attention ? "true" : undefined} className={`formalization-banner formalization-banner--${banner.tone}`} aria-labelledby={`formalization-${banner.code}`} aria-busy={loading}>
            <div className="formalization-banner__content">
                <div className="formalization-title-help">
                    <h2 id={`formalization-${banner.code}`}>{banner.label}</h2>
                    <FormHelp label={`Condiciones de ${banner.label}`} text={FORMALIZATION_QUEUE_HELP[banner.code]} />
                </div>
                <p className="formalization-banner__purpose">{BANNER_PURPOSE[banner.code]}</p>
                <div className="formalization-banner__metrics">
                    {banner.parts.map((part) => (
                        <StageMetric key={part.label} part={part} loading={loading} failed={failed} known={known} overdue={{ count: overdue.byFilter[part.filter], minutes: overdue.minutes }} onOpen={onOpen} />
                    ))}
                </div>
                {failed && <span role="alert">Sin verificar</span>}
                {failed && (
                    <Tooltip title={banner.code === "contracts" ? "No se pudieron verificar los conteos de contratos. Reintentar consulta." : `No se pudieron verificar los conteos de ${banner.label}. Reintentar consulta.`}>
                        <button type="button" aria-label={banner.code === "contracts" ? "Reintentar conteos de contratos" : `Reintentar ${banner.label}`} onClick={retry}>
                            <ReloadOutlined aria-hidden="true" />
                        </button>
                    </Tooltip>
                )}
            </div>
            <BannerCorner kind={banner.code} />
        </article>
    );
}

/** El primer elemento de cada grupo lleva el separador; los demás solo comparten fila. */
const STAGE_GROUP_OF: Record<string, string> = { contracts: "pay", bank: "pay", balance: "pay", transfer: "close", signed: "close", closed: "close" };
const STAGE_GROUP_TITLES: Record<string, string> = { contracts: "Contratos, banco y saldo", bank: "Contratos, banco y saldo", balance: "Contratos, banco y saldo", transfer: "Traspaso y cierre", signed: "Traspaso y cierre", closed: "Traspaso y cierre" };

/** Título del grupo si esta tarjeta es la primera visible de su grupo. */
function groupTitleFor(banner: StageBannerData, index: number, visible: readonly StageBannerData[]): string | undefined {
    const first = visible.findIndex((other) => STAGE_GROUP_OF[other.code] === STAGE_GROUP_OF[banner.code]);
    return first === index ? STAGE_GROUP_TITLES[banner.code] : undefined;
}

/** Un solo dueño autorizado alimenta cada banner de etapa. Los montajes no comparten datos. */
function StageBanners({ onOpen, enabled, refreshVersion, allowedQueues }: { readonly allowedQueues: readonly string[]; readonly onOpen: (filter: FollowUpSelection) => void; readonly enabled: boolean; readonly refreshVersion: number }) {
    const { value: summary, failed, retry } = useHomeSummary(enabled, refreshVersion);
    const { value: overdueSummary } = useBannerSummary(getOverdueSummary, [enabled, SHOW_OVERDUE_BADGES].every(Boolean), refreshVersion);
    const overdue = { byFilter: overdueByFilterOf(overdueSummary), minutes: overdueSummary?.thresholdMinutes };
    const loading = !summary && !failed;
    const visible = buildStages(summary?.counts ?? EMPTY_STAGE_COUNTS).filter((banner) => allowedQueues.includes(banner.code === "bank" ? "bank" : banner.parts[0].filter));
    return (
        <>
            {visible.map((banner, index) => (
                <Fragment key={banner.code}>
                    <HomeDivider title={groupTitleFor(banner, index, visible) ?? ""} show={groupTitleFor(banner, index, visible) !== undefined} />
                    <StageBanner retry={retry} banner={banner} loading={loading} failed={failed} known={Boolean(summary)} overdue={overdue} onOpen={onOpen} />
                </Fragment>
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
            <div className="global-home-page-header__actions">
                <FormalizationProcessButton />
                {canRefresh && (
                    <Tooltip title="Recargar banners">
                        <Button className="formalization-command formalization-home__reload" icon={<ReloadOutlined />} aria-label="Recargar banners" onClick={onRefresh} />
                    </Tooltip>
                )}
            </div>
        </div>
    );
}

function VisibleHomeFollowUp({ visible, ...props }: React.ComponentProps<typeof FormalizationFollowUpPreview> & { readonly visible: boolean }) {
    return visible ? <FormalizationFollowUpPreview {...props} /> : null;
}

/** La tabla ya vive bajo el resumen: se lleva la vista hasta ella para ver el filtro aplicado. Tolera entornos sin esas APIs (pruebas, navegadores viejos). */
function scrollToFollowUp() {
    window.requestAnimationFrame(() => {
        const target: Partial<Pick<Element, "scrollIntoView">> | null = document.querySelector(".formalization-home .formalization-workspace:not([hidden])");
        const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
}

/** Agregados y seguimiento canónicos, detrás de su permiso. Cambiar la etapa exige su propio permiso efectivo. */
function FormalizationHomeContent({ currentUser, roles, effectivePermissions = [], initialView = "home", onNavigate }: FormalizationHomeProps) {
    const filterStorageKey = filterPreferenceKey(currentUser);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [filterRequest, setFilterRequest] = useState<FollowUpFilterRequest>();
    const selectBanner = (selection: FollowUpSelection) => {
        setFilterRequest((previous) => ({ selection, version: (previous?.version ?? 0) + 1 }));
        scrollToFollowUp();
    };
    const [selectedQueue, setQueue] = useState<PreviewQueue | null>(() => (initialView === "orders" ? { filter: "all" } : null));
    const allowedQueues = formalizationReadQueues(roles, effectivePermissions);
    const canViewApprovals = allowedQueues.includes("approvals");
    const canViewAddendumBanner = canReadAddendumBanner(roles, effectivePermissions);
    const queue = visibleQueue(selectedQueue, allowedQueues);
    const canViewStages = allowedQueues.some((queue) => !["all", "approvals", "addendum"].includes(queue) && !queue.startsWith("finiquito_"));
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
                            canViewApprovals={[canViewApprovals, canViewAddendumBanner, canReadOrders].some(Boolean)}
                            onRefresh={() => {
                                setRefreshVersion((value) => value + 1);
                            }}
                        />
                        <section className="formalization-welcome" aria-label="Bienvenida a Formalización">
                            <div className="formalization-welcome__copy">
                                <p className="formalization-welcome__title">{greetingFor(currentUser)}</p>
                                <p className="formalization-welcome__text">Gestión contractual</p>
                                <FormalizationProjectDistribution
                                    enabled={canReadList}
                                    onSelect={(selection, projectId) => {
                                        setFilterRequest((previous) => ({ selection, projectId, version: (previous?.version ?? 0) + 1 }));
                                        scrollToFollowUp();
                                    }}
                                />
                            </div>
                        </section>
                        <HomeDivider title="Por revisar" show={[canViewApprovals, canViewAddendumBanner, canReadOrders].some(Boolean)} />
                        <div className="formalization-home__intro" data-has-approvals={canViewApprovals} data-pending-count={Number(canViewApprovals) + Number(canViewAddendumBanner) + Number(canReadOrders)}>
                            {[
                                { kind: "approvals" as const, visible: canViewApprovals, canOpen: true },
                                { kind: "addendum" as const, visible: canViewAddendumBanner, canOpen: canReadOrderAddendum(effectivePermissions) },
                                { kind: "finiquito" as const, visible: canReadOrders, canOpen: canReadOrders },
                            ]
                                .filter((banner) => banner.visible)
                                .map((banner) =>
                                    banner.kind === "finiquito" ? (
                                        <SettlementPreviewBanner key={banner.kind} enabled={isHomeSummaryEnabled(initialView, queue, selected)} refreshVersion={refreshVersion} onOpen={selectBanner} />
                                    ) : (
                                        <Fragment key={banner.kind}>
                                            <PendingStrip
                                                kind={banner.kind}
                                                canOpen={banner.canOpen}
                                                enabled={isHomeSummaryEnabled(initialView, queue, selected)}
                                                refreshVersion={refreshVersion}
                                                onOpen={() => {
                                                    selectBanner(banner.kind);
                                                }}
                                            />
                                        </Fragment>
                                    ),
                                )}
                        </div>
                    </section>
                    <section className="formalization-home__banners" aria-label="Resumen de formalización">
                        <FormalizationStageBanners allowedQueues={allowedQueues} refreshVersion={refreshVersion} enabled={isHomeSummaryEnabled(initialView, queue, selected)} canView={canViewStages} onOpen={selectBanner} />
                    </section>
                    <div className="formalization-workspace">
                        <HomeDivider title="Seguimiento de órdenes" show={[isHomeSummaryEnabled(initialView, queue, selected), canReadList].every(Boolean)} />
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
