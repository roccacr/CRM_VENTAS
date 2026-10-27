import { countFormat, describeChange, percentFormat } from "./marketing-home-format";
import { type groupMarketingSample } from "./marketing-home-preview.model";
import type { ProjectCard } from "./marketing-home-projects";
import { SparkArea } from "./MarketingHomeCharts";
import { DeltaText } from "./MarketingHomeSections";
import { InfoHint } from "./MarketingInfoHint";

const HORIZONS = [
    { key: "day", label: "Hoy" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "year", label: "Año" },
] as const;

interface ProjectComparison {
    readonly label: string;
    readonly current: string;
    readonly previous: string;
}

/** State the direction in words; color alone cannot explain a comparison. */
function projectDelta(card: ProjectCard, label: string) {
    const delta = describeChange(card.change, "%");
    if (!delta) return { direction: "flat" as const, text: card.leads > 0 ? "Sin leads antes" : "Sin leads en ambos periodos" };
    if (delta.direction === "flat") return { ...delta, text: `${delta.text} frente a ${label}` };
    return { ...delta, text: `${delta.text} ${delta.direction === "up" ? "m\u00e1s" : "menos"} que ${label}` };
}

function ProjectCardView({ card, periodWord, comparison }: { readonly card: ProjectCard; readonly periodWord: string; readonly comparison: ProjectComparison }) {
    return (
        <article className="marketing-project">
            <header>
                <h3>{card.label}</h3>
            </header>
            <p className="marketing-project__total">
                <strong>{countFormat.format(card.leads)}</strong> leads {periodWord}
            </p>
            <div className="marketing-project__comparison">
                <DeltaText delta={projectDelta(card, comparison.label)} />
                <span className="marketing-project__before">Antes: {countFormat.format(card.previousLeads)}</span>
            </div>
            <div className="marketing-project__spark">
                <SparkArea values={card.series} />
            </div>
            <dl className="marketing-project__horizons">
                {HORIZONS.map(({ key, label }) => (
                    <div key={key}>
                        <dt>{label}</dt>
                        <dd>{countFormat.format(card.horizons[key])}</dd>
                    </div>
                ))}
            </dl>
        </article>
    );
}

/** Where leads concentrate. With a seller chosen it lists only the projects assigned to them. */
export function MarketingProjects({ cards, periodWord, seller, comparison }: { readonly cards: readonly ProjectCard[]; readonly periodWord: string; readonly seller: string; readonly comparison: ProjectComparison }) {
    return (
        <section className="marketing-card marketing-projects" aria-labelledby="marketing-projects-title">
            <div className="marketing-card__heading">
                <div>
                    <h2 id="marketing-projects-title">
                        Leads por proyecto
                        <InfoHint label="leads por proyecto">{`${seller ? `Leads de ${seller}, agrupados por proyecto.` : "Cada proyecto con su tendencia y lo captado hoy, en la semana, el mes y el año."} Compara ${comparison.current} con ${comparison.previous}. Se aplican los filtros elegidos.`}</InfoHint>
                    </h2>
                </div>
            </div>
            <div className="marketing-projects__grid">
                {cards.map((card) => (
                    <ProjectCardView key={card.name} card={card} periodWord={periodWord} comparison={comparison} />
                ))}
                {cards.length === 0 && <p className="marketing-preview-empty">No hay información de proyectos disponible.</p>}
            </div>
        </section>
    );
}

/** Everyone, always: the list is how a seller gets picked, so it ignores the seller filter. */
export function MarketingSellers({ groups, selected, onSelect, appointmentsAvailable = true, comparisonLabel }: { readonly groups: ReturnType<typeof groupMarketingSample>; readonly selected: readonly string[]; readonly onSelect: (sellers: readonly string[]) => void; readonly appointmentsAvailable?: boolean; readonly comparisonLabel?: string }) {
    const maximum = Math.max(1, ...groups.map((group) => group.leads));
    return (
        <section className="marketing-card" aria-labelledby="marketing-sellers-title">
            <div className="marketing-card__heading">
                <div>
                    <h2 id="marketing-sellers-title">
                        Leads por vendedor
                        <InfoHint label="leads por vendedor">{`Pulsa un vendedor para filtrar el resumen y otra vez para quitarlo.${comparisonLabel ? ` La variación se compara con ${comparisonLabel}.` : ""} El porcentaje con cita usa los leads registrados en el periodo.`}</InfoHint>
                    </h2>
                </div>
            </div>
            {groups.length === 0 && <p className="marketing-preview-empty">No hay información de vendedores disponible.</p>}
            <ul className="marketing-sellers">
                {groups.map((group) => (
                    <li key={group.name}>
                        <button
                            type="button"
                            aria-pressed={selected.includes(group.name)}
                            onClick={() => {
                                onSelect(selected.includes(group.name) ? selected.filter((id) => id !== group.name) : [...selected, group.name]);
                            }}
                        >
                            <span className="marketing-sellers__name">{group.label}</span>
                            <span className="marketing-sellers__bar" aria-hidden="true">
                                <i style={{ width: `${String((group.leads / maximum) * 100)}%` }} />
                            </span>
                            <strong>{countFormat.format(group.leads)}</strong>
                            <span className="marketing-sellers__rate">{appointmentsAvailable && group.leads > 0 ? `${percentFormat.format(group.rate)} % con cita` : "—"}</span>
                            <DeltaText delta={group.previousLeads === 0 && group.leads > 0 ? { direction: "flat", text: "Sin leads antes" } : describeChange(group.change, "%")} />
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
