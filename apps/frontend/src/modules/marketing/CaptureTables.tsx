import { useMemo } from "react";

import { countFormat, percentFormat } from "../home/marketing-home-format";
import { addValues, type CaptureCatalogs, type CaptureDepth, type CaptureMeasure, type CaptureRow, type CaptureValues, columnsFor, EMPTY_VALUES, MEASURES, type PathRow, summaryRows, type ValueColumn } from "./lead-capture-report";

const formatCell = (value: number | string): string => (typeof value === "number" ? countFormat.format(value) : value);
const measureLabel = (measure: CaptureMeasure): string => MEASURES.find((item) => item.measure === measure)?.label ?? "Leads";

/** Una tabla por nivel, cada una plana y aparte. Lo que se lee en una fila es exactamente un proyecto, una campaña o un anuncio. */
const LEVELS = [
    { depth: 1, title: "Proyectos", header: "Proyecto", noun: "proyecto" },
    { depth: 2, title: "Campañas", header: "Campaña", noun: "campaña" },
    { depth: 3, title: "Anuncios", header: "Anuncio", noun: "anuncio" },
] as const;

type Level = (typeof LEVELS)[number];

/** Id del proyecto de una fila: la primera parte de su clave. Los ids del camino van del más externo al más interno. */
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

/** Nombre de la fila: el del propio nivel en negrita. En campañas y anuncios, el camino de arriba va en texto pequeño, para que la fila siga diciendo dónde pertenece. */
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
                                    <NameCell
                                        row={row}
                                        level={level}
                                        pick={
                                            level.depth === 1 && onToggle
                                                ? {
                                                      picked,
                                                      toggle: () => {
                                                          onToggle(projectId);
                                                      },
                                                  }
                                                : undefined
                                        }
                                    />
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
    /** Las filas que quedan después de elegir proyectos. Las campañas y los anuncios la siguen. */
    readonly scoped: readonly CaptureRow[];
    readonly depth: CaptureDepth;
    readonly measure: CaptureMeasure;
    readonly catalogs: CaptureCatalogs;
    readonly selected: ReadonlySet<string>;
    readonly onToggle: (projectId: string) => void;
}

/**
 * El desglose en tablas lado a lado, una por nivel: proyectos, campañas y anuncios. Cada una es tan alta como necesita y se desplaza sola.
 * Se usa todo el ancho y nada se mezcla. Elegir proyectos en la primera reduce las otras dos a esos proyectos.
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
