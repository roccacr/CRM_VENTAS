import "../home/MarketingHomePage.css";
import "./MarketingLeadCapturePage.css";

import TableOutlined from "@ant-design/icons/TableOutlined";
import Button from "antd/es/button";
import message from "antd/es/message";
import Modal from "antd/es/modal";
import { type ReactNode, type RefObject, useMemo, useRef, useState } from "react";

import type { IdentityUser } from "../../services/auth/identity-contracts";
import type { CaptureApiReport } from "../../services/marketing/lead-report-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import { countFormat, describeRange } from "../home/marketing-home-format";
import { InfoHint } from "../home/MarketingInfoHint";
import { downloadBlob, exportFileName, printReport, renderNodeToPng } from "./capture-export";
import { apiPeriodOf, type CapturePeriod, periodRange } from "./capture-period";
import { CaptureColumnsChart } from "./CaptureColumnsChart";
import { CaptureControls, type ExportFormat } from "./CaptureControls";
import { CaptureKpis } from "./CaptureKpis";
import { CaptureLoading } from "./CaptureLoading";
import { BreakdownTables } from "./CaptureTables";
import { type CaptureCatalogs, type CaptureDepth, type CaptureFilters, captureKpis, type CaptureMeasure, type CaptureSeller, chartGroups, DEPTHS, filterCaptureRows, MEASURES, sellerName, summaryRows } from "./lead-capture-report";
import { useCaptureReport } from "./useCaptureReport";

/** The breakdown modal is as wide as its tables: one table is not stretched over the whole screen, three use it. */
const BREAKDOWN_WIDTH: Record<CaptureDepth, number> = { 1: 760, 2: 1200, 3: 1700 };

const MEASURE_HINTS:Record<CaptureMeasure, string> = {
    leads: "Leads registrados en el periodo, todos los vendedores elegidos juntos. A la derecha, cada columna es un vendedor, en la misma escala.",
    appointments: "Con cita = Programada + Realizada. Cada lead cuenta una sola vez: realizada tiene prioridad sobre programada. Con cita + Sin cita = Total de leads captados; no se cuentan eventos.",
    lost: "Leads que hoy están en etapa Perdido, y qué porcentaje son de los leads del mismo grupo. El gráfico compara los perdidos de cada vendedor.",
};
const EMPTY_CATALOGS: CaptureCatalogs = { sellers: [], projects: [], campaigns: [], ads: [] };
const QUALITY_LABELS = { unresolvedSellers: "leads sin vendedor identificado", unresolvedCampaigns: "leads sin campaña identificada", ambiguousLeadReferences: "leads con referencia repetida o incompleta", unclassifiedAppointments: "citas sin clasificar", invalidDates: "registros con fecha inválida" } as const;
const QUALITY_HINT = "Estos registros sí se cuentan en el reporte. Pero su dato de origen (referencia externa, vendedor, campaña o fecha) viene repetido, incompleto o sin resolver, así que su atribución o sus citas pueden no ser exactas. Conviene revisarlos en el sistema de origen.";

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
 * Lead-capture report. The person picks how deep to look (project, campaign or ad); the report answers in the same order every
 * time: the whole picture (table and comparative chart), the general table by seller, and one section per seller.
 * Session changes remount the report so local filters and results never cross identities.
 */
export function MarketingLeadCapturePage({ currentUser }: { readonly currentUser: Pick<IdentityUser, "publicId" | "permissionVersion"> }) {
    return <CapturePage key={`${currentUser.publicId}:${String(currentUser.permissionVersion)}`} userId={currentUser.publicId} />;
}

function CapturePage({ userId }: { readonly userId: string }) {
    const [period, setPeriod] = useState<CapturePeriod>("month");
    const { value, failed, retry } = useCaptureReport(apiPeriodOf(period), userId);
    const sourceCatalogs = value ?? EMPTY_CATALOGS;
    const [measure, setMeasure] = useState<CaptureMeasure>("leads");
    const [depth, setDepth] = useState<CaptureDepth>(1);
    const [selectedSellers, setSelectedSellers] = useState<readonly CaptureSeller[]>([]);
    // An absent seller still means that seller, never "everyone". Metadata stays in this authenticated page only.
    const catalogs = useMemo(() => ({ ...sourceCatalogs, sellers: [...sourceCatalogs.sellers, ...selectedSellers.filter((selected) => !sourceCatalogs.sellers.some((seller) => seller.id === selected.id))] }), [sourceCatalogs, selectedSellers]);
    const filters = useMemo(() => ({ ...(value ? periodRange(period, value) : { from: "", to: "" }), sellers: selectedSellers.map((seller) => seller.id) }), [value, period, selectedSellers]);
    const [exporting, setExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const download = async (format: ExportFormat) => {
        if (!value) return;
        const name = exportFileName(["captacion", measure, depthNoun(depth), filters.from, "a", filters.to], format === "png" ? "png" : "pdf");
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
                pending={!value}
                period={period}
                onPeriod={setPeriod}
                sellers={catalogs.sellers}
                busy={exporting}
                onDownload={(format) => void download(format)}
                measure={measure}
                onMeasure={setMeasure}
                depth={depth}
                filters={filters}
                onDepth={setDepth}
                onFilters={(next) => {
                    setSelectedSellers(catalogs.sellers.filter((seller) => next.sellers.includes(seller.id)));
                }}
            />
            {!value && !failed && <CaptureLoading />}
            {failed && (
                <section className="marketing-card capture-block" role="alert">
                    <p>No se pudo cargar el reporte de captación.</p>
                    <Button onClick={retry}>Reintentar</Button>
                </section>
            )}
            {value && <CaptureResults value={value} measure={measure} depth={depth} filters={filters} catalogs={catalogs} reportRef={reportRef} />}
        </div>
    );
}

const depthNoun = (depth: CaptureDepth): string => DEPTHS.find((item) => item.depth === depth)?.noun ?? "proyecto";

function CaptureResults({ value, measure, depth, filters, catalogs, reportRef }: { readonly catalogs: CaptureCatalogs; readonly value: CaptureApiReport; readonly measure: CaptureMeasure; readonly depth: CaptureDepth; readonly filters: CaptureFilters; readonly reportRef: RefObject<HTMLDivElement | null> }) {
    const rows = useMemo(() => filterCaptureRows(value.rows, filters), [value, filters]);
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
    const [breakdownOpen, setBreakdownOpen] = useState(false);
    const clearSelection = () => {
        setPicked(new Set());
    };
    const projectIds = useMemo(() => new Set(rows.map((row) => row.projectId)), [rows]);
    // A project that left the data (other period or seller) drops out of the selection by itself.
    const selected = useMemo(() => new Set([...picked].filter((id) => projectIds.has(id))), [picked, projectIds]);
    const scoped = useMemo(() => (selected.size === 0 ? rows : rows.filter((row) => selected.has(row.projectId))), [rows, selected]);
    const toggle = (projectId: string) => {
        setPicked((current) => {
            const next = new Set(current);
            if (!next.delete(projectId)) next.add(projectId);
            return next;
        });
    };
    const summary = useMemo(() => summaryRows(rows, depth, measure, catalogs), [rows, depth, measure, catalogs]);
    const total = summary.reduce((sum, row) => sum + row.value, 0);
    const kpis = useMemo(() => captureKpis(scoped, measure, depth), [scoped, measure, depth]);
    const chart = useMemo(() => chartGroups(scoped, depth, measure, catalogs), [scoped, depth, measure, catalogs]);
    const measureInfo = MEASURES.find((item) => item.measure === measure) ?? { label: "Leads", noun: "leads" };
    const noun = depthNoun(depth);
    const title = `${measureInfo.label} por ${noun}`;
    const sellersText = filters.sellers.length === 0 ? "Todos los vendedores" : filters.sellers.map((id) => sellerName(id, catalogs)).join(", ");
    const summaryLine = `${measureInfo.label} · por ${noun} · ${describeRange({ start: new Date(`${filters.from}T12:00:00`), end: new Date(`${filters.to}T12:00:00`) })} · ${sellersText}`;
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
                    <CaptureColumnsChart sellers={chart.sellers} groups={chart.groups} label={`${title} y vendedor`} measure={measure} stacked defaultLimit={15} />
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
                <BreakdownTables rows={rows} scoped={scoped} depth={depth} measure={measure} catalogs={catalogs} selected={selected} onToggle={toggle} />
            </Modal>
        </div>
    );
}

/** Says how the table drives the chart and the detail, and clears the choice. Hidden in the exported files. */
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
