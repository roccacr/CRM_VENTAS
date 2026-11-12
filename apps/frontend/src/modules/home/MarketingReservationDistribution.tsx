import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { useMemo, useState } from "react";

import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import { countFormat, percentFormat } from "./marketing-home-format";
import type { MarketingSampleRow } from "./marketing-home-preview.model";

interface Props {
    readonly rows: readonly MarketingSampleRow[];
    readonly periodLabel: string;
    readonly available: boolean;
    readonly reservationsAvailable: boolean | undefined;
}

/** Usa las mismas cohortes ya autorizadas de la tarjeta. Al perder disponibilidad se desmonta también el modal. */
export function MarketingReservationDistribution({ available, reservationsAvailable, rows, periodLabel }: Props) {
    if (!available || !reservationsAvailable)
        return (
            <Button className="marketing-welcome__link" disabled>
                Ver reservas por proyecto
            </Button>
        );
    return <ReservationDistributionAction rows={rows} periodLabel={periodLabel} />;
}

function ReservationDistributionAction({ rows, periodLabel }: Pick<Props, "rows" | "periodLabel">) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button
                className="marketing-welcome__link"
                onClick={() => {
                    setOpen(true);
                }}
            >
                Ver reservas por proyecto
            </Button>
            <Modal
                title="Leads con reserva por proyecto"
                open={open}
                width="min(1000px, 96vw)"
                zIndex={ADMINISTRATION_MODAL_Z_INDEX}
                centered
                footer={null}
                destroyOnHidden
                onCancel={() => {
                    setOpen(false);
                }}
            >
                {open && <ReservationDistributionContent rows={rows} periodLabel={periodLabel} />}
            </Modal>
        </>
    );
}

function ReservationDistributionContent({ rows, periodLabel }: Pick<Props, "rows" | "periodLabel">) {
    const projects = useMemo(() => {
        const grouped = new Map<string, { id: string; name: string; count: number }>();
        for (const row of rows) {
            const count = row.withReservation ?? 0;
            if (count === 0) continue;
            const project = grouped.get(row.project) ?? { id: row.project, name: row.projectName ?? row.project, count: 0 };
            project.count += count;
            grouped.set(row.project, project);
        }
        return [...grouped.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
    }, [rows]);
    const total = projects.reduce((sum, project) => sum + project.count, 0);
    const maximum = Math.max(1, ...projects.map((project) => project.count));
    return (
        <section className="marketing-reservation-distribution">
            <div className="marketing-reservation-distribution__summary">
                <strong>
                    {countFormat.format(total)} {total === 1 ? "lead con reserva" : "leads con reserva"} en {countFormat.format(projects.length)} {projects.length === 1 ? "proyecto" : "proyectos"}
                </strong>
                <span>{periodLabel}</span>
            </div>
            <p className="marketing-reservation-distribution__note">Con reserva o pre-reserva. Cada lead cuenta una sola vez, aunque tenga ambas. Se aplican los mismos filtros de la tarjeta.</p>
            {projects.length === 0 ? (
                <p role="status">No hay leads con reserva o pre-reserva en el período seleccionado.</p>
            ) : (
                <div className="marketing-reservation-distribution__scroll" tabIndex={0} role="region" aria-label="Gráfico de leads con reserva por proyecto">
                    <table aria-label="Distribución de leads con reserva por proyecto">
                        <thead>
                            <tr>
                                <th scope="col">Proyecto</th>
                                <th scope="col">Leads con reserva</th>
                                <th scope="col">% del total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map((project) => (
                                <tr key={project.id}>
                                    <th scope="row">{project.name}</th>
                                    <td>
                                        <div className="marketing-reservation-distribution__quantity">
                                            <div className="marketing-reservation-distribution__track" aria-hidden="true">
                                                <span style={{ width: `${String((project.count / maximum) * 100)}%` }} />
                                            </div>
                                            <strong>{countFormat.format(project.count)}</strong>
                                        </div>
                                    </td>
                                    <td>{percentFormat.format((project.count / total) * 100)} %</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">Total</th>
                                <td>{countFormat.format(total)}</td>
                                <td>100 %</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </section>
    );
}
