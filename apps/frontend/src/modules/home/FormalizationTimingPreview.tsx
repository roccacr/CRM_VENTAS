import { FORMALIZATION_EXAMPLES, type FormalizationExample } from "./formalization-preview.model";

const timingExamples = [
    { id: "DEMO-OV-103", signed: "2026-09-24", started: "2026-09-26", completed: null },
    { id: "DEMO-OV-105", signed: "2026-10-01", started: "2026-10-03", completed: "2026-10-08" },
] as const;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
const dateFormat = new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

/** Fechas fijas para explicar indicadores sin inventar umbrales ni consultar servicios. */
export function FormalizationTimingPreview({ onOpenOrder }: { readonly onOpenOrder: (order: FormalizationExample) => void }) {
    return (
        <section className="formalization-card" aria-labelledby="bank-timing-title">
            <div className="formalization-card__head">
                <h2 id="bank-timing-title">Tiempos de gestión bancaria</h2>
                <span className="formalization-card__meta">Al 14/10/2026</span>
            </div>
            <div className="formalization-grid-scroll formalization-timing-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable de tiempos bancarios">
                <table className="formalization-grid formalization-grid--timing">
                    <caption className="formalization-sr">Duración por orden financiada</caption>
                    <thead>
                        <tr>
                            <th scope="col">Orden / Estado</th>
                            <th scope="col">Firma</th>
                            <th scope="col">Inicio bancario</th>
                            <th scope="col">Formalizado</th>
                            <th scope="col">Firma → Inicio</th>
                            <th scope="col">Gestión bancaria</th>
                            <th scope="col">Firma → Formalizado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timingExamples.map((timing) => {
                            const order = FORMALIZATION_EXAMPLES.find((item) => item.id === timing.id);
                            if (!order) return null;
                            return (
                                <tr key={timing.id}>
                                    <td>
                                        <button
                                            type="button"
                                            className="formalization-timing-link"
                                            onClick={() => {
                                                onOpenOrder(order);
                                            }}
                                        >
                                            {timing.id}
                                        </button>
                                        <p>{order.state}</p>
                                    </td>
                                    <td>{formatDate(timing.signed)}</td>
                                    <td>{formatDate(timing.started)}</td>
                                    <td>{timing.completed ? formatDate(timing.completed) : "En proceso"}</td>
                                    <td>{daysBetween(timing.signed, timing.started)} días</td>
                                    <td>
                                        {daysBetween(timing.started, timing.completed ?? "2026-10-14")} días {timing.completed ? "finalizada" : "transcurridos"}
                                    </td>
                                    <td>{timing.completed ? `${String(daysBetween(timing.signed, timing.completed))} días` : "Pendiente"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
