import "../home/MarketingHomePage.css";
import "./MarketingLeadCapturePage.css";

import TableOutlined from "@ant-design/icons/TableOutlined";
import Button from "antd/es/button";
import message from "antd/es/message";
import Modal from "antd/es/modal";
import { type ReactNode, type RefObject, useMemo, useRef, useState } from "react";

import type { IdentityUser } from "../../services/auth/identity-contracts";
import { type CaptureApiReport, captureMeasureAvailable, type CaptureQualification } from "../../services/marketing/lead-report-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import { countFormat, describeRange, percentFormat } from "../home/marketing-home-format";
import { InfoHint } from "../home/MarketingInfoHint";
import { downloadBlob, exportFileName, printReport, renderNodeToPng } from "./capture-export";
import { apiPeriodOf, type CapturePeriod, periodRange } from "./capture-period";
import { type CaptureDateRange, type CaptureGrouping, captureGroupingForPeriod, captureGroupingLabel, type CapturePeriodChoice, capturePeriodChoices, capturePeriodProjects, captureTimeGroups } from "./capture-time-groups";
import { CaptureColumnsChart } from "./CaptureColumnsChart";
import { CaptureControls, type ExportFormat } from "./CaptureControls";
import { CaptureKpis } from "./CaptureKpis";
import { CaptureLoading } from "./CaptureLoading";
import { BreakdownTables } from "./CaptureTables";
import { type CaptureCatalogs, type CaptureDepth, type CaptureFilters, captureKpis, type CaptureMeasure, captureMeasureInfo, DEPTHS, filterCaptureRows, lossReasonRows, type PathRow } from "./lead-capture-report";
import { useCaptureReport } from "./useCaptureReport";

/** El modal del desglose es tan ancho como sus tablas. Una tabla no se estira a toda la pantalla. Tres la usan. */
const BREAKDOWN_WIDTH: Record<CaptureDepth, number> = { 1: 760, 2: 1200, 3: 1700 };

const MEASURE_HINTS: Record<CaptureMeasure, string> = {
    leads: "Leads registrados en el periodo, agrupados por proyecto, campaña o anuncio según el nivel elegido.",
    reservations: "Leads registrados en el período con una reserva o pre-reserva vigente. Un lead con ambas cuenta una sola vez; no se suman documentos. Excluye reservas caídas y órdenes inactivas o eliminadas.",
    appointments: "Con cita = Programada + Realizada. Cada lead cuenta una sola vez: realizada tiene prioridad sobre programada. Con cita + Sin cita = Total de leads captados; no se cuentan eventos.",
    lossReasons: "Motivos documentados de los leads captados en el período que actualmente están perdidos. Cada lead cuenta una vez. Sin evidencia fiable se muestra Sin motivo registrado. El porcentaje del gráfico se calcula sobre el total de perdidos.",
    lost: "Leads que hoy están en etapa Perdido, y qué porcentaje son de los leads del mismo grupo. El gráfico compara los perdidos de cada proyecto, campaña o anuncio.",
};
const QUALIFICATION_LABELS = { all: "Todos", qualified: "Calificado", unqualified: "No calificado" };
const qualificationLabel = (qualification: CaptureQualification = "all") => QUALIFICATION_LABELS[qualification];
const EMPTY_CATALOGS: CaptureCatalogs = { sellers: [], projects: [], campaigns: [], ads: [] };
const QUALITY_LABELS = { unresolvedSellers: "leads con atribución incompleta", unresolvedCampaigns: "leads sin campaña identificada", ambiguousLeadReferences: "leads con referencia repetida o incompleta", unclassifiedAppointments: "citas sin clasificar", invalidDates: "registros con fecha inválida" } as const;
const QUALITY_HINT = "Estos registros sí se cuentan en el reporte. Pero su dato de origen (referencia externa, atribución, campaña o fecha) viene repetido, incompleto o sin resolver, así que su atribución o sus citas pueden no ser exactas. Conviene revisarlos en el sistema de origen.";

function Block({ title, hint, aside, actions, children }: { readonly title: string; readonly hint?: string; readonly aside?: string; readonly actions?: ReactNode; readonly children: ReactNode }) {
    return (
        <section className="marketing-card capture-block">
            <div className="marketing-card__heading">
                <h2>
                    {title}
                    {hint && <InfoHint label={title}>{hint}</InfoHint>}
                </h2>
                <div className="capture-block__tools">
                    {actions}
                    {aside && <span className="capture-block__aside">{aside}</span>}
                </div>
            </div>
            <div className="capture-block__body">{children}</div>
        </section>
    );
}

/**
 * Reporte de captación. La persona elige la profundidad: proyecto, campaña o anuncio. El gráfico y las tablas responden en ese mismo orden.
 * Un cambio de sesión remonta el reporte, así que los filtros y resultados locales no cruzan identidades.
 */
export function MarketingLeadCapturePage({ currentUser }: { readonly currentUser: Pick<IdentityUser, "publicId" | "permissionVersion"> }) {
    return <CapturePage key={`${currentUser.publicId}:${String(currentUser.permissionVersion)}`} userId={currentUser.publicId} />;
}

function CapturePage({ userId }: { readonly userId: string }) {
    const [qualification, setQualification] = useState<CaptureQualification>("all");
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
    const [period, setPeriod] = useState<CapturePeriod>("month");
    const [draftPeriod, setDraftPeriod] = useState<CapturePeriod>("month");
    const [customRange, setCustomRange] = useState<CaptureDateRange | null>(null);
    const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
    const { value, failed, retry } = useCaptureReport(apiPeriodOf(period, selectedPeriods.length > 0), userId, qualification);
    const choices = useMemo(() => capturePeriodChoices(period, value ? { from: value.coverage.start, to: value.today } : { from: "", to: "" }), [period, value]);
    const draftChoices = useMemo(() => capturePeriodChoices(draftPeriod, value ? { from: value.coverage.start, to: value.today } : { from: "", to: "" }), [draftPeriod, value]);
    const chosen = useMemo(() => (selectedPeriods.length ? choices.filter((choice) => selectedPeriods.includes(choice.value)) : []), [choices, selectedPeriods]);
    const catalogs = value ?? EMPTY_CATALOGS;
    const [measure, setMeasure] = useState<CaptureMeasure>("leads");
    const [depth, setDepth] = useState<CaptureDepth>(1);
    // El reporte conserva todos los vendedores autorizados; la selección visual se limita a proyectos.
    const filters = useMemo(() => selectedCaptureFilters(period, value, customRange, chosen), [value, period, customRange, chosen]);
    const grouping = captureGroupingForPeriod(period, filters);
    const [exporting, setExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const download = async (format: ExportFormat) => {
        if (!value) return;
        const name = exportFileName(["captacion", measure, depthNoun(depth), grouping, filters.from, "a", filters.to], format === "png" ? "png" : "pdf");
        if (format === "pdf") {
            printReport();
            return;
        }
        const node = reportRef.current;
        if (!node) return;
        setExporting(true);
        try {
            downloadBlob(await renderNodeToPng(node), name);
        } catch {
            void message.error("No se pudo generar la imagen. Prueba con PDF.");
        } finally {
            setExporting(false);
        }
    };
    return (
        <div className="global-home-dashboard marketing-home capture-preview">
            <header className="capture-preview__header">
                <div>
                    <p className="capture-preview__eyebrow">Mercadeo / Análisis de captación</p>
                    <h1>Captación de leads</h1>
                    <p>De dónde vienen los leads y en qué terminan.</p>
                </div>
                {value && <span className="capture-preview__updated">Actualizado {new Date(value.observedAt).toLocaleString("es-CR", { timeZone: value.timeZone })}</span>}
            </header>
            <CaptureControls
                qualification={qualification}
                onQualification={setQualification}
                pending={!value}
                period={draftPeriod}
                onPeriod={setDraftPeriod}
                busy={exporting}
                onDownload={(format) => void download(format)}
                reservationsAvailable={captureMeasureAvailable(value)}
                measure={measure}
                onMeasure={setMeasure}
                depth={depth}
                onDepth={setDepth}
                choices={draftChoices}
                selectedPeriods={displayPeriodKeys(draftPeriod === period ? selectedPeriods : [], draftChoices)}
                appliedPeriodCount={selectedPeriods.length}
                onSelectedPeriods={(next) => {
                    setPeriod(draftPeriod);
                    setSelectedPeriods(next.length === 1 && next[0] === draftChoices.at(-1)?.value ? [] : next);
                }}
                today={captureToday(value)}
                range={filters}
                onRange={(next) => {
                    setSelectedPeriods([]);
                    setCustomRange(next);
                    setPeriod("custom");
                }}
            />
            {!value && !failed && <CaptureLoading />}
            {failed && (
                <section className="marketing-card capture-block" role="alert">
                    <p>No se pudo cargar el reporte de captación.</p>
                    <Button onClick={retry}>Reintentar</Button>
                </section>
            )}
            {value && <CaptureResults picked={picked} setPicked={setPicked} value={value} measure={measure} depth={depth} filters={filters} catalogs={catalogs} reportRef={reportRef} grouping={grouping} />}
        </div>
    );
}

function displayPeriodKeys(selected: readonly string[], choices: readonly CapturePeriodChoice[]): readonly string[] {
    return selected.length ? selected : choices.slice(-1).map((choice) => choice.value);
}
function selectedCaptureFilters(period: CapturePeriod, value: CaptureApiReport | null, custom: CaptureDateRange | null, chosen: readonly CapturePeriodChoice[]): CaptureFilters {
    const fallback = value ? periodRange(period, value) : { from: "", to: "" };
    const range = period === "custom" && custom ? custom : fallback;
    const first = chosen[0];
    const last = chosen.at(-1);
    return { ...(first && last ? { from: first.range.from, to: last.range.to } : range), sellers: [], periods: chosen.map((choice) => choice.range) };
}
function selectedRangeLabel(filters: CaptureFilters): string {
    if (filters.periods?.length) return filters.periods.map((item) => `${item.from} → ${item.to}`).join(" · ");
    return describeRange({ start: new Date(`${filters.from}T12:00:00`), end: new Date(`${filters.to}T12:00:00`) });
}

const depthNoun = (depth: CaptureDepth): string => DEPTHS.find((item) => item.depth === depth)?.noun ?? "proyecto";

function CaptureResults({ picked, setPicked, value, measure, depth, filters, catalogs, reportRef, grouping }: { readonly picked: ReadonlySet<string>; readonly setPicked: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>; readonly catalogs: CaptureCatalogs; readonly value: CaptureApiReport; readonly measure: CaptureMeasure; readonly depth: CaptureDepth; readonly filters: CaptureFilters; readonly reportRef: RefObject<HTMLDivElement | null>; readonly grouping: CaptureGrouping }) {
    const rows = useMemo(() => filterCaptureRows(value.rows, filters), [value, filters]);
    const [breakdownOpen, setBreakdownOpen] = useState(false);
    const clearSelection = () => {
        setPicked(new Set());
    };
    // El filtro explícito de proyectos se conserva aunque la calificación nueva no tenga filas.
    const selected = picked;
    const scoped = useMemo(() => (selected.size === 0 ? rows : rows.filter((row) => selected.has(row.projectId))), [rows, selected]);
    const toggle = (projectId: string) => {
        setPicked((current) => {
            const next = new Set(current);
            if (!next.delete(projectId)) next.add(projectId);
            return next;
        });
    };
    const kpis = useMemo(() => captureKpis(scoped, measure, depth), [scoped, measure, depth]);
    const total = kpis.total;
    const comparison = useMemo(() => {
        try {
            return { groups: captureTimeGroups(scoped, { catalogs, depth, measure, grouping, range: filters, periods: filters.periods ?? [] }), error: null };
        } catch (error) {
            if (!(error instanceof RangeError)) throw error;
            return { groups: [], error: error.message };
        }
    }, [scoped, catalogs, depth, measure, grouping, filters]);
    const chart = comparison.groups;
    const reasons = useMemo(() => lossReasonRows(scoped), [scoped]);
    const groupingLabel = captureGroupingLabel(grouping);
    const measureInfo = captureMeasureInfo(measure);
    const noun = depthNoun(depth);
    const baseTitle = measure === "lossReasons" ? "Motivos de pérdida" : `${measureInfo.label} por ${noun}`;
    const title = grouping === "total" ? baseTitle : `${baseTitle} · por ${groupingLabel}`;
    const selectedLabel = selectedRangeLabel(filters);
    const summaryLine = `${qualificationLabel(value.qualification)} · ${measureInfo.label} · por ${noun} · agrupación ${groupingLabel} · ${selectedLabel}`;
    if (!captureMeasureAvailable(value, measure)) return <p role="status">La información de reservas y pre-reservas no está disponible en este reporte.</p>;
    return (
        <div className="capture-report" ref={reportRef}>
            <CaptureQuality quality={value.quality} />
            <div className="capture-export-head">
                <p>Mercadeo / Análisis de captación</p>
                <h2>Captación de leads</h2>
                <p>{summaryLine}</p>
                <p>
                    Generado el {new Date().toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })} · Fuentes: {countFormat.format(value.sources.native)} nativos / {countFormat.format(value.sources.legacy)} anteriores
                </p>
            </div>
            <Block
                title={title}
                aside={`${countFormat.format(total)} ${measureInfo.noun}`}
                hint={MEASURE_HINTS[measure]}
                actions={
                    <Button
                        className="capture-block__breakdown"
                        icon={<TableOutlined aria-hidden="true" />}
                        onClick={() => {
                            setBreakdownOpen(true);
                        }}
                    >
                        Ver desglose en tabla
                    </Button>
                }
            >
                <CaptureKpis figures={kpis} measure={measure} depth={depth} />
                {selected.size > 0 && <SelectionBar count={selected.size} onClear={clearSelection} />}
                <div className="capture-summary capture-summary--stack">
                    <ComparedChart key={`${String(depth)}:${measure}:${grouping}`} error={comparison.error} groups={chart} title={title} measure={measure} grouping={grouping} />
                </div>
            </Block>
            <Modal
                className="capture-breakdown-modal"
                title={`Desglose · ${title}`}
                open={breakdownOpen}
                width={`min(96vw, ${String(BREAKDOWN_WIDTH[depth])}px)`}
                centered
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                footer={null}
                destroyOnHidden
                onCancel={() => {
                    setBreakdownOpen(false);
                }}
            >
                <SelectionBar count={selected.size} onClear={clearSelection} />
                <TimeComparisonTable grouping={grouping} groupingLabel={groupingLabel} error={comparison.error} chart={chart} measure={measure} noun={noun} measureLabel={measureInfo.label} total={kpis.total} />
                {measure === "lossReasons" && (
                    <div className="capture-level__scroll">
                        <table className="capture-table capture-table--flat" aria-label="Leads por motivo de pérdida">
                            <thead>
                                <tr>
                                    <th scope="col">Motivo de pérdida</th>
                                    <th scope="col">Perdidos</th>
                                    <th scope="col">% de los perdidos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reasons.map((reason) => (
                                    <tr key={reason.key}>
                                        <th scope="row">{reason.path[0]}</th>
                                        <td className="capture-table__number">{countFormat.format(reason.value)}</td>
                                        <td className="capture-table__number">{kpis.total > 0 ? `${percentFormat.format((reason.value / kpis.total) * 100)} %` : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <th scope="row">Total</th>
                                    <td className="capture-table__number">{countFormat.format(kpis.total)}</td>
                                    <td className="capture-table__number">{kpis.total > 0 ? "100 %" : "—"}</td>
                                </tr>
                            </tfoot>
                        </table>
                        {reasons.length === 0 && <p className="capture-empty">No hay leads perdidos en este período y selección.</p>}
                    </div>
                )}
                <BreakdownTables rows={rows} scoped={scoped} depth={depth} measure={measure} catalogs={catalogs} selected={selected} onToggle={toggle} />
            </Modal>
        </div>
    );
}

/** Dice cómo la tabla manda el gráfico y el detalle, y limpia la elección. En los archivos exportados no se muestra. */
function SelectionBar({ count, onClear }: { readonly count: number; readonly onClear: () => void }) {
    return (
        <div className="capture-selection" data-active={count > 0}>
            {count === 0 ? (
                <span>Haz clic en un proyecto para ver solo ese en el gráfico y en las otras tablas. Puedes elegir varios.</span>
            ) : (
                <>
                    <span>
                        Mostrando <strong>{count === 1 ? "1 proyecto" : `${String(count)} proyectos`}</strong> en el gráfico y en las otras tablas.
                    </span>
                    <button type="button" onClick={onClear}>
                        Quitar selección
                    </button>
                </>
            )}
        </div>
    );
}

function CaptureQuality({ quality }: { readonly quality: CaptureApiReport["quality"] }) {
    if (!Object.values(quality).some((count) => count > 0)) return null;
    const notice = (Object.keys(QUALITY_LABELS) as (keyof typeof QUALITY_LABELS)[])
        .filter((key) => quality[key] > 0)
        .map((key) => `${countFormat.format(quality[key])} ${QUALITY_LABELS[key]}`)
        .join(" · ");
    return (
        <p className="capture-quality" role="note">
            <strong>Datos por revisar:</strong> {notice}
            <InfoHint label="Datos por revisar">{QUALITY_HINT}</InfoHint>
        </p>
    );
}

function captureToday(report: CaptureApiReport | null | undefined): string {
    return report?.today ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date());
}
function TimeComparisonTable({ grouping, groupingLabel, error, chart, measure, noun, measureLabel, total }: { readonly grouping: CaptureGrouping; readonly groupingLabel: string; readonly error: string | null; readonly chart: readonly PathRow[]; readonly measure: CaptureMeasure; readonly noun: string; readonly measureLabel: string; readonly total: number }) {
    if (grouping === "total" || error) return null;
    const periods = [...new Set(chart.map((item) => item.path[0] ?? ""))];
    const projects = capturePeriodProjects(chart);
    return (
        <div className="capture-level__scroll">
            <table className="capture-table capture-table--flat" aria-label={`Comparación por ${groupingLabel}`}>
                <thead>
                    <tr>
                        <th scope="col">{measure === "lossReasons" ? "Motivo de pérdida" : noun}</th>
                        {periods.map((period) => (
                            <th scope="col" key={period}>
                                {period}
                            </th>
                        ))}
                        <th scope="col">Total {measureLabel.toLocaleLowerCase("es")}</th>
                    </tr>
                </thead>
                <tbody>
                    {projects.map((project) => (
                        <tr key={project.key}>
                            <th scope="row">{project.label}</th>
                            {project.items.map((item) => (
                                <td key={item.key} className="capture-table__number">
                                    {countFormat.format(item.value)}
                                </td>
                            ))}
                            <td className="capture-table__number">
                                <strong>{countFormat.format(project.total)}</strong>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <th scope="row">Total</th>
                        {periods.map((period) => (
                            <td key={period} className="capture-table__number">
                                {countFormat.format(chart.filter((item) => item.path[0] === period).reduce((sum, item) => sum + item.value, 0))}
                            </td>
                        ))}
                        <td className="capture-table__number">{countFormat.format(total)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function ComparedChart({ error, groups, title, measure, grouping }: { readonly error: string | null; readonly groups: readonly PathRow[]; readonly title: string; readonly measure: CaptureMeasure; readonly grouping: CaptureGrouping }) {
    if (error) return <p role="alert">{error}</p>;
    return <CaptureColumnsChart groups={groups} label={title} measure={measure} defaultLimit={grouping === "total" ? 15 : 0} chronological={grouping !== "total"} />;
}
