import { useMemo } from "react";

import { countFormat, percentFormat } from "../home/marketing-home-format";
import { addValues, type CaptureCatalogs, type CaptureDepth, type CaptureMeasure, type CaptureRow, type CaptureValues, columnsFor, EMPTY_VALUES, MEASURES, type PathRow, summaryRows, type ValueColumn } from "./lead-capture-report";

const formatCell = (value: number | string): string => (typeof value === "number" ? countFormat.format(value) : value);
const measureLabel = (measure: CaptureMeasure): string => MEASURES.find((item) => item.measure === measure)?.label ?? "Leads";

/** One table per level, each flat and on its own: what you read in a row is exactly one project, one campaign or one ad. */
const LEVELS = [
    { depth: 1, title: "Proyectos", header: "Proyecto", noun: "proyecto" },
    { depth: 2, title: "Campañas", header: "Campaña", noun: "campaña" },
    { depth: 3, title: "Anuncios", header: "Anuncio", noun: "anuncio" },
] as const;

type Level = (typeof LEVELS)[number];

/** Id of the project of a row: the first part of its key (the ids of the path, outermost first). */
const projectIdOf = (row: PathRow): string => (JSON.parse(row.key) as string[])[0] ?? "";

function ValueCells({ columns, detail }: { readonly columns: readonly ValueColumn[]; readonly detail: CaptureValues }) {
    return (
        <>
            {columns.map((column, index) => (
                <td className={index === 0 ? "capture-table__number capture-table__number--main" : "capture-table__number"} key={column.key}>
                    {formatCell(column.cell(detail))}
                </td>
            ))}
        </>
    );
}

interface Pick {
    readonly picked: boolean;
    readonly toggle: () => void;
}

/** Name of the row: the level's own name in bold; for campaigns and ads, the path above it in small type, so the row still says where it belongs. */
function NameCell({ row, level, pick }: { readonly row: PathRow; readonly level: Level; readonly pick: Pick | undefined }) {
    const own = row.path[level.depth - 1] ?? "";
    const parents = row.path.slice(0, level.depth - 1).join(" › ");
    return (
        <th scope="row" className="capture-table__name">
            {pick ? (
                <button type="button" className="capture-table__pick" aria-pressed={pick.picked} title={pick.picked ? "Quitar de la selección" : "Ver solo este proyecto en el gráfico y en las otras tablas"} onClick={pick.toggle}>
                    {own}
                </button>
            ) : (
                <span className="capture-table__group-name">{own}</span>
            )}
            {parents && <small className="capture-table__subtotal">{parents}</small>}
        </th>
    );
}

interface LevelProps {
    readonly level: Level;
    readonly rows: readonly PathRow[];
    readonly measure: CaptureMeasure;
    readonly selected?: ReadonlySet<string>;
    readonly onToggle?: (projectId: string) => void;
}

function LevelTable({ level, rows, measure, selected, onToggle }: LevelProps) {
    const columns = columnsFor(measure);
    const withShare = measure === "leads";
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const sum = rows.reduce((all, row) => addValues(all, row.detail), EMPTY_VALUES);
    return (
        <section className="capture-level" aria-label={`${measureLabel(measure)} por ${level.noun}`}>
            <header>
                <h3>{level.title}</h3>
                <span>{countFormat.format(rows.length)}</span>
            </header>
            <div className="capture-level__scroll">
                <table className="capture-table capture-table--flat" aria-label={`${measureLabel(measure)} por ${level.noun}`}>
                    <thead>
                        <tr>
                            <th scope="col">{level.header}</th>
                            {columns.map((column) => (
                                <th scope="col" className="capture-table__number" key={column.key}>
                                    {column.label}
                                </th>
                            ))}
                            {withShare && (
                                <th scope="col" className="capture-table__number">
                                    % del total
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const projectId = projectIdOf(row);
                            const picked = level.depth === 1 && Boolean(selected?.has(projectId));
                            return (
                                <tr key={row.key} className={picked ? "capture-table__row capture-table__row--picked" : "capture-table__row"}>
                                    <NameCell row={row} level={level} pick={level.depth === 1 && onToggle ? { picked, toggle: () => { onToggle(projectId); } } : undefined} />
                                    <ValueCells columns={columns} detail={row.detail} />
                                    {withShare && <td className="capture-table__number">{total ? `${percentFormat.format((row.value / total) * 100)} %` : "—"}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                    {rows.length > 0 && (
                        <tfoot>
                            <tr>
                                <th scope="row">Total</th>
                                <ValueCells columns={columns} detail={sum} />
                                {withShare && <td className="capture-table__number">100 %</td>}
                            </tr>
                        </tfoot>
                    )}
                </table>
                {rows.length === 0 && <p className="capture-empty">Sin datos en este periodo.</p>}
            </div>
        </section>
    );
}

interface Props {
    readonly rows: readonly CaptureRow[];
    /** The rows left after the project selection: campaigns and ads follow it. */
    readonly scoped: readonly CaptureRow[];
    readonly depth: CaptureDepth;
    readonly measure: CaptureMeasure;
    readonly catalogs: CaptureCatalogs;
    readonly selected: ReadonlySet<string>;
    readonly onToggle: (projectId: string) => void;
}

/**
 * The breakdown as side-by-side tables, one per level (projects, campaigns, ads), each as tall as it needs and scrolling on its own, so the
 * whole width of the screen is used and nothing is merged. Picking projects in the first one narrows the other two to them.
 */
export function BreakdownTables({ rows, scoped, depth, measure, catalogs, selected, onToggle }: Props) {
    const projects = useMemo(() => summaryRows(rows, 1, measure, catalogs), [rows, measure, catalogs]);
    const campaigns = useMemo(() => (depth >= 2 ? summaryRows(scoped, 2, measure, catalogs) : []), [scoped, depth, measure, catalogs]);
    const ads = useMemo(() => (depth >= 3 ? summaryRows(scoped, 3, measure, catalogs) : []), [scoped, depth, measure, catalogs]);
    return (
        <div className="capture-levels" data-depth={depth}>
            <LevelTable level={LEVELS[0]} rows={projects} measure={measure} selected={selected} onToggle={onToggle} />
            {depth >= 2 && <LevelTable level={LEVELS[1]} rows={campaigns} measure={measure} />}
            {depth >= 3 && <LevelTable level={LEVELS[2]} rows={ads} measure={measure} />}
        </div>
    );
}
