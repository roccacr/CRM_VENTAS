import { countFormat, describeChange, type MarketingDelta, percentFormat } from "./marketing-home-format";
import {
    type groupMarketingSample,
    MARKETING_DIMENSIONS,
    MARKETING_MIN_SAMPLE,
    type MarketingAlert,
    type MarketingDimension,
    type matrixMarketingSample,
    relativeChange,
    type summarizeMarketingSample,
} from "./marketing-home-preview.model";

type Totals = ReturnType<typeof summarizeMarketingSample>;

/** Change chip: green up, red down, neutral flat; a dash when there is nothing to compare with. */
export function DeltaText({ delta, context }: { readonly delta: MarketingDelta | null; readonly context?: string }) {
    if (!delta) return <>—</>;
    return (
        <span className={`marketing-delta marketing-delta--${delta.direction}`}>
            {delta.text}
            {context && <span className="marketing-delta__context"> vs. {context}</span>}
        </span>
    );
}

/** Tiny trend line; decorative because the numeric columns already carry the data. */
function Sparkline({ values }: { readonly values: readonly number[] }) {
    const max = Math.max(1, ...values);
    const step = values.length > 1 ? 72 / (values.length - 1) : 0;
    const points = values.map((value, index) => `${String(index * step)},${String(22 - (value / max) * 20)}`).join(" ");
    return (
        <svg className="marketing-sparkline" width="72" height="24" viewBox="0 0 72 24" aria-hidden="true" focusable="false">
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

/** Shown only when something needs a look; when everything is within range the block does not exist. */
export function MarketingAlerts({ alerts }: { readonly alerts: readonly MarketingAlert[] }) {
    if (alerts.length === 0) return null;
    return (
        <section className="marketing-alerts" aria-label="Atención">
            <h2>Atención</h2>
            <ul>
                {alerts.map((alert) => (
                    <li key={alert.key}>{alert.text}</li>
                ))}
            </ul>
        </section>
    );
}

interface BreakdownProps {
    readonly groups: ReturnType<typeof groupMarketingSample>;
    readonly totals: Totals;
    readonly previousLeads: number;
    readonly dimension: MarketingDimension;
    readonly onDimensionChange: (dimension: MarketingDimension) => void;
}

function BreakdownGrouping({ dimension, onDimensionChange }: Pick<BreakdownProps, "dimension" | "onDimensionChange">) {
    return (
        <div className="marketing-preview-grouping" role="group" aria-label="Agrupar desglose">
            {MARKETING_DIMENSIONS.map(({ key, label }) => (
                <button
                    key={key}
                    type="button"
                    aria-label={`Agrupar por ${label}`}
                    aria-pressed={dimension === key}
                    onClick={() => {
                        onDimensionChange(key);
                    }}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function BreakdownRow({ group, maxLeads, flagLow }: { readonly group: BreakdownProps["groups"][number]; readonly maxLeads: number; readonly flagLow: boolean }) {
    return (
        <tr>
            <th scope="row">
                {group.name}
                {flagLow && group.leads < MARKETING_MIN_SAMPLE && <span className="marketing-low-sample">Pocos leads</span>}
                <span className="marketing-volume-track" aria-hidden="true">
                    <i style={{ width: `${String((group.leads / maxLeads) * 100)}%` }} />
                </span>
            </th>
            <td>{countFormat.format(group.leads)}</td>
            <td>
                <DeltaText delta={group.previousLeads === 0 && group.leads > 0 ? { direction: "flat", text: "Nuevo" } : describeChange(group.change, "%")} />
            </td>
            <td>{group.leads > 0 ? `${percentFormat.format(group.rate)} %` : "—"}</td>
            <td>
                <Sparkline values={group.movement} />
            </td>
        </tr>
    );
}

/** Where leads come from, largest first, with change against the comparison and a per-row movement line. */
export function MarketingBreakdown({ groups, totals, previousLeads, dimension, onDimensionChange }: BreakdownProps) {
    const dimensionLabel = MARKETING_DIMENSIONS.find((item) => item.key === dimension)?.label ?? "Proyecto";
    const maxLeads = Math.max(1, ...groups.map((group) => group.leads));
    // When the whole period is small, tagging every row only adds noise; one note says it once.
    const smallPeriod = totals.leads < MARKETING_MIN_SAMPLE * 3;
    return (
        <section id="marketing-preview-breakdown" className="marketing-card" aria-labelledby="marketing-breakdown-title">
            <div className="marketing-card__heading">
                <div>
                    <h2 id="marketing-breakdown-title">¿De dónde vienen los leads?</h2>
                    <p>{smallPeriod ? "Hay pocos leads en este periodo: tómalo como referencia, no como conclusión." : "De mayor a menor captación. La variación compara con el periodo de comparación."}</p>
                </div>
                <BreakdownGrouping dimension={dimension} onDimensionChange={onDimensionChange} />
            </div>
            <div className="marketing-preview-table-scroll" role="region" aria-label="Tabla de captación y citas" tabIndex={0}>
                <table aria-label={`Desglose de ejemplo por ${dimensionLabel}`}>
                    <thead>
                        <tr>
                            <th scope="col">{dimensionLabel}</th>
                            <th scope="col">Leads</th>
                            <th scope="col">Variación</th>
                            <th scope="col">% con cita</th>
                            <th scope="col">Movimiento</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map((group) => (
                            <BreakdownRow key={group.name} group={group} maxLeads={maxLeads} flagLow={!smallPeriod} />
                        ))}
                        {groups.length === 0 && (
                            <tr>
                                <td colSpan={5} className="marketing-preview-empty">
                                    No hay resultados de ejemplo con estos filtros.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th scope="row">Total</th>
                            <td>{countFormat.format(totals.leads)}</td>
                            <td>
                                <DeltaText delta={describeChange(relativeChange(totals.leads, previousLeads), "%")} />
                            </td>
                            <td>{percentFormat.format(totals.rate)} %</td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    );
}

/** Which seller holds how many leads in each campaign. Collapsed by default: it answers a second question. */
export function MarketingSellerMatrix({ matrix }: { readonly matrix: ReturnType<typeof matrixMarketingSample> }) {
    const max = Math.max(1, ...matrix.sellers.flatMap((seller) => seller.cells.map((cell) => cell.leads)));
    return (
        <details className="marketing-card marketing-card--collapsible">
            <summary>
                <span>
                    <strong>Leads por vendedor y campaña</strong>
                    <small>Cuántos leads atiende cada vendedor en cada campaña. Más oscuro, más leads.</small>
                </span>
            </summary>
            <div className="marketing-preview-table-scroll" role="region" aria-label="Leads por vendedor y campaña" tabIndex={0}>
                <table aria-label="Leads por vendedor y campaña">
                    <thead>
                        <tr>
                            <th scope="col">Vendedor</th>
                            {matrix.campaigns.map((campaign) => (
                                <th key={campaign} scope="col">
                                    {campaign}
                                </th>
                            ))}
                            <th scope="col">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.sellers.map((seller) => (
                            <tr key={seller.seller}>
                                <th scope="row">{seller.seller}</th>
                                {seller.cells.map((cell, index) => (
                                    <td key={matrix.campaigns[index]} className="marketing-matrix-cell" style={cell.leads ? { backgroundColor: `rgb(73 97 128 / ${String(0.05 + (cell.leads / max) * 0.2)})` } : undefined}>
                                        {cell.leads ? (
                                            <>
                                                <strong>{countFormat.format(cell.leads)}</strong>
                                                <small>{countFormat.format(cell.withAppointment)} con cita</small>
                                            </>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                ))}
                                <td>{countFormat.format(seller.total.leads)}</td>
                            </tr>
                        ))}
                        {matrix.sellers.length === 0 && (
                            <tr>
                                <td colSpan={matrix.campaigns.length + 2} className="marketing-preview-empty">
                                    No hay resultados de ejemplo con estos filtros.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </details>
    );
}
