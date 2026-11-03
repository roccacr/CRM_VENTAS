import "./FormalizationProjectDistribution.css";

import BarChartOutlined from "@ant-design/icons/BarChartOutlined";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import Skeleton from "antd/es/skeleton";
import Tooltip from "antd/es/tooltip";
import { useEffect, useRef, useState } from "react";

import { type DistributionKey, getProjectDistribution, type ProjectDistribution, type ProjectDistributionRow } from "../../services/formalization/project-distribution-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";

const stages: Readonly<Record<DistributionKey, { label: string; color: string }>> = {
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
export function FormalizationProjectDistribution({ enabled }: { readonly enabled: boolean }) {
    return enabled ? <DistributionAction /> : null;
}
function DistributionAction() {
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
                {open && <DistributionContent />}
            </Modal>
        </>
    );
}
function DistributionContent() {
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
    return <DistributionChart data={data} />;
}
function DistributionChart({ data }: { readonly data: ProjectDistribution }) {
    const series = data.series.filter((key) => key !== "addendum");
    const maximum = Math.max(1, ...data.projects.map((project) => series.reduce((sum, key) => sum + (project.counts[key] ?? 0), 0)));
    return (
        <section className="formalization-distribution" aria-label="Órdenes por proyecto y bandeja">
            <div className="formalization-distribution__summary">
                <strong>
                    {quantity(data.totalOrders)} en {format.format(data.projects.length)} {data.projects.length === 1 ? "proyecto" : "proyectos"}
                </strong>
                <span>Vista completa según tus permisos</span>
            </div>
            <ul className="formalization-distribution__legend" aria-label="Colores por estado">
                {data.series.map((key) => (
                    <li key={key}>
                        <i style={{ background: stages[key].color }} aria-hidden="true" />
                        {stages[key].label}
                        {key === "addendum" ? " · marca adicional" : ""}
                    </li>
                ))}
            </ul>
            <p className="formalization-distribution__note">Los colores siguen las condiciones de los banners. Una orden puede coincidir con más de una bandeja. Adéndum se muestra por separado.</p>
            {data.projects.length === 0 ? (
                <p className="formalization-distribution__empty">No hay órdenes para mostrar en tus bandejas autorizadas.</p>
            ) : (
                <>
                    <div className="formalization-distribution__scroll" tabIndex={0} role="region" aria-label="Gráfico de distribución por proyecto">
                        <div className="formalization-distribution__column-head">
                            <span>Proyecto</span>
                            <span>Distribución por bandeja</span>
                            <span>Órdenes</span>
                            {data.series.includes("addendum") && <span>Adéndum</span>}
                        </div>
                        <ol className="formalization-distribution__projects">
                            {data.projects.map((project) => (
                                <ProjectBar key={project.id ?? "no-project"} project={project} series={series} maximum={maximum} addendum={data.series.includes("addendum")} />
                            ))}
                        </ol>
                    </div>
                </>
            )}
            <p className="formalization-distribution__updated">Actualizado {new Date(data.observedAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}</p>
        </section>
    );
}
function ProjectBar({ project, series, maximum, addendum }: { readonly project: ProjectDistributionRow; readonly series: readonly DistributionKey[]; readonly maximum: number; readonly addendum: boolean }) {
    return (
        <li className="formalization-distribution__row">
            <h3>{project.name}</h3>
            <div className="formalization-distribution__track" role="group" aria-label={`Bandejas de ${project.name}`}>
                {series
                    .filter((key) => (project.counts[key] ?? 0) > 0)
                    .map((key) => {
                        const count = project.counts[key] ?? 0;
                        const width = (count / maximum) * 100;
                        return (
                            <Tooltip key={key} title={description(project, key)} trigger={["hover", "focus"]}>
                                <span className="formalization-distribution__segment" role="img" tabIndex={0} aria-label={description(project, key)} style={{ width: `${String(width)}%`, background: stages[key].color, color: key === "send" ? "#1f2937" : "#ffffff" }}>
                                    {width >= 6 ? format.format(count) : null}
                                </span>
                            </Tooltip>
                        );
                    })}
            </div>
            <strong className="formalization-distribution__total">{format.format(project.total)}</strong>
            {addendum && (
                <span className="formalization-distribution__adendum" aria-label={description(project, "addendum")}>
                    {format.format(project.counts.addendum ?? 0)}
                </span>
            )}
        </li>
    );
}
