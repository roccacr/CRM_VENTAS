import { type KeyboardEvent, type PointerEvent, useId, useState } from "react";

import { areaPath, type ChartPoint, niceMaximum, smoothPath, toPoints } from "./marketing-chart-geometry";
import { countFormat } from "./marketing-home-format";
import type { MarketingBucket } from "./marketing-home-preview.model";

const WIDTH = 1000;
const HEIGHT = 300;

/** Gradient ids go into `url(#…)`, so React's colon-separated ids are cleaned first. */
const useSvgId = (prefix: string): string => `${prefix}${useId().replaceAll(":", "")}`;

/** Small trend line with a soft fill, used inside cards. Decorative: the number next to it carries the data. */
export function SparkArea({ values }: { readonly values: readonly number[] }) {
    const gradient = useSvgId("spark");
    const points = toPoints(values, Math.max(1, ...values) * 1.15, 100, 30);
    return (
        <svg className="marketing-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaPath(points, 30)} fill={`url(#${gradient})`} />
            <path d={smoothPath(points, 30)} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

interface AreaChartProps {
    readonly title: string;
    readonly buckets: readonly MarketingBucket[];
    readonly comparisonLabel: string;
    readonly currentLabel?: string;
    readonly unit: string;
}

/** Gridline values: the first step count that splits the axis into whole numbers, or one per unit when the axis is tiny. */
const axisTicks = (maximum: number): number[] => {
    const steps = maximum < 4 ? maximum : ([4, 5, 2].find((count) => maximum % count === 0) ?? 4);
    return Array.from({ length: steps + 1 }, (_, index) => (maximum * index) / steps);
};

/** Axis labels thin out on long series so they never overlap, and the last one never crowds its neighbour. */
const labelStep = (count: number): number => Math.ceil(count / 8);
const showsLabel = (index: number, count: number): boolean => {
    const step = labelStep(count);
    const last = count - 1;
    return index === last || (index % step === 0 && last - index >= Math.ceil(step / 2));
};

/** Which point is under the pointer or the keyboard cursor; null when none is. */
function useChartCursor(count: number) {
    const [active, setActive] = useState<number | null>(null);
    const last = Math.max(0, count - 1);
    const clamp = (index: number): number => Math.min(last, Math.max(0, index));
    return {
        active,
        clear: () => {
            setActive(null);
        },
        pick: (event: PointerEvent<HTMLDivElement>) => {
            const box = event.currentTarget.getBoundingClientRect();
            setActive(clamp(Math.round((box.width > 0 ? (event.clientX - box.left) / box.width : 0) * last)));
        },
        move: (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setActive((index) => clamp((index ?? last) + (event.key === "ArrowRight" ? 1 : -1)));
        },
    };
}

/** Vertical cursor, point marker and tooltip for the active point; nothing when no point is active. */
function ChartReadout({ bucket, point }: { readonly bucket: MarketingBucket | null; readonly point: ChartPoint | null }) {
    if (!bucket || !point) return null;
    const left = (point.x / WIDTH) * 100;
    const top = (point.y / HEIGHT) * 100;
    return (
        <>
            <span className="marketing-area__cursor" style={{ left: `${String(left)}%` }} aria-hidden="true" />
            <span className="marketing-area__dot" style={{ left: `${String(left)}%`, top: `${String(top)}%` }} aria-hidden="true" />
            <span className="marketing-area__tooltip" style={{ left: `${String(Math.min(88, Math.max(12, left)))}%`, top: `${String(Math.max(0, top - 14))}%` }} aria-hidden="true">
                <strong>{countFormat.format(bucket.leads)} leads</strong>
                <small>
                    {bucket.label} · antes {countFormat.format(bucket.compared)}
                </small>
            </span>
        </>
    );
}

/** The main chart: leads over time against the comparison, with a hover or keyboard read-out for every point. */
export function LeadsAreaChart({ title, buckets, comparisonLabel, currentLabel = "Periodo seleccionado", unit }: AreaChartProps) {
    const headingId = useSvgId("area-title");
    const gradient = useSvgId("area-fill");
    const { active, clear, pick, move } = useChartCursor(buckets.length);
    const maximum = niceMaximum(Math.max(0, ...buckets.flatMap((bucket) => [bucket.leads, bucket.compared])));
    const current = toPoints(
        buckets.map((bucket) => bucket.leads),
        maximum,
        WIDTH,
        HEIGHT,
    );
    const compared = toPoints(
        buckets.map((bucket) => bucket.compared),
        maximum,
        WIDTH,
        HEIGHT,
    );
    const ticks = axisTicks(maximum);
    const lastIndex = Math.max(0, buckets.length - 1);
    const focused = active === null ? null : (buckets[active] ?? null);
    const marker = active === null ? null : (current[active] ?? null);

    if (buckets.length === 0)
        return (
            <section id="marketing-preview-movement" className="marketing-card marketing-area" aria-labelledby={headingId}>
                <div className="marketing-card__heading">
                    <div>
                        <h2 id={headingId}>{title}</h2>
                    </div>
                </div>
                <p className="marketing-preview-empty marketing-area__empty">Información pendiente para mostrar el gráfico.</p>
            </section>
        );

    return (
        <section id="marketing-preview-movement" className="marketing-card marketing-area" aria-labelledby={headingId}>
            <div className="marketing-card__heading">
                <div>
                    <h2 id={headingId}>{title}</h2>
                </div>
                <ul className="marketing-legend" aria-label="Leyenda">
                    <li>
                        <i className="marketing-legend__leads" aria-hidden="true" />
                        {currentLabel}
                    </li>
                    <li>
                        <i className="marketing-legend__compared" aria-hidden="true" />
                        {comparisonLabel}
                    </li>
                </ul>
            </div>
            <div className="marketing-area__frame">
                <div className="marketing-area__plot" role="group" tabIndex={0} aria-label={`Gráfico de leads por ${unit}. Usa las flechas para recorrer cada punto.`} onPointerMove={pick} onPointerLeave={clear} onKeyDown={move} onBlur={clear}>
                    {ticks.map((tick) => (
                        <div key={tick} className="marketing-area__grid" style={{ top: `${String((1 - tick / maximum) * 100)}%` }}>
                            <span>{countFormat.format(Math.round(tick))}</span>
                        </div>
                    ))}
                    <svg viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
                        <defs>
                            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#496180" stopOpacity="0.32" />
                                <stop offset="100%" stopColor="#496180" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path d={areaPath(current, HEIGHT)} fill={`url(#${gradient})`} />
                        <path d={smoothPath(compared, HEIGHT)} fill="none" stroke="#98a4b3" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
                        <path d={smoothPath(current, HEIGHT)} fill="none" stroke="#496180" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                    <ChartReadout bucket={focused} point={marker} />
                </div>
                <div className="marketing-area__axis" aria-hidden="true">
                    {buckets.map((bucket, index) =>
                        showsLabel(index, buckets.length) ? (
                            <span key={bucket.label + String(index)} style={{ left: `${String(lastIndex ? (index / lastIndex) * 100 : 50)}%` }}>
                                {bucket.label}
                            </span>
                        ) : null,
                    )}
                </div>
            </div>
            <p className="marketing-sr-only" aria-live="polite">
                {focused ? `${focused.label}: ${String(focused.leads)} leads, antes ${String(focused.compared)}.` : ""}
            </p>
            <table className="marketing-sr-only">
                <caption>Leads por {unit}</caption>
                <thead>
                    <tr>
                        <th scope="col">{unit}</th>
                        <th scope="col">{currentLabel}</th>
                        <th scope="col">{comparisonLabel}</th>
                    </tr>
                </thead>
                <tbody>
                    {buckets.map((bucket, index) => (
                        <tr key={bucket.label + String(index)}>
                            <th scope="row">{bucket.label}</th>
                            <td>{bucket.leads}</td>
                            <td>{bucket.compared}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
