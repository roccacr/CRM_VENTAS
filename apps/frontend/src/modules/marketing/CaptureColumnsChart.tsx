import Select from "antd/es/select";
import { useState } from "react";

import { percentFormat } from "../home/marketing-home-format";
import { capturePeriodProjects } from "./capture-time-groups";
import { type CaptureMeasure, type PathRow, sellerTone as groupTone } from "./lead-capture-report";

type ChartMode = "count" | "percent";
interface Props {
    readonly groups: readonly PathRow[];
    readonly label: string;
    readonly measure?: CaptureMeasure;
    readonly defaultLimit?: number;
    readonly chronological?: boolean;
}
const AREA_PX = 380;
const TOTAL_LABEL_PX = 20;
const MIN_COLUMN_PX = 14;
const HEADROOM_PX = 24;
const LIMITS = [10, 15, 30, 0] as const;
const PERCENT_LABELS: Record<CaptureMeasure, string> = { leads: "% del total", appointments: "% de los leads", lost: "% de los leads", lossReasons: "% de los perdidos" };

/** Conserva la escala visual del reporte y un cuerpo visible incluso para un total de uno. */
const columnHeight = (total: number, maximum: number): number => TOTAL_LABEL_PX + MIN_COLUMN_PX + (AREA_PX - HEADROOM_PX - TOTAL_LABEL_PX - MIN_COLUMN_PX) * Math.sqrt(total / maximum);

/** Agrega antes de calcular porcentajes: citas/perdidos usan los leads del mismo proyecto, campaña o anuncio. */
function chartView(source: readonly PathRow[], measure: CaptureMeasure, mode: ChartMode, { limit, chronological }: { limit: number; chronological: boolean }) {
    const grand = source.reduce((sum, group) => sum + group.value, 0);
    const all = source.map((group) => {
        const base = measure === "leads" || measure === "lossReasons" ? grand : group.detail.leads;
        return { ...group, value: mode === "percent" ? (base > 0 ? (group.value / base) * 100 : 0) : group.value };
    });
    const ranked = chronological ? all : all.filter((group) => group.value > 0).sort((a, b) => b.value - a.value || a.path.join().localeCompare(b.path.join(), "es"));
    const groups = limit > 0 ? ranked.slice(0, limit) : ranked;
    return { groups, empty: chronological ? [] : all.filter((group) => group.value === 0), hidden: ranked.length - groups.length, maximum: Math.max(1e-9, ...groups.map((group) => group.value)) };
}

function OmittedNote({ empty, hidden, onShowAll }: { readonly empty: readonly PathRow[]; readonly hidden: number; readonly onShowAll: () => void }) {
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

interface ControlsProps {
    readonly mode: ChartMode;
    readonly measure: CaptureMeasure;
    readonly onMode: (mode: ChartMode) => void;
    readonly limit: number;
    readonly onLimit: (limit: number) => void;
    readonly showLimit: boolean;
    readonly chronological: boolean;
}

function ChartControls({ mode, measure, onMode, limit, onLimit, showLimit, chronological }: ControlsProps) {
    return (
        <div className="capture-columns-chart__controls">
            {showLimit && !chronological && (
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
                        { value: "percent", label: PERCENT_LABELS[measure] },
                    ]}
                />
            </label>
        </div>
    );
}

/** Una columna y un color por proyecto, campaña o anuncio; nunca se divide por responsable. */
export function CaptureColumnsChart({ groups: source, label, measure = "leads", defaultLimit = 0, chronological = false }: Props) {
    const [mode, setMode] = useState<ChartMode>("count");
    const [limit, setLimit] = useState(defaultLimit);
    const { groups, empty, hidden, maximum } = chartView(source, measure, mode, { limit, chronological });
    const legend = [...new Map(groups.map((group) => [group.colorKey ?? group.key, { key: group.colorKey ?? group.key, label: chronological ? group.path.slice(1).join(" › ") : group.path.at(-1) }])).values()];
    const format = (value: number) => (mode === "percent" ? `${percentFormat.format(value)} %` : String(value));
    return (
        <figure className="capture-columns-chart" aria-label={label}>
            <div className="capture-columns-chart__top">
                <ul className="capture-columns-chart__legend" aria-hidden="true">
                    {legend.map((item) => (
                        <li key={item.key} title={item.label}>
                            <i className="capture-series" style={{ backgroundColor: groupTone(item.key).color }} />
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
                <ChartControls mode={mode} measure={measure} onMode={setMode} limit={limit} onLimit={setLimit} showLimit={source.length > LIMITS[0]} chronological={chronological} />
            </div>
            <p className="capture-columns-chart__caption">
                {chronological ? "Agrupado por proyecto y luego por período. Misma escala para todos; los intervalos sin registros se muestran con cero." : "Ordenado de mayor a menor."} Agrupación: {label.toLocaleLowerCase("es")}.
            </p>
            {chronological ? (
                <div className="capture-period-projects">
                    {capturePeriodProjects(groups).map((project) => (
                        <section key={project.key} className="capture-period-project" role="group" aria-label={project.label}>
                            <h3>{project.label}</h3>
                            <div className="capture-period-project__bars">
                                {project.items.map((group) => (
                                    <ChartColumn key={group.key} group={group} maximum={maximum} format={format} compact />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <div className="capture-columns-chart__plot capture-columns-chart__plot--row">
                    <div className="capture-columns-chart__track" style={{ ["--columns" as string]: groups.length }}>
                        {groups.map((group) => (
                            <ChartColumn key={group.key} group={group} maximum={maximum} format={format} />
                        ))}
                    </div>
                </div>
            )}
            {groups.length === 0 && <p className="capture-empty">Sin datos para este gráfico en este periodo.</p>}
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

function ChartColumn({ group, maximum, format, compact = false }: { readonly group: PathRow; readonly maximum: number; readonly format: (value: number) => string; readonly compact?: boolean }) {
    return (
        <div className="capture-columns-chart__group">
            <div className="capture-columns-chart__bars capture-columns-chart__bars--stacked" style={{ height: `${String(compact ? AREA_PX / 2 : AREA_PX)}px` }}>
                <div className="capture-columns-chart__stack-wrap" style={{ height: `${String(group.value === 0 ? TOTAL_LABEL_PX : columnHeight(group.value, maximum) / (compact ? 2 : 1))}px` }}>
                    <strong>{format(group.value)}</strong>
                    <div className="capture-columns-chart__stack">{group.value > 0 && <span className="capture-columns-chart__segment" title={`${group.path.join(" › ")}: ${format(group.value)}`} style={{ backgroundColor: groupTone(group.colorKey ?? group.key).color, flexGrow: 1 }} />}</div>
                </div>
            </div>
            <span className="capture-columns-chart__label">
                {(compact ? group.path.slice(0, 1) : group.path).map((part, level) => (
                    <span key={`${String(level)}:${part}`} className={`capture-columns-chart__line capture-columns-chart__line--${String(level)}`}>
                        {part}
                    </span>
                ))}
            </span>
            <span className="marketing-sr-only">
                {group.path.join(" › ")}: {format(group.value)}
            </span>
        </div>
    );
}
