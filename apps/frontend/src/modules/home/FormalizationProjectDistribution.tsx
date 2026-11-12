import "./FormalizationProjectDistribution.css";

import BarChartOutlined from "@ant-design/icons/BarChartOutlined";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import Skeleton from "antd/es/skeleton";
import Tooltip from "antd/es/tooltip";
import { useEffect, useRef, useState } from "react";

import { type DistributionKey, getProjectDistribution, type ProjectDistribution, type ProjectDistributionRow } from "../../services/formalization/project-distribution-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import type { FollowUpSelection } from "./formalization-filter-preferences";
import { distributionMetrics, distributionPercent } from "./project-distribution-metrics";

const stages: Readonly<Record<DistributionKey, { label: string; color: string }>> = {
    finiquito_validation: { label: "Validación de saldo", color: "#991b1b" },
    finiquito_pending: { label: "Finiquito pendiente", color: "#dc2626" },
    finiquito_signed: { label: "Finiquito firmado", color: "#f87171" },
    finiquito_formalized: { label: "Formalizada", color: "#fecaca" },
    approvals: { label: "Pendientes de aprobación", color: "#2563eb" },
    send: { label: "Por enviar", color: "#f59e0b" },
    signature: { label: "Pendientes de firma", color: "#b45309" },
    bank_not_started: { label: "Gestión bancaria · Sin iniciar", color: "#7c3aed" },
    bank_in_progress: { label: "Gestión bancaria · En proceso", color: "#4f46e5" },
    balance: { label: "Pendientes de saldo", color: "#0e7490" },
    transfer: { label: "Traspasos pendientes", color: "#0f766e" },
    signed: { label: "Traspaso firmado", color: "#15803d" },
    closed: { label: "Formalizaciones cerradas este año", color: "#166534" },
    addendum: { label: "Adéndum pendiente", color: "#a855f7" },
};
const format = new Intl.NumberFormat("es-CR");
const quantity = (value: number) => `${format.format(value)} ${value === 1 ? "orden" : "órdenes"}`;
const description = (project: ProjectDistributionRow, key: DistributionKey) => `${project.name} · ${stages[key].label}: ${quantity(project.counts[key] ?? 0)}`;

/** El gráfico comparte las capacidades de lectura de Inicio; revocarlas desmonta sus datos. */
export function FormalizationProjectDistribution({ enabled, onSelect }: { readonly enabled: boolean; readonly onSelect?: (selection: FollowUpSelection, projectId: string) => void }) {
    return enabled ? <DistributionAction onSelect={onSelect} /> : null;
}
type SelectDistribution = (key: DistributionKey, project: ProjectDistributionRow) => void;
function DistributionAction({ onSelect }: { readonly onSelect: ((selection: FollowUpSelection, projectId: string) => void) | undefined }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button
                className="formalization-command"
                icon={<BarChartOutlined aria-hidden="true" />}
                onClick={() => {
                    setOpen(true);
                }}
            >
                Ver distribución por proyecto
            </Button>
            <Modal
                title="Distribución por proyecto"
                open={open}
                width="min(1180px, 96vw)"
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                centered
                footer={null}
                destroyOnHidden
                onCancel={() => {
                    setOpen(false);
                }}
            >
                {open && (
                    <DistributionContent
                        onSelect={(key, project) => {
                            onSelect?.(key, project.id ?? "unassigned");
                            setOpen(false);
                        }}
                    />
                )}
            </Modal>
        </>
    );
}
function DistributionContent({ onSelect }: { readonly onSelect: SelectDistribution }) {
    const [data, setData] = useState<ProjectDistribution | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const pending = useRef<Promise<ProjectDistribution> | null>(null);
    useEffect(() => {
        let active = true;
        pending.current ??= getProjectDistribution();
        void pending.current.then(
            (value) => {
                if (active) setData(value);
            },
            () => {
                if (active) setFailed(true);
            },
        );
        return () => {
            active = false;
        };
    }, [attempt]);
    if (failed)
        return (
            <div className="formalization-distribution__empty">
                <p role="alert">No fue posible cargar la distribución por proyecto.</p>
                <Button
                    onClick={() => {
                        pending.current = null;
                        setFailed(false);
                        setData(null);
                        setAttempt((value) => value + 1);
                    }}
                >
                    Reintentar distribución
                </Button>
            </div>
        );
    if (!data)
        return (
            <div className="formalization-distribution__loading" role="status" aria-label="Cargando distribución por proyecto">
                <Skeleton active paragraph={{ rows: 6 }} />
            </div>
        );
    return <DistributionChart data={data} onSelect={onSelect} />;
}
function DistributionChart({ data, onSelect }: { readonly data: ProjectDistribution; readonly onSelect: SelectDistribution }) {
    const series = data.series.filter((key) => key !== "addendum" && !key.startsWith("finiquito_"));
    const finiquito = data.series.filter((key) => key.startsWith("finiquito_"));
    const finiquitoMaximum = Math.max(1, ...data.projects.map((project) => stageTotal(project, finiquito)));
    const maximum = Math.max(1, ...data.projects.map((project) => series.reduce((sum, key) => sum + (project.counts[key] ?? 0), 0)));
    return (
        <section className="formalization-distribution" aria-label="Órdenes por proyecto y bandeja">
            <div className="formalization-distribution__summary">
                <strong>
                    {quantity(data.totalOrders)} comerciales en {format.format(data.projects.length)} {data.projects.length === 1 ? "proyecto" : "proyectos"}
                </strong>
                <span>Vista completa según tus permisos</span>
            </div>
            {finiquito.length > 0 && <FiniquitoMetrics projects={data.projects} series={finiquito} />}
            <ul className="formalization-distribution__legend" aria-label="Colores por estado">
                {data.series.map((key) => (
                    <li key={key}>
                        <i style={{ background: stages[key].color }} aria-hidden="true" />
                        {stages[key].label}
                        {key === "addendum" ? " · marca adicional" : ""}
                    </li>
                ))}
            </ul>
            <p className="formalization-distribution__note">
                Los colores siguen las condiciones de los banners. Una orden puede coincidir con más de una bandeja. La barra roja de finiquito y Adéndum se muestran por separado del total comercial. Cada circuito usa su propia escala. Los porcentajes del total usan Comerciales + Finiquito; la comparación Finiquito / comerciales usa solo las comerciales como base. Son cantidades de órdenes, no importes monetarios. Selecciona un segmento para abrir sus órdenes.
            </p>
            {data.projects.length === 0 ? (
                <p className="formalization-distribution__empty">No hay órdenes para mostrar en tus bandejas autorizadas.</p>
            ) : (
                <>
                    <div className="formalization-distribution__scroll" tabIndex={0} role="region" aria-label="Gráfico de distribución por proyecto">
                        <div className="formalization-distribution__column-head">
                            <span>Proyecto</span>
                            <span>Distribución comercial / Finiquito</span>
                            <span>Comerciales</span>
                            <span>En finiquito</span>
                            <span>Finiquito / comerciales</span>
                            {data.series.includes("addendum") && <span>Adéndum</span>}
                        </div>
                        <ol className="formalization-distribution__projects">
                            {data.projects.map((project) => (
                                <ProjectBar key={project.id ?? "no-project"} project={project} series={series} maximum={maximum} finiquito={finiquito} finiquitoMaximum={finiquitoMaximum} onSelect={onSelect} addendum={data.series.includes("addendum")} />
                            ))}
                        </ol>
                    </div>
                </>
            )}
            <p className="formalization-distribution__updated">Actualizado {new Date(data.observedAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}</p>
        </section>
    );
}
/** Una escala independiente por circuito permite comparar cantidades entre proyectos. */
function stageTotal(project: ProjectDistributionRow, series: readonly DistributionKey[]): number {
    return series.reduce((sum, key) => sum + (project.counts[key] ?? 0), 0);
}
function FiniquitoMetrics({ projects, series }: { readonly projects: readonly ProjectDistributionRow[]; readonly series: readonly DistributionKey[] }) {
    const total = projects.reduce((sum, project) => sum + stageTotal(project, series), 0);
    const completed = projects.reduce((sum, project) => sum + (project.counts.finiquito_formalized ?? 0), 0);
    const commercial = projects.reduce((sum, project) => sum + project.total, 0);
    const metrics = distributionMetrics(commercial, total);
    const progress = distributionPercent(total === 0 ? null : completed / total, "Sin órdenes");
    return (
        <dl className="formalization-distribution__metrics" aria-label="Gestión de finiquito por proyecto">
            <div>
                <dt>Total considerado</dt>
                <dd>{format.format(metrics.total)}</dd>
                <small>
                    {format.format(commercial)} comerciales + {format.format(total)} en finiquito
                </small>
            </div>
            <div>
                <dt>En finiquito</dt>
                <dd>{format.format(total)}</dd>
                <small>{distributionPercent(metrics.finiquitoShare)} del total considerado</small>
            </div>
            <div>
                <dt>Finiquito / comerciales</dt>
                <dd>{distributionPercent(metrics.finiquitoToCommercial, "Sin base comercial")}</dd>
                <small>
                    {format.format(total)} en finiquito / {format.format(commercial)} comerciales
                </small>
            </div>
            <div>
                <dt>Pendientes</dt>
                <dd>{format.format(total - completed)}</dd>
            </div>
            <div>
                <dt>Finalizados</dt>
                <dd>{format.format(completed)}</dd>
            </div>
            <div>
                <dt>Avance</dt>
                <dd>{progress}</dd>
            </div>
        </dl>
    );
}
function DistributionTrack({ project, series, maximum, onSelect, label }: { readonly project: ProjectDistributionRow; readonly series: readonly DistributionKey[]; readonly maximum: number; readonly onSelect: SelectDistribution; readonly label: string }) {
    const visible = series.filter((key) => (project.counts[key] ?? 0) > 0);
    return (
        <div className="formalization-distribution__circuit">
            <span className="formalization-distribution__circuit-label">{label}</span>
            <div className="formalization-distribution__track" role="group" aria-label={`${label} de ${project.name}`}>
                {visible.length === 0 && <span className="formalization-distribution__zero">Sin órdenes</span>}
                {visible.map((key) => {
                    const count = project.counts[key] ?? 0;
                    const width = (count / maximum) * 100;
                    const darkText = ["send", "finiquito_signed", "finiquito_formalized"].includes(key);
                    return (
                        <Tooltip key={key} title={description(project, key)} trigger={["hover", "focus"]}>
                            <button
                                type="button"
                                className="formalization-distribution__segment"
                                aria-label={description(project, key)}
                                onClick={() => {
                                    onSelect(key, project);
                                }}
                                style={{ width: `${String(width)}%`, background: stages[key].color, color: darkText ? "#451a1a" : "#ffffff" }}
                            >
                                {format.format(count)}
                            </button>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
}
function ProjectBar({ project, series, maximum, finiquito, finiquitoMaximum, addendum, onSelect }: { readonly project: ProjectDistributionRow; readonly series: readonly DistributionKey[]; readonly maximum: number; readonly finiquito: readonly DistributionKey[]; readonly finiquitoMaximum: number; readonly addendum: boolean; readonly onSelect: SelectDistribution }) {
    const finiquitoCount = stageTotal(project, finiquito);
    const metrics = distributionMetrics(project.total, finiquitoCount);
    return (
        <li className="formalization-distribution__row">
            <h3>{project.name}</h3>
            <div className="formalization-distribution__circuits">
                <DistributionTrack project={project} series={series} maximum={maximum} onSelect={onSelect} label="Comercial" />
                {finiquito.length > 0 && <DistributionTrack project={project} series={finiquito} maximum={finiquitoMaximum} onSelect={onSelect} label="Finiquito" />}
            </div>
            <ProjectQuantity count={project.total} share={finiquito.length ? metrics.commercialShare : null} label={`${project.name} · Comerciales`} total={metrics.total} />
            <ProjectQuantity count={finiquito.length ? finiquitoCount : null} share={finiquito.length ? metrics.finiquitoShare : null} label={`${project.name} · En finiquito`} total={metrics.total} tone="finiquito" />
            <ProjectComparison value={metrics.finiquitoToCommercial} count={finiquito.length ? finiquitoCount : null} commercial={project.total} name={project.name} />
            {addendum && (
                <button
                    type="button"
                    className="formalization-distribution__adendum"
                    aria-label={description(project, "addendum")}
                    onClick={() => {
                        onSelect("addendum", project);
                    }}
                >
                    {format.format(project.counts.addendum ?? 0)}
                </button>
            )}
        </li>
    );
}

/** La proporción se explica junto al conteo para que el lector conozca su base. */
function ProjectQuantity({ count, share, label, total, tone = "commercial" }: { readonly count: number | null; readonly share: number | null; readonly label: string; readonly total: number; readonly tone?: "commercial" | "finiquito" }) {
    const value = count === null ? "—" : format.format(count);
    return (
        <div className="formalization-distribution__quantity" data-tone={tone} aria-label={`${label}: ${value}; ${distributionPercent(share)} de ${format.format(total)} órdenes consideradas`}>
            <strong className="formalization-distribution__total">{value}</strong>
            <small>{distributionPercent(share)} del total</small>
        </div>
    );
}

function ProjectComparison({ value, count, commercial, name }: { readonly value: number | null; readonly count: number | null; readonly commercial: number; readonly name: string }) {
    return (
        <div className="formalization-distribution__comparison" aria-label={`${name} · Finiquito frente a comerciales`}>
            <strong>{count === null ? "—" : distributionPercent(value, "Sin base comercial")}</strong>
            <small>{count === null ? "" : `${format.format(count)} / ${format.format(commercial)}`}</small>
        </div>
    );
}
