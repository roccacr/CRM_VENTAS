import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import FileDoneOutlined from "@ant-design/icons/FileDoneOutlined";
import Button from "antd/es/button";

import { type FormalizationExample, formatOrderTotal, PREVIEW_PROJECTS, type PreviewFilter, type PreviewQueue } from "./formalization-preview.model";
import { useFormalizationPreview } from "./formalization-preview-session";

const stageColumns = [
    { stage: "Contratos", label: "Contratos", filter: "contracts" },
    { stage: "Gestión bancaria", label: "Banco", filter: "bank" },
    { stage: "Pendientes de saldo", label: "Saldo", filter: "balance" },
    { stage: "Traspasos", label: "Traspaso", filter: "transfer" },
] as const satisfies readonly { stage: string; label: string; filter: PreviewFilter }[];

function ProjectSummary({ onOpenQueue }: { readonly onOpenQueue: (scope: PreviewQueue) => void }) {
    const { orders: examples } = useFormalizationPreview();
    return (
        <section className="formalization-card" aria-labelledby="preview-projects-title">
            <div className="formalization-card__head">
                <h2 id="preview-projects-title">Pendientes por proyecto</h2>
                <span className="formalization-total">{formatOrderTotal(examples.filter((item) => stageColumns.some((column) => column.stage === item.stage)).length)}</span>
            </div>
            <table className="formalization-grid formalization-grid--summary">
                <caption className="formalization-sr">Órdenes por proyecto y etapa</caption>
                <thead>
                    <tr>
                        <th scope="col">Proyecto</th>
                        {stageColumns.map(({ label }) => (
                            <th key={label} scope="col">
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {PREVIEW_PROJECTS.map((project) => (
                        <tr key={project}>
                            <th scope="row">{project}</th>
                            {stageColumns.map(({ stage, filter }) => {
                                const count = examples.filter((item) => item.project === project && item.stage === stage).length;
                                return (
                                    <td key={stage}>
                                        <button
                                            type="button"
                                            className={`formalization-count${count > 0 ? " formalization-count--active" : ""}`}
                                            aria-label={`Ver ${stage} de ${project}`}
                                            onClick={() => {
                                                onOpenQueue({ filter, project });
                                            }}
                                        >
                                            {count}
                                        </button>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

function RecentActivity({ onOpenOrder }: { readonly onOpenOrder: (order: FormalizationExample) => void }) {
    const { orders: examples } = useFormalizationPreview();
    return (
        <section className="formalization-card" aria-labelledby="preview-activity-title">
            <div className="formalization-card__head">
                <h2 id="preview-activity-title">Movimientos recientes</h2>
            </div>
            <ol className="formalization-activity">
                {examples.slice(0, 3).map((item) => (
                    <li key={item.id}>
                        <time>{item.time}</time>
                        <div>
                            <strong>
                                <FileDoneOutlined aria-hidden="true" /> {item.event}
                            </strong>
                            <span>
                                {item.id} · {item.project} · {item.unit}
                            </span>
                        </div>
                        <Button
                            className="formalization-open"
                            icon={<ArrowRightOutlined />}
                            aria-label={`Ver movimiento de ${item.id}`}
                            title="Ver seguimiento"
                            onClick={() => {
                                onOpenOrder(item);
                            }}
                        />
                    </li>
                ))}
            </ol>
        </section>
    );
}

/** Resumen por proyecto y movimientos; cada número abre la bandeja filtrada que lo explica. */
export function FormalizationHomeInsights({ onOpenOrder, onOpenQueue }: { readonly onOpenOrder: (order: FormalizationExample) => void; readonly onOpenQueue: (scope: PreviewQueue) => void }) {
    return (
        <div className="formalization-insights">
            <ProjectSummary onOpenQueue={onOpenQueue} />
            <RecentActivity onOpenOrder={onOpenOrder} />
        </div>
    );
}
