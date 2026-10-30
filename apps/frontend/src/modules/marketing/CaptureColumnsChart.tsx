import Select from "antd/es/select";
import { useState } from "react";

import { percentFormat } from "../home/marketing-home-format";
import { type CaptureMeasure, type CaptureSeller, type ChartGroup, sellerTone, SERIES } from "./lead-capture-report";
import { SellerChip } from "./SellerAvatar";

type ChartMode = "count" | "percent";
type Tone = ReturnType<typeof sellerTone>;

interface Props {
    readonly sellers: readonly CaptureSeller[];
    readonly groups: readonly ChartGroup[];
    readonly label: string;
    /** What is being measured: it decides what "percent" is a share of. */
    readonly measure?: CaptureMeasure;
    /** One column per group with each seller's part stacked inside it, biggest first, . */
    readonly stacked?: boolean;
    /** Columns drawn at first (0 = all). The select lets the person widen it. */
    readonly defaultLimit?: number;
    /** One seller's own chart inside a card: shorter, no legend, no selects. */
    readonly compact?: boolean;
}

interface BarsProps {
    readonly sellers: readonly CaptureSeller[];
    readonly tones: readonly Tone[];
    readonly values: readonly number[];
    readonly maximum: number;
    /** Pixel height of this stacked column and of the area it grows in. */
    readonly height: number;
    readonly area: number;
    readonly format: (value: number) => string;
}

/** Height of the drawing area. */
const AREA_PX = 380;
/** Per-seller charts sit side by side, so they are shorter and carry no legend or controls. */
const COMPACT_AREA_PX = 250;
const COMPACT_LIMIT = 8;
const TOTAL_LABEL_PX = 20;
/** Even the smallest column keeps a visible body, so a figure of 1 is still a column and not a hairline. */
const MIN_COLUMN_PX = 14;
/** Free room above the tallest column, so its dot and figure do not collide. */
const HEADROOM_PX = 24;
/** A segment shorter than this carries no figure (it would not fit); its tooltip still has it. */
const MIN_LABELLED_SEGMENT_PX = 15;
const LIMITS = [10, 15, 30, 0] as const;
/** Past this many sellers each one gets its own colour only if it is among the biggest; the rest are one grey "Otros" series. */
const MAX_SERIES = 8;
const OTHERS_ID = "__others";
const OTHERS_TONE: Tone = { color: "#9aa7b8", ink: "#18222f", tint: "#f1f4f8" };

/** A new project starts after a visible divider, so campaigns of one project read as a block. */
const startsProject = (groups: readonly ChartGroup[], index: number): boolean => index > 0 && groups[index]?.path[0] !== groups[index - 1]?.path[0];
const sumOf = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);
const formatCount = (value: number): string => String(value);
const formatPercent = (value: number): string => `${percentFormat.format(value)} %`;

/**
 * Column height from its total on a square-root scale: a column of 400 is not 40 times a column of 10, so the small ones stay
 * readable, and a bigger total is always taller than a smaller one. The figures printed on every column keep it honest.
 */
const columnHeight = (total: number, maximum: number, area: number): number => TOTAL_LABEL_PX + MIN_COLUMN_PX + (area - HEADROOM_PX - TOTAL_LABEL_PX - MIN_COLUMN_PX) * Math.sqrt(total / maximum);

/**
 * Percent view. Leads: each part is a share of every lead in the chart. Lost / with appointment: each part is a share of the leads of
 * its own group, so a column's total reads as "what part of this project's leads" and its pieces say who contributed how much of it.
 */
function toPercent(groups: readonly ChartGroup[], measure: CaptureMeasure): ChartGroup[] {
    const grand = sumOf(groups.flatMap((group) => group.values));
    return groups.map((group) => {
        const base = measure === "leads" ? grand : sumOf(group.leads ?? []);
        return { ...group, values: group.values.map((value) => (base > 0 ? (value / base) * 100 : 0)) };
    });
}

/**
 * Twenty-six colours cannot be told apart, so with many sellers the biggest ones stay and the rest are summed into one series: nothing is
 * dropped from the totals, and the legend stays short. Hover on a segment still names its seller; the detail table lists everybody.
 */
function collapseSellers(sellers: readonly CaptureSeller[], groups: readonly ChartGroup[]): { readonly sellers: readonly CaptureSeller[]; readonly groups: readonly ChartGroup[]; readonly tones: readonly Tone[] } {
    if (sellers.length <= MAX_SERIES) return { sellers, groups, tones: sellers.map((seller) => sellerTone(seller.id)) };
    const totals = sellers.map((_, index) => sumOf(groups.map((group) => group.values[index] ?? 0)));
    const order = sellers.map((_, index) => index).sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
    const kept = order.slice(0, MAX_SERIES - 1);
    const rest = order.slice(MAX_SERIES - 1);
    const others: CaptureSeller = { id: OTHERS_ID, name: `Otros (${String(rest.length)})`, publicId: null };
    const pick = (values: readonly number[] | undefined) => [...kept.map((index) => values?.[index] ?? 0), sumOf(rest.map((index) => values?.[index] ?? 0))];
    return {
        sellers: [...kept.map((index) => sellers[index] as CaptureSeller), others],
        groups: groups.map((group) => ({ ...group, values: pick(group.values), ...(group.leads ? { leads: pick(group.leads) } : {}) })),
        tones: [...kept.map((_, rank) => ({ ...(SERIES[rank] as (typeof SERIES)[number]), tint: "#f7f9fc" })), OTHERS_TONE],
    };
}

/** Side by side: one column per seller, on the same scale, each with its figure. */
function ClusteredBars({ sellers, tones, values, maximum, format }: BarsProps) {
    return (
        <div className="capture-columns-chart__bars">
            {values.map((value, index) =>
                value > 0 ? (
                    <div className="capture-columns-chart__bar" key={sellers[index]?.id} title={`${sellers[index]?.name ?? ""}: ${format(value)}`}>
                        <strong>{format(value)}</strong>
                        <i className="capture-series" style={{ backgroundColor: tones[index]?.color, height: `calc((100% - 20px) * ${String(value / maximum)})` }} />
                    </div>
                ) : null,
            )}
        </div>
    );
}

/** The figure inside a segment: only when there are several sellers to tell apart and the segment is tall enough to hold it. */
function segmentLabel({ height, value, total, parts, format }: { readonly height: number; readonly value: number; readonly total: number; readonly parts: number; readonly format: (value: number) => string }): string {
    if (parts < 2) return "";
    return ((height - TOTAL_LABEL_PX) * value) / total >= MIN_LABELLED_SEGMENT_PX ? format(value) : "";
}

/** One column per group: each seller's part is a segment on top of the other, the total sits above, so the project and who built it read together. */
function StackedBars({ sellers, tones, values, height, area, format }: BarsProps) {
    const total = sumOf(values);
    return (
        <div className="capture-columns-chart__bars capture-columns-chart__bars--stacked" style={{ height: `${String(area)}px` }}>
            <div className="capture-columns-chart__stack-wrap" style={{ height: `${String(height)}px` }}>
                <strong>{format(total)}</strong>
                <div className="capture-columns-chart__stack">
                    {values.map((value, index) =>
                        value > 0 ? (
                            <span className="capture-columns-chart__segment" key={sellers[index]?.id} title={`${sellers[index]?.name ?? ""}: ${format(value)}`} style={{ backgroundColor: tones[index]?.color, color: tones[index]?.ink, flexGrow: value }}>
                                {segmentLabel({ height, value, total, parts: values.length, format })}
                            </span>
                        ) : null,
                    )}
                </div>
            </div>
        </div>
    );
}

/** What to draw: groups with something to show (biggest first, up to the limit), those left out, the common scale and how figures are written. */
function chartView(source: readonly ChartGroup[], { measure, mode, limit, area }: { readonly measure: CaptureMeasure; readonly mode: ChartMode; readonly limit: number; readonly area: number }) {
    const all = mode === "percent" ? toPercent(source, measure) : source;
    // A group with nothing to draw would be an empty slot: it is left out and named below, the table still lists it.
    const ranked = all.filter((group) => group.values.some((value) => value > 0)).sort((a, b) => sumOf(b.values) - sumOf(a.values) || a.label.localeCompare(b.label, "es"));
    const groups = limit > 0 ? ranked.slice(0, limit) : ranked;
    const maximum = Math.max(1e-9, ...groups.map((group) => sumOf(group.values)));
    return { groups, empty: all.filter((group) => !group.values.some((value) => value > 0)), hidden: ranked.length - groups.length, maximum, area, heights: groups.map((group) => columnHeight(sumOf(group.values), maximum, area)), format: mode === "percent" ? formatPercent : formatCount };
}

/** One short line about what is not drawn: a button to see the rest, and how many have nothing to show (their names are in the tooltip, the full list in the table). */
function OmittedNote({ empty, hidden, onShowAll }: { readonly empty: readonly ChartGroup[]; readonly hidden: number; readonly onShowAll: () => void }) {
    if (empty.length === 0 && hidden === 0) return null;
    return (
        <p className="capture-columns-chart__empty">
            {hidden > 0 && (
                <button type="button" onClick={onShowAll}>
                    Ver las {hidden} columnas restantes
                </button>
            )}
            {empty.length > 0 && <span title={empty.map((group) => group.path.join(" › ")).join(", ")}>{empty.length === 1 ? "1 sin datos en esta medida" : `${String(empty.length)} sin datos en esta medida`} · ver tabla</span>}
        </p>
    );
}

function Legend({ sellers, tones }: { readonly sellers: readonly CaptureSeller[]; readonly tones: readonly Tone[] }) {
    return (
        <ul className="capture-columns-chart__legend" aria-hidden="true">
            {sellers.map((seller, index) => (
                <li key={seller.id}>
                    <i className="capture-series" style={{ backgroundColor: tones[index]?.color }} />
                    {seller.id === OTHERS_ID ? <span>{seller.name}</span> : <SellerChip publicId={seller.publicId} name={seller.name} size={24} />}
                </li>
            ))}
        </ul>
    );
}

function ChartHeader({ sellers, tones, controls }: { readonly sellers: readonly CaptureSeller[]; readonly tones: readonly Tone[]; readonly controls: ControlsProps }) {
    return (
        <>
            <div className="capture-columns-chart__top">
                <Legend sellers={sellers} tones={tones} />
                <ChartControls {...controls} />
            </div>
            <p className="capture-columns-chart__caption">Ordenado de mayor a menor. Cada color es un vendedor.</p>
        </>
    );
}

interface ControlsProps {
    readonly mode: ChartMode;
    readonly measure: CaptureMeasure;
    readonly onMode: (mode: ChartMode) => void;
    readonly limit: number;
    readonly onLimit: (limit: number) => void;
    readonly showLimit: boolean;
}

function ChartControls({ mode, measure, onMode, limit, onLimit, showLimit }: ControlsProps) {
    return (
        <div className="capture-columns-chart__controls">
            {showLimit && (
                <label className="capture-columns-chart__mode">
                    <span>Ver</span>
                    <Select size="small" aria-label="Cuántas columnas ver" value={limit} onChange={onLimit} options={LIMITS.map((value) => ({ value, label: value === 0 ? "Todos" : `Top ${String(value)}` }))} />
                </label>
            )}
            <label className="capture-columns-chart__mode">
                <span>Mostrar</span>
                <Select
                    size="small"
                    aria-label="Mostrar en el gráfico"
                    value={mode}
                    onChange={onMode}
                    options={[
                        { value: "count", label: "Cantidad" },
                        { value: "percent", label: measure === "leads" ? "% del total" : "% de los leads" },
                    ]}
                />
            </label>
        </div>
    );
}

interface PlotProps {
    readonly stacked: boolean;
    readonly sellers: readonly CaptureSeller[];
    readonly tones: readonly Tone[];
    readonly view: ReturnType<typeof chartView>;
}

/** The columns themselves, in a track as wide as all of them whether or not the row scrolls. */
function Plot({ stacked, sellers, tones, view }: PlotProps) {
    const { groups, maximum, heights, area, format } = view;
    const Bars = stacked ? StackedBars : ClusteredBars;
    return (
        <div className={stacked ? "capture-columns-chart__plot capture-columns-chart__plot--row" : "capture-columns-chart__plot"}>
            <div className="capture-columns-chart__track" style={{ ["--columns" as string]: groups.length }}>
                {groups.map((group, index) => (
                    <div className={startsProject(groups, index) ? "capture-columns-chart__group capture-columns-chart__group--project" : "capture-columns-chart__group"} key={group.key}>
                        <Bars sellers={sellers} tones={tones} values={group.values} maximum={maximum} height={heights[index] ?? 0} area={area} format={format} />
                        <span className="capture-columns-chart__label">
                            {group.path.map((part, level) => (
                                <span key={part} className={`capture-columns-chart__line capture-columns-chart__line--${String(level)}`}>
                                    {part}
                                </span>
                            ))}
                        </span>
                        <span className="marketing-sr-only">{group.values.map((value, position) => `${sellers[position]?.name ?? ""}: ${format(value)}`).join(", ")}</span>
                    </div>
                ))}
            </div>
            {groups.length === 0 && <p className="capture-empty">Sin datos para este gráfico en este periodo.</p>}
        </div>
    );
}

/**
 * Columns per group (a project, or project › campaign…), ranked from biggest to smallest. Stacked: one column per group with the sellers piled
 * inside it . Clustered: one column per seller. A seller with nothing in a group draws nothing (the legend keeps
 * the colours). The selects switch between counts and percentages and how many columns to draw.
 */
function ColumnsChart({ sellers: allSellers, groups: allGroups, label, measure, stacked, defaultLimit, compact }: Required<Props>) {
    const [mode, setMode] = useState<ChartMode>("count");
    const [limit, setLimit] = useState(compact ? COMPACT_LIMIT : defaultLimit);
    const { sellers, groups: source, tones } = collapseSellers(allSellers, allGroups);
    const view = chartView(source, { measure, mode, limit, area: compact ? COMPACT_AREA_PX : AREA_PX });
    const { groups, empty, hidden } = view;
    return (
        <figure className={compact ? "capture-columns-chart capture-columns-chart--compact" : "capture-columns-chart"} aria-label={label}>
            {!compact && <ChartHeader sellers={sellers} tones={tones} controls={{ mode, measure, onMode: setMode, limit, onLimit: setLimit, showLimit: source.length > LIMITS[0] }} />}
            <Plot stacked={stacked} sellers={sellers} tones={tones} view={view} />
            <OmittedNote
                empty={groups.length > 0 ? empty : []}
                hidden={hidden}
                onShowAll={() => {
                    setLimit(0);
                }}
            />
        </figure>
    );
}

/** Public entry: fills in the optional settings once, so the drawing code below deals with plain values. */
export function CaptureColumnsChart({ measure = "leads", stacked = false, defaultLimit = 0, compact = false, ...rest }: Props) {
    return <ColumnsChart {...rest} measure={measure} stacked={stacked} defaultLimit={defaultLimit} compact={compact} />;
}
