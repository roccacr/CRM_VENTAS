import "./MarketingHomePage.css";

import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";
import UserAddOutlined from "@ant-design/icons/UserAddOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import { type ReactNode, useState } from "react";

import type { IdentityUser } from "../../services/auth/identity-contracts";
import { countFormat, describeChange, describeRange, type MarketingDelta, percentFormat } from "./marketing-home-format";
import {
    alertMarketingSample,
    bucketMarketingSample,
    emptyMarketingFilters,
    groupMarketingSample,
    MARKETING_SAMPLE,
    type MarketingPeriodMode,
    type MarketingPreviewFilters,
    recentWithoutAppointment,
    recentWithoutAppointmentSeries,
    relativeChange,
    resolveMarketingView,
    summarizeMarketingSample,
} from "./marketing-home-preview.model";
import { buildProjectCards } from "./marketing-home-projects";
import { LeadsAreaChart, SparkArea } from "./MarketingHomeCharts";
import { MarketingProjects, MarketingSellers } from "./MarketingHomePanels";
import { DeltaText, MarketingAlerts } from "./MarketingHomeSections";

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
    readonly icon: ReactNode;
    readonly tone: BannerTone;
    readonly delta: MarketingDelta | null;
    readonly series: readonly number[];
    readonly context?: string;
}

/** Compares a rate with the previous one, only when the comparison had something to compare. */
const rateChange = (current: number, previous: number, hasPrevious: boolean) => (hasPrevious ? describeChange(current - previous, "puntos") : null);

interface BannerInput {
    readonly totals: Totals;
    readonly before: Totals;
    readonly context: string;
    readonly buckets: ReturnType<typeof bucketMarketingSample>;
    readonly followUp: { readonly value: number; readonly series: readonly number[] };
}

/** Four cards, each with its own trend: how many leads, how many reach an appointment, how many visits happened and what still needs follow-up. */
function buildBanners({ totals, before, context, buckets, followUp }: BannerInput): readonly MarketingBannerProps[] {
    return [
        { title: "Leads captados", value: countFormat.format(totals.leads), caption: "Personas que mostraron interés", icon: <UserAddOutlined />, tone: "neutral", delta: describeChange(relativeChange(totals.leads, before.leads), "%"), series: buckets.map((bucket) => bucket.leads), context },
        {
            title: "% de leads con cita",
            value: `${percentFormat.format(totals.rate)} %`,
            caption: `${countFormat.format(totals.withAppointment)} de ${countFormat.format(totals.leads)} leads`,
            icon: <RiseOutlined />,
            tone: "success",
            delta: rateChange(totals.rate, before.rate, before.leads > 0),
            series: buckets.map((bucket) => (bucket.leads ? (bucket.withAppointment / bucket.leads) * 100 : 0)),
            context,
        },
        {
            title: "Citas realizadas",
            value: countFormat.format(totals.attended),
            caption: totals.attended + totals.missed > 0 ? `Asistencia ${percentFormat.format(totals.attendance)} % · ${countFormat.format(totals.pending)} pendientes` : `${countFormat.format(totals.pending)} pendientes, aún no vencen`,
            icon: <CheckCircleOutlined />,
            tone: "success",
            // Recent appointments are still pending, so comparing completed visits would read as a false drop.
            delta: null,
            series: buckets.map((bucket) => bucket.attended),
        },
        { title: "Leads sin cita (últimos 7 días)", value: countFormat.format(followUp.value), caption: "Captados sin visita agendada", icon: <UserOutlined />, tone: "pending", delta: null, series: followUp.series },
    ];
}

interface ControlsProps {
    readonly period: HomePeriod;
    readonly seller: string;
    readonly summary: string;
    readonly onPeriod: (period: HomePeriod) => void;
    readonly onSeller: (seller: string) => void;
}

/** Period and seller are the only controls; everything else is a global view, with the detail in "Captación de leads". */
function MarketingControls({ period, seller, summary, onPeriod, onSeller }: ControlsProps) {
    return (
        <section className="marketing-bar" aria-label="Periodo y vendedor">
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
                <span>Vendedor</span>
                <select
                    aria-label="Vendedor"
                    value={seller}
                    onChange={(event) => {
                        onSeller(event.target.value);
                    }}
                >
                    <option value="">Todos los vendedores</option>
                    {[...new Set(MARKETING_SAMPLE.map((row) => row.seller))].sort().map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </label>
            <p className="marketing-bar__summary">{summary}</p>
        </section>
    );
}

/** Local, explicitly fictional design proposal. No API, persistent state or business actions. */
export function MarketingHomePage({ currentUser }: { readonly currentUser: IdentityUser }) {
    const name = currentUser.displayName.trim() || currentUser.email.trim();
    const [period, setPeriod] = useState<HomePeriod>("month");
    const [seller, setSeller] = useState("");
    const base = emptyMarketingFilters();
    const filters: MarketingPreviewFilters = { ...base, seller, selection: { ...base.selection, mode: period } };
    const copy = HOME_PERIODS.find((item) => item.key === period) ?? DEFAULT_PERIOD;
    const view = resolveMarketingView(filters);
    const totals = summarizeMarketingSample(view.rows);
    const buckets = bucketMarketingSample(view, view.windowRows, view.comparedRows);
    const summary = `${describeRange(view.period)} · comparado con ${copy.against}`;
    const [first, ...others] = buildBanners({
        totals,
        before: summarizeMarketingSample(view.previousRows),
        context: copy.against,
        buckets,
        followUp: { value: recentWithoutAppointment(filters, view.today), series: recentWithoutAppointmentSeries(filters, view.today) },
    });

    return (
        <div className="global-home-dashboard marketing-home">
            <section className="global-home-page-header" aria-labelledby="marketing-home-title">
                <div>
                    <h1 id="marketing-home-title">Mercadeo</h1>
                    <p>Cómo van los leads: cuántos llegan, cuántos avanzan a una cita y quién los atiende.</p>
                </div>
                <span className="marketing-demo-badge">Datos de demostración</span>
            </section>
            <p className="marketing-demo-notice">Sin conexión a API. Proyectos, vendedores y cifras ficticios para revisar el diseño.</p>
            <MarketingControls period={period} seller={seller} summary={summary} onPeriod={setPeriod} onSeller={setSeller} />
            <div className="marketing-preview-banners">
                {first && <MarketingBanner key={first.title} {...first} />}
                <section className="marketing-welcome" aria-label="Bienvenida a Mercadeo">
                    <div className="marketing-welcome__copy">
                        <p className="marketing-welcome__title">{name ? `Hola, ${name}` : "Hola"}</p>
                        <p className="marketing-welcome__text">{seller ? `Viendo lo de ${seller}` : "Captación de leads y citas"}</p>
                        <a className="marketing-welcome__link" href="#marketing-preview-movement">
                            Ver cómo se mueven los leads
                        </a>
                    </div>
                    <img className="marketing-welcome__art" src={`${import.meta.env.BASE_URL}illustrations/rocca-marketing-generated.png`} alt="" width={1774} height={887} decoding="async" />
                </section>
                {others.map((banner) => (
                    <MarketingBanner key={banner.title} {...banner} />
                ))}
            </div>
            <MarketingAlerts alerts={alertMarketingSample(view)} />
            <LeadsAreaChart title={copy.chart} subtitle={summary} buckets={buckets} comparisonLabel={`Comparación (${copy.against})`} unit={copy.unit} />
            <MarketingProjects cards={buildProjectCards(filters, view)} periodWord={copy.word} seller={seller} />
            <MarketingSellers groups={groupMarketingSample(resolveMarketingView({ ...filters, seller: "" }), "seller")} selected={seller} onSelect={setSeller} />
        </div>
    );
}

/** Same banner anatomy as Formalization, with the trend drawn inside the card. */
function MarketingBanner({ title, value, caption, icon, tone, delta, series, context }: MarketingBannerProps) {
    return (
        <article className={`marketing-banner marketing-banner--${tone}`}>
            <span className="marketing-banner__icon" aria-hidden="true">
                {icon}
            </span>
            <div className="marketing-banner__content">
                <h2>{title}</h2>
                <strong aria-label={`${title}: ${value}`}>{value}</strong>
                <span className="marketing-banner__caption">{caption}</span>
                {delta && <DeltaText delta={delta} {...(context ? { context } : {})} />}
            </div>
            <span className="marketing-banner__trend">
                <SparkArea values={series} />
            </span>
            <span className="marketing-banner__pattern" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                    <i key={index} style={{ width: 64 - index * 8, height: 64 - index * 8 }} />
                ))}
            </span>
        </article>
    );
}
