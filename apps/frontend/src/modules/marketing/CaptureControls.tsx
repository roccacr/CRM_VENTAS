import DownloadOutlined from "@ant-design/icons/DownloadOutlined";
import FileImageOutlined from "@ant-design/icons/FileImageOutlined";
import FilePdfOutlined from "@ant-design/icons/FilePdfOutlined";
import Button from "antd/es/button";
import Dropdown from "antd/es/dropdown";
import Select from "antd/es/select";

import type { CapturePeriod } from "./capture-period";
import { type CaptureDepth, type CaptureFilters, type CaptureMeasure, type CaptureSeller, DEPTHS, MEASURES } from "./lead-capture-report";
import { SellerChip } from "./SellerAvatar";

const PERIODS = [
    { id: "day", label: "Hoy" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mes" },
    { id: "quarter", label: "Trimestre" },
    { id: "year", label: "Año" },
] as const;

export type ExportFormat = "png" | "pdf";

interface Props {
    readonly busy: boolean;
    readonly pending: boolean;
    readonly period: CapturePeriod;
    readonly onPeriod: (period: CapturePeriod) => void;
    readonly sellers: readonly CaptureSeller[];
    readonly onDownload: (format: ExportFormat) => void;
    readonly measure: CaptureMeasure;
    readonly onMeasure: (measure: CaptureMeasure) => void;
    readonly depth: CaptureDepth;
    readonly filters: CaptureFilters;
    readonly onDepth: (depth: CaptureDepth) => void;
    readonly onFilters: (filters: CaptureFilters) => void;
}

/**
 * Four decisions, always in the same place: what is counted, how deep the report goes, how far back, and whose leads.
 * What is counted and how deep are independent, so three measures and three depths replace nine separate reports.
 * Sellers default to everyone, as the report is read first as a whole and only then narrowed.
 */
export function CaptureControls({ pending, period: selectedPeriod, onPeriod, sellers, busy, onDownload, measure, onMeasure, depth, filters, onDepth, onFilters }: Props) {
    return (
        <section className="marketing-card capture-controls" aria-label="Opciones del reporte">
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
            <div className="capture-controls__field">
                <span>Ver por</span>
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
            <div className="capture-controls__field">
                <span>Periodo</span>
                <div className="marketing-preview-grouping" role="group" aria-label="Periodo">
                    {PERIODS.map((period) => (
                        <button
                            type="button"
                            key={period.id}
                            aria-pressed={selectedPeriod === period.id}
                            onClick={() => {
                                onPeriod(period.id);
                            }}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>
            <label className="capture-controls__field capture-controls__seller">
                <span>Vendedor</span>
                <Select<string[]>
                    aria-label="Vendedor"
                    mode="multiple"
                    allowClear
                    virtual={false}
                    maxTagCount="responsive"
                    value={[...filters.sellers]}
                    disabled={pending}
                    options={sellers.map((seller) => ({ value: seller.id, label: seller.name, publicId: seller.publicId }))}
                    optionRender={(option) => {
                        const seller = option.data as { label: string; publicId: string | null };
                        return <SellerChip publicId={seller.publicId} name={seller.label} size={36} decorative />;
                    }}
                    placeholder="Todos los vendedores"
                    onChange={(sellers) => {
                        onFilters({ ...filters, sellers });
                    }}
                />
            </label>
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
