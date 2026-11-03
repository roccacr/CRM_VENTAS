import "./MarketingHomePage.css";

import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";
import UserAddOutlined from "@ant-design/icons/UserAddOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import Select from "antd/es/select";
import Spin from "antd/es/spin";
import { type ReactNode, useDeferredValue, useMemo, useState, useTransition } from "react";

import type { IdentityUser } from "../../services/auth/identity-contracts";
import type { MarketingApiSummary, MarketingAppointmentEvent } from "../../services/marketing/home-summary-service";
import { appointmentCaption, summarizeAppointmentEvents } from "./marketing-appointments.model";
import { countFormat, describeChange, describeChartComparison, describeLeadChange, describeRange, type MarketingDelta, percentFormat } from "./marketing-home-format";
import { addDays, alertMarketingSample, bucketMarketingSample, daysBetween, EMPTY_MARKETING_ROWS, emptyMarketingFilters, groupMarketingSample, type MarketingDirectoryRow, type MarketingPeriodMode, type MarketingPreviewFilters, type MarketingSampleRow, parseISODate, recentWithoutAppointment, recentWithoutAppointmentSeries, relativeChange, resolveMarketingView, summarizeMarketingSample } from "./marketing-home-preview.model";
import { buildProjectCards } from "./marketing-home-projects";
import { LeadsAreaChart, SparkArea } from "./MarketingHomeCharts";
import { MarketingProjects, MarketingSellers } from "./MarketingHomePanels";
import { DeltaText, MarketingAlerts } from "./MarketingHomeSections";
import { InfoHint } from "./MarketingInfoHint";
import { MarketingWelcomeArt } from "./MarketingWelcomeArt";
import { useMarketingHomeSummary } from "./useMarketingHomeSummary";

type Totals = ReturnType<typeof summarizeMarketingSample>;
type BannerTone = "neutral" | "success" | "pending";
type HomePeriod = Extract<MarketingPeriodMode, "day" | "week" | "month" | "year">;

interface PeriodCopy {
    readonly key: HomePeriod;
    readonly label: string;
    readonly word: string;
    readonly against: string;
    readonly chart: string;
    readonly unit: string;
}

/** The four time frames of the summary. Each one is compared with the same stretch of the previous one. */
const HOME_PERIODS: readonly PeriodCopy[] = [
    { key: "day", label: "Hoy", word: "hoy", against: "ayer", chart: "Leads de los últimos 7 días", unit: "día" },
    { key: "week", label: "Semana", word: "esta semana", against: "la semana pasada", chart: "Leads de la semana", unit: "día" },
    { key: "month", label: "Mes", word: "este mes", against: "el mes pasado", chart: "Leads del mes", unit: "día" },
    { key: "year", label: "Año", word: "este año", against: "el año pasado", chart: "Leads del año, mes a mes", unit: "mes" },
];
const DEFAULT_PERIOD: PeriodCopy = { key: "month", label: "Mes", word: "este mes", against: "el mes pasado", chart: "Leads del mes", unit: "día" };

interface MarketingBannerProps {
    readonly title: string;
    readonly value: string;
    readonly caption: string;
    readonly hint?: string;
    readonly icon: ReactNode;
    readonly tone: BannerTone;
    readonly delta: MarketingDelta | null;
    readonly series: readonly number[];
    readonly context?: string;
}

/** Compares a rate with the previous one, only when the comparison had something to compare. */
const rateChange = (current: number, previous: number, hasPrevious: boolean) => {
    if (!hasPrevious) return null;
    const delta = describeChange(current - previous, "puntos");
    return delta && { ...delta, text: delta.text.replace("puntos", "puntos porcentuales") };
};

interface BannerInput {
    readonly available: boolean;
    readonly appointmentsAvailable: boolean;
    readonly totals: Totals;
    readonly before: Totals;
    readonly context: string;
    readonly buckets: ReturnType<typeof bucketMarketingSample>;
    readonly eventTotals?: ReturnType<typeof summarizeAppointmentEvents> | undefined;
    readonly followUp: { readonly value: number; readonly series: readonly number[]; readonly range: string };
}

/** Four cards, each with its own trend: how many leads, how many reach an appointment, how many visits happened and what still needs follow-up. */
function buildBanners({ available, appointmentsAvailable, totals, before, context, buckets, followUp, eventTotals }: BannerInput): readonly MarketingBannerProps[] {
    const pending: readonly MarketingBannerProps[] = [
        { title: "Leads", value: "—", caption: "Registrados en el periodo", icon: <UserAddOutlined />, tone: "neutral", delta: null, series: [] },
        { title: "Leads con cita", value: "—", caption: "Con cita programada o completada", icon: <RiseOutlined />, tone: "neutral", delta: null, series: [] },
        { title: "Citas completadas", value: "—", caption: "Según el estado de cada cita", icon: <CheckCircleOutlined />, tone: "neutral", delta: null, series: [] },
        { title: "Leads sin cita · 7 días", value: "—", caption: "Sin cita programada o completada", icon: <UserOutlined />, tone: "neutral", delta: null, series: [] },
    ];
    if (!available) return pending;
    const banners: readonly MarketingBannerProps[] = [
        { title: "Leads", value: countFormat.format(totals.leads), caption: "Registrados en el periodo", hint: "Lead: registro de interés de un posible cliente. Una persona puede tener varios registros.", icon: <UserAddOutlined />, tone: "neutral", delta: describeLeadChange(relativeChange(totals.leads, before.leads)), series: buckets.map((bucket) => bucket.leads), context },
        {
            title: "Leads con cita",
            value: `${percentFormat.format(totals.rate)} %`,
            caption: `${countFormat.format(totals.withAppointment)} de ${countFormat.format(totals.leads)} leads`,
            hint: "Porcentaje de los leads registrados en el periodo que tienen una cita programada o completada. Una cita futura cuenta; las canceladas no.",
            icon: <RiseOutlined />,
            tone: "success",
            delta: rateChange(totals.rate, before.rate, before.leads > 0),
            series: buckets.map((bucket) => (bucket.leads ? (bucket.withAppointment / bucket.leads) * 100 : 0)),
            context,
        },
        {
            title: "Citas completadas",
            value: countFormat.format(eventTotals?.completed ?? totals.attended),
            caption: eventTotals ? appointmentCaption(eventTotals) : totals.attended + totals.missed > 0 ? `Asistencia ${percentFormat.format(totals.attendance)} % · ${countFormat.format(totals.pending)} pendientes` : `${countFormat.format(totals.pending)} pendientes, aún no vencen`,
            icon: <CheckCircleOutlined />,
            tone: "success",
            hint: "Se cuentan por la fecha de la cita, aunque el lead se haya registrado antes. Completada no confirma que el cliente asistió.",
            // Recent appointments are still pending, so comparing completed visits would read as a false drop.
            delta: null,
            series: eventTotals ? [] : buckets.map((bucket) => bucket.attended),
        },
        { title: "Leads sin cita · 7 días", value: countFormat.format(followUp.value), caption: followUp.range, hint: "Leads registrados en los últimos siete días que no tienen cita programada ni completada. No cambia con el periodo elegido.", icon: <UserOutlined />, tone: "pending", delta: null, series: followUp.series },
    ];
    return banners.map((banner, index) => (index > 0 && !appointmentsAvailable ? (pending[index] as MarketingBannerProps) : banner));
}

interface MarketingScope {
    readonly sellers: readonly string[];
    readonly projects: readonly string[];
}

interface ControlsProps {
    readonly notice: string;
    readonly onRetry?: (() => void) | undefined;
    readonly available: boolean;
    readonly rows: readonly MarketingDirectoryRow[];
    readonly period: HomePeriod;
    readonly scope: MarketingScope;
    readonly summary: string;
    readonly onPeriod: (period: HomePeriod) => void;
    readonly onProject: (projects: readonly string[]) => void;
}

/** Describe los proyectos elegidos sin introducir un filtro por vendedor. */
function describeScope({ projects }: MarketingScope, source: readonly MarketingDirectoryRow[]): string {
    const projectLabel = projects.map((project) => source.find((row) => row.project === project)?.projectName ?? project).join(", ");
    return projects.length ? `Captación de leads y citas · ${projectLabel}` : "Captación de leads y citas";
}

/** Stable IDs in values; readable names sorted independently of source/provider identities. */
function marketingOptions(rows: readonly MarketingDirectoryRow[]) {
    const names = new Map(rows.map((row) => [row.project, row.projectName ?? row.project]));
    return [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Period and project are the only controls; the detail by campaign and ad lives in "Captación de leads". */
function MarketingControls({ available, notice, onRetry, rows, period, scope, summary, onPeriod, onProject }: ControlsProps) {
    return (
        <>
            {!available && (
                <p className="marketing-demo-notice" role="status">
                    {notice}
                    {onRetry && (
                        <button type="button" onClick={onRetry}>
                            Reintentar
                        </button>
                    )}
                </p>
            )}
            <section className="marketing-bar" aria-label="Periodo y proyecto">
                <div className="marketing-preview-grouping" role="group" aria-label="Periodo">
                    {HOME_PERIODS.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={period === key}
                            onClick={() => {
                                onPeriod(key);
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <label className="marketing-bar__seller">
                    <span>Proyecto</span>
                    <Select<string[]> aria-label="Proyecto" mode="multiple" allowClear virtual={false} disabled={rows.length === 0} value={[...scope.projects]} placeholder="Todos los proyectos" showSearch={{ optionFilterProp: "label" }} options={marketingOptions(rows)} onChange={onProject} />
                </label>
                <p className="marketing-bar__summary">{summary}</p>
            </section>
        </>
    );
}

/** Lead cohorts retain their creation dates; appointment events use a separate event-date counter. */
function marketingRows(summary: MarketingApiSummary): readonly MarketingSampleRow[] {
    const today = parseISODate(summary.today) as Date;
    const sellers = new Map(summary.sellers.map((seller) => [seller.id, seller]));
    const projects = new Map(summary.projects.map((project) => [project.id, project]));
    const appointments = new Map(summary.appointments.available ? summary.appointments.leadsWithAppointment.map((row) => [JSON.stringify([row.date, row.sellerId, row.projectId]), row.withAppointment]) : []);
    return summary.rows.map((row) => ({
        seller: row.sellerId,
        project: row.projectId,
        sellerName: sellers.get(row.sellerId)?.name ?? "Sin vendedor",
        sellerPublicId: sellers.get(row.sellerId)?.publicId ?? null,
        projectName: projects.get(row.projectId)?.name ?? "Sin proyecto",
        campaign: "",
        ad: "",
        daysAgo: daysBetween(parseISODate(row.date) as Date, today),
        leads: row.leads,
        withAppointment: appointments.get(JSON.stringify([row.date, row.sellerId, row.projectId])) ?? 0,
        appointments: 0,
        attended: 0,
        missed: 0,
    }));
}

/** Connected entry; the API owns both source precedence and real lead counts. */
export function MarketingHomePage({ currentUser }: { readonly currentUser: IdentityUser }) {
    const [period, setPeriod] = useState<HomePeriod>("month");
    const { value, failed, retry } = useMarketingHomeSummary(period, currentUser.publicId);
    const presentation = connectedPresentation(value);
    return <MarketingHomeDashboard currentUser={currentUser} {...presentation} periodControl={{ period, setPeriod }} loading={!value && !failed} notice={failed ? "No fue posible consultar los leads. Vuelve a intentarlo." : "Consultando los leads…"} onRetry={failed ? retry : undefined} />;
}

interface MarketingHomeDashboardProps {
    readonly currentUser: IdentityUser;
    readonly rows?: readonly MarketingSampleRow[] | undefined;
    readonly today?: Date | undefined;
    readonly dataQuality?: MarketingApiSummary["appointments"] | undefined;
    readonly directory?: readonly MarketingDirectoryRow[] | undefined;
    readonly appointmentEvents?: readonly MarketingAppointmentEvent[] | undefined;
    readonly appointmentsAvailable?: boolean;
    readonly loading?: boolean;
    readonly periodControl?: { readonly period: HomePeriod; readonly setPeriod: (period: HomePeriod) => void };
    readonly notice?: string;
    readonly onRetry?: (() => void) | undefined;
}

/** Pure dashboard: placeholders when unavailable; explicit rows are the only data source. */
export function MarketingHomeDashboard({ currentUser, rows, today, periodControl, appointmentsAvailable, appointmentEvents, directory, dataQuality, loading, notice = "La información de leads y citas estará disponible al conectar los datos.", onRetry }: MarketingHomeDashboardProps) {
    const [transitionPending, startTransition] = useTransition();
    const showAppointments = appointmentsAvailable !== false;
    const available = rows !== undefined;
    const { source, dimensions } = marketingSources(rows, directory);
    const [localPeriod, setLocalPeriod] = useState<HomePeriod>("month");
    const { period, setPeriod } = periodControl ?? { period: localPeriod, setPeriod: setLocalPeriod };
    const { scope, selection, setScope, pending } = useMarketingScope(currentUser.publicId, available ? dimensions : undefined, loading);
    const busy = transitionPending || pending;
    const { sellers, projects } = scope;
    const filters = useMemo<MarketingPreviewFilters>(() => {
        const base = emptyMarketingFilters(today);
        return { ...base, sellers, projects, selection: { ...base.selection, mode: period } };
    }, [sellers, projects, period, today]);
    const copy = HOME_PERIODS.find((item) => item.key === period) ?? DEFAULT_PERIOD;
    const view = useMemo(() => resolveMarketingView(filters, today, source), [filters, today, source]);
    const projectCards = useMemo(() => buildProjectCards(filters, view), [filters, view]);
    const sellerGroups = useMemo(() => groupMarketingSample(resolveMarketingView({ ...filters, seller: "", sellers: [] }, view.today, source), "seller"), [filters, view.today, source]);
    const totals = useMemo(() => summarizeMarketingSample(view.rows), [view.rows]);
    const buckets = useMemo(() => visibleBuckets(available, view), [available, view]);
    const summary = `${describeRange(view.period)} · vs. ${describeRange(view.comparison)}`;
    const [first, ...others] = buildBanners({
        available,
        eventTotals: summarizeOptionalAppointments(appointmentEvents, view.period, scope),
        appointmentsAvailable: showAppointments,
        totals,
        before: summarizeMarketingSample(view.previousRows),
        context: `vs. ${copy.against.replace(/^(el|la) /, "")}`,
        buckets,
        followUp: { range: describeRange({ start: addDays(view.today, -6), end: view.today }), value: recentWithoutAppointment(filters, view.today, source), series: recentWithoutAppointmentSeries(filters, view.today, source) },
    });

    return (
        <div className="global-home-dashboard marketing-home" aria-busy={busy}>
            <MarketingPreload busy={busy} />
            <section className="global-home-page-header" aria-labelledby="marketing-home-title">
                <div>
                    <h1 id="marketing-home-title">Mercadeo</h1>
                    <p>Leads registrados, citas y desempeño por vendedor.</p>
                </div>
            </section>
            <MarketingControls
                notice={notice}
                onRetry={onRetry}
                available={available}
                rows={dimensions}
                period={period}
                scope={selection}
                summary={summary}
                onPeriod={(next) => {
                    startTransition(() => {
                        setPeriod(next);
                    });
                }}
                onProject={(next) => {
                    setScope((current) => ({ ...current, projects: next }));
                }}
            />
            <MarketingDataQuality value={dataQuality} />
            <div className="marketing-preview-banners">
                {first && <MarketingBanner key={first.title} {...first} />}
                <MarketingWelcome currentUser={currentUser} scope={scope} source={dimensions} />
                {others.map((banner) => (
                    <MarketingBanner key={banner.title} {...banner} />
                ))}
            </div>
            <MarketingAlerts alerts={showAppointments ? alertMarketingSample(view) : []} comparison={{ current: describeRange(view.period), previous: describeRange(view.comparison) }} />
            <LeadsAreaChart title={copy.chart} buckets={buckets} currentLabel={describeRange(view.window)} comparisonLabel={describeChartComparison(view)} unit={copy.unit} />
            <MarketingProjects cards={projectCards} periodWord={copy.word} seller="" comparison={{ label: copy.against, current: describeRange(view.period), previous: describeRange(view.comparison) }} />
            <MarketingSellers groups={sellerGroups} appointmentsAvailable={showAppointments} comparisonLabel={describeRange(view.comparison)} />
        </div>
    );
}

/** Shared busy signal for network reads and local filter transitions; does not block newer selections. */
function MarketingPreload({ busy }: { readonly busy: boolean }) {
    if (!busy) return null;
    return (
        <div className="marketing-home__preload" role="status" aria-label="Cargando Mercadeo" aria-live="polite">
            <Spin />
            <span>Actualizando Mercadeo…</span>
        </div>
    );
}

/** Conserva el proyecto al cargar y lo reconcilia con el directorio autorizado del usuario. */
function useMarketingScope(userId: string, rows: readonly MarketingDirectoryRow[] | undefined, loading?: boolean) {
    const [stored, setStored] = useState({ userId, scope: { sellers: [] as readonly string[], projects: [] as readonly string[] } });
    const own = stored.userId === userId ? stored.scope : { sellers: [], projects: [] };
    const scope = rows === undefined ? own : reconcileScope(own, rows);
    if (stored.userId !== userId || scope.sellers.join("|") !== stored.scope.sellers.join("|") || scope.projects.join("|") !== stored.scope.projects.join("|")) setStored({ userId, scope });
    const setScope = (update: (current: MarketingScope) => MarketingScope) => {
        setStored((current) => ({ userId, scope: update(current.scope) }));
    };
    // Select values must commit immediately; defer only the expensive report, otherwise rapid selections can be lost.
    const deferredScope = useDeferredValue(scope);
    return { scope: deferredScope, selection: scope, setScope, pending: loading || scope !== deferredScope };
}

function reconcileScope(scope: MarketingScope, rows: readonly MarketingDirectoryRow[]): MarketingScope {
    const sellers: readonly string[] = [];
    const projects = scope.projects.filter((id) => rows.some((row) => row.project === id));
    if (sellers.length === scope.sellers.length && projects.length === scope.projects.length) return scope;
    return { sellers, projects };
}

function visibleBuckets(available: boolean, view: ReturnType<typeof resolveMarketingView>) {
    return available ? bucketMarketingSample(view, view.windowRows, view.comparedRows) : [];
}

/** La bienvenida conserva la identidad de la sesión al filtrar por proyecto. */
function MarketingWelcome({ currentUser, scope, source }: { readonly currentUser: IdentityUser; readonly scope: MarketingScope; readonly source: readonly MarketingDirectoryRow[] }) {
    const name = currentUser.displayName.trim() || currentUser.email.trim();
    const firstName = name.split(/\s+/)[0] ?? "";
    return (
        <section className="marketing-welcome" aria-label="Bienvenida a Mercadeo">
            <div className="marketing-welcome__copy">
                <p className="marketing-welcome__title">{firstName ? `Hola, ${firstName}` : "Hola"}</p>
                <p className="marketing-welcome__text">{describeScope(scope, source)}</p>
                <a className="marketing-welcome__link" href="#marketing-preview-movement">
                    Ver cómo se mueven los leads
                </a>
            </div>
            <div className="marketing-welcome__people">
                <MarketingWelcomeArt publicId={null} name="" />
            </div>
        </section>
    );
}

/** Same banner anatomy as Formalization, with the trend drawn inside the card. */
function MarketingBanner({ title, value, caption, hint, icon, tone, delta, series, context }: MarketingBannerProps) {
    return (
        <article className={`marketing-banner marketing-banner--${tone}`}>
            <span className="marketing-banner__icon" aria-hidden="true">
                {icon}
            </span>
            <div className="marketing-banner__content">
                <h2>
                    {title}
                    {hint && <InfoHint label={title}>{hint}</InfoHint>}
                </h2>
                <strong aria-label={`${title}: ${value}`}>{value}</strong>
                <span className="marketing-banner__caption">{caption}</span>
                {delta && <DeltaText delta={delta} {...(context ? { context } : {})} />}
            </div>
            {series.length > 0 && (
                <span className="marketing-banner__trend">
                    <SparkArea values={series} />
                </span>
            )}
            <span className="marketing-banner__pattern" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                    <i key={index} style={{ width: 64 - index * 8, height: 64 - index * 8 }} />
                ))}
            </span>
        </article>
    );
}

/** Directory associations come from real cohort rows and event lead links, without manufacturing zero-lead rows. */
function marketingDirectory(summary: MarketingApiSummary): MarketingDirectoryRow[] {
    const sellers = new Map(summary.sellers.map((seller) => [seller.id, seller]));
    const projects = new Map(summary.projects.map((project) => [project.id, project]));
    const links = [...summary.rows, ...appointmentDirectoryLinks(summary.appointments)];
    const directory = new Map<string, MarketingDirectoryRow>();
    for (const link of links) directory.set(JSON.stringify([link.sellerId, link.projectId]), { seller: link.sellerId, project: link.projectId, sellerName: sellers.get(link.sellerId)?.name ?? "Sin vendedor", sellerPublicId: sellers.get(link.sellerId)?.publicId ?? null, projectName: projects.get(link.projectId)?.name ?? "Sin proyecto" });
    return [...directory.values()];
}

function connectedPresentation(value: MarketingApiSummary | null | undefined) {
    if (!value) return { appointmentsAvailable: false };
    return { rows: marketingRows(value), today: parseISODate(value.today) ?? undefined, appointmentsAvailable: value.appointments.available, appointmentEvents: value.appointments.available ? value.appointments.events : undefined, directory: marketingDirectory(value), dataQuality: value.appointments };
}
function summarizeOptionalAppointments(events: readonly MarketingAppointmentEvent[] | undefined, period: Parameters<typeof summarizeAppointmentEvents>[1], scope: MarketingScope) {
    return events ? summarizeAppointmentEvents(events, period, scope) : undefined;
}
function appointmentDirectoryLinks(appointments: MarketingApiSummary["appointments"]) {
    return appointments.available ? appointments.events.flatMap((event) => event.links) : [];
}

function marketingSources(rows: readonly MarketingSampleRow[] | undefined, directory: readonly MarketingDirectoryRow[] | undefined) {
    const source = rows ?? EMPTY_MARKETING_ROWS;
    return { source, dimensions: directory ?? source };
}
function MarketingDataQuality({ value }: { readonly value: MarketingApiSummary["appointments"] | undefined }) {
    if (!value?.available) return null;
    const { unresolvedLinks, invalidDates, unknownStatuses } = value.quality;
    if (unresolvedLinks + invalidDates + unknownStatuses === 0) return null;
    const issues = [unresolvedLinks > 0 ? `${String(unresolvedLinks)} citas sin lead asociado no se cuentan.` : "", invalidDates > 0 ? `${String(invalidDates)} citas con fecha inválida no se cuentan.` : "", unknownStatuses > 0 ? `${String(unknownStatuses)} citas con estado desconocido no se cuentan.` : ""].filter(Boolean);
    return (
        <p className="marketing-demo-notice" role="status">
            {issues.join(" ")}
        </p>
    );
}
