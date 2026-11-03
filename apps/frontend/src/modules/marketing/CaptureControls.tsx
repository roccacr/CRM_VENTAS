import DownloadOutlined from "@ant-design/icons/DownloadOutlined";
import FileImageOutlined from "@ant-design/icons/FileImageOutlined";
import FilePdfOutlined from "@ant-design/icons/FilePdfOutlined";
import Button from "antd/es/button";
import Dropdown from "antd/es/dropdown";
import Select from "antd/es/select";
import { useState } from "react";

import type { CaptureQualification } from "../../services/marketing/lead-report-service";
import { InfoHint } from "../home/MarketingInfoHint";
import type { CapturePeriod } from "./capture-period";
import { type CaptureDateRange, type CapturePeriodChoice, validateCaptureRange } from "./capture-time-groups";
import { type CaptureDepth, type CaptureMeasure, DEPTHS, MEASURES } from "./lead-capture-report";

const PERIODS = [
    { id: "day", label: "Hoy" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mes" },
    { id: "quarter", label: "Trimestre" },
    { id: "year", label: "Año" },
    { id: "custom", label: "Personalizado" },
] as const;

const CALENDAR_LABELS: Record<CapturePeriod, string> = { day: "", custom: "", week: "Semanas", month: "Meses", quarter: "Trimestres", year: "Años" };

export type ExportFormat = "png" | "pdf";

interface Props {
    readonly qualification: CaptureQualification;
    readonly onQualification: (value: CaptureQualification) => void;
    readonly busy: boolean;
    readonly pending: boolean;
    readonly period: CapturePeriod;
    readonly onPeriod: (period: CapturePeriod) => void;
    readonly onDownload: (format: ExportFormat) => void;
    readonly measure: CaptureMeasure;
    readonly onMeasure: (measure: CaptureMeasure) => void;
    readonly depth: CaptureDepth;
    readonly today: string;
    readonly range: CaptureDateRange;
    readonly onRange: (range: CaptureDateRange) => void;
    readonly choices: readonly CapturePeriodChoice[];
    readonly selectedPeriods: readonly string[];
    readonly appliedPeriodCount: number;
    readonly onSelectedPeriods: (values: string[]) => void;
    readonly onDepth: (depth: CaptureDepth) => void;
}

/** Controles del reporte global: medida, profundidad, período y exportación, sin filtrar por vendedor. */
export function CaptureControls({ qualification, onQualification, pending, period: selectedPeriod, onPeriod, busy, onDownload, measure, onMeasure, depth, onDepth, today, range, onRange, choices, selectedPeriods, appliedPeriodCount, onSelectedPeriods }: Props) {
    const calendarLabel = CALENDAR_LABELS[selectedPeriod];
    const [draft, setDraft] = useState<CaptureDateRange>(range);
    const [error, setError] = useState<string | null>(null);
    return (
        <section className="marketing-card capture-controls" aria-label="Opciones del reporte">
            <div className="capture-controls__measure">
                <div className="capture-controls__field">
                    <span>Qué medir</span>
                    <div className="marketing-preview-grouping" role="group" aria-label="Qué medir">
                        {MEASURES.map((item) => (
                            <button
                                type="button"
                                key={item.measure}
                                aria-pressed={measure === item.measure}
                                onClick={() => {
                                    onMeasure(item.measure);
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="capture-controls__field capture-controls__qualification">
                    <span>
                        <InfoHint label="Calificación">Calificado: marca registrada, cita programada o realizada, estimación, prerreserva u orden de venta. Este filtro consulta datos; no modifica la base de datos.</InfoHint>
                    </span>
                    <Select<CaptureQualification>
                        aria-label="Filtrar por calificación"
                        value={qualification}
                        virtual={false}
                        options={[
                            { value: "all", label: "Todos" },
                            { value: "qualified", label: "Calificado" },
                            { value: "unqualified", label: "No calificado" },
                        ]}
                        onChange={onQualification}
                    />
                </div>
            </div>
            <div className="capture-controls__field">
                <span>{measure === "lossReasons" ? "Contexto del desglose" : "Ver por"}</span>
                <div className="marketing-preview-grouping" role="group" aria-label="Ver por">
                    {DEPTHS.map((item) => (
                        <button
                            type="button"
                            key={item.depth}
                            aria-pressed={depth === item.depth}
                            onClick={() => {
                                onDepth(item.depth);
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>
            <label className="capture-controls__field capture-controls__period">
                <span>Período</span>
                <select
                    aria-label="Periodo"
                    value={selectedPeriod}
                    onChange={(event) => {
                        const next = PERIODS.find((item) => item.id === event.currentTarget.value);
                        if (!next) return;
                        if (next.id === "custom") setDraft(range);
                        setError(null);
                        onPeriod(next.id);
                    }}
                >
                    {PERIODS.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.label}
                        </option>
                    ))}
                </select>
            </label>
            {selectedPeriod !== "custom" && <CalendarPeriodSelection key={selectedPeriod} label={calendarLabel} choices={choices} selected={selectedPeriods} pending={pending} onApply={onSelectedPeriods} />}
            {selectedPeriod === "custom" && (
                <form
                    className="capture-controls__dates"
                    aria-label="Rango personalizado"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const problem = validateCaptureRange(draft, today);
                        setError(problem);
                        if (!problem) onRange(draft);
                    }}
                >
                    <label className="capture-controls__field">
                        <span>Desde</span>
                        <input
                            type="date"
                            aria-label="Desde"
                            value={draft.from}
                            max={today}
                            onChange={(event) => {
                                const from = event.currentTarget.value;
                                setDraft((current) => ({ ...current, from }));
                            }}
                        />
                    </label>
                    <label className="capture-controls__field">
                        <span>Hasta</span>
                        <input
                            type="date"
                            aria-label="Hasta"
                            value={draft.to}
                            max={today}
                            onChange={(event) => {
                                const to = event.currentTarget.value;
                                setDraft((current) => ({ ...current, to }));
                            }}
                        />
                    </label>
                    <Button htmlType="submit" disabled={pending}>
                        Aplicar filtro
                    </Button>
                    {error && <span role="alert">{error}</span>}
                </form>
            )}
            <p className="capture-controls__range">
                {appliedPeriodCount > 1 ? `${String(appliedPeriodCount)} períodos seleccionados · ` : ""}
                Rango aplicado:{" "}
                <strong>
                    {range.from || "—"} → {range.to || "—"}
                </strong>
                .
            </p>
            <Dropdown
                disabled={pending}
                trigger={["click"]}
                menu={{
                    items: [
                        { key: "png", icon: <FileImageOutlined />, label: "Imagen (PNG)" },
                        { key: "pdf", icon: <FilePdfOutlined />, label: "PDF" },
                    ],
                    onClick: ({ key }) => {
                        onDownload(key === "pdf" ? "pdf" : "png");
                    },
                }}
            >
                <Button className="capture-controls__download" icon={<DownloadOutlined aria-hidden="true" />} loading={busy} disabled={pending}>
                    Descargar
                </Button>
            </Dropdown>
        </section>
    );
}

/** La selección en edición no cambia la consulta ni las cifras hasta confirmar todo el conjunto. */
function CalendarPeriodSelection({ label, choices, selected, pending, onApply }: { readonly label: string; readonly choices: readonly CapturePeriodChoice[]; readonly selected: readonly string[]; readonly pending: boolean; readonly onApply: (values: string[]) => void }) {
    const [draft, setDraft] = useState<readonly string[] | null>(null);
    const values = draft ?? selected;
    return (
        <form
            className="capture-controls__dates"
            aria-label="Selección de períodos"
            onSubmit={(event) => {
                event.preventDefault();
                if (values.length || !label) onApply([...values]);
            }}
        >
            {label && (
                <div className="capture-controls__field capture-controls__calendar">
                    <span>{label}</span>
                    <Select<string[]> aria-label={label} mode="multiple" maxTagCount={1} maxTagTextLength={26} virtual={false} disabled={pending} placeholder="Selecciona períodos" value={[...values]} options={[...choices].reverse()} onChange={setDraft} showSearch={{ optionFilterProp: "label" }} />
                </div>
            )}
            <Button htmlType="submit" disabled={pending || (label !== "" && values.length === 0)}>
                Aplicar filtro
            </Button>
        </form>
    );
}
