import { countFormat, describeChange, percentFormat } from "./marketing-home-format";
import {
    type groupMarketingSample,
} from "./marketing-home-preview.model";
import type { ProjectCard } from "./marketing-home-projects";
import { SparkArea } from "./MarketingHomeCharts";
import { DeltaText } from "./MarketingHomeSections";


const HORIZONS = [
    { key: "day", label: "Hoy" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
    { key: "year", label: "Año" },
] as const;

function ProjectCardView({ card, periodWord }: { readonly card: ProjectCard; readonly periodWord: string }) {
    return (
        <article className="marketing-project">
            <header>
                <h3>{card.name}</h3>
                <DeltaText delta={card.isNew ? { direction: "flat", text: "Nuevo" } : describeChange(card.change, "%")} />
            </header>
            <p className="marketing-project__total">
                <strong>{countFormat.format(card.leads)}</strong> leads {periodWord}
            </p>
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
export function MarketingProjects({ cards, periodWord, seller }: { readonly cards: readonly ProjectCard[]; readonly periodWord: string; readonly seller: string }) {
    return (
        <section className="marketing-card marketing-projects" aria-labelledby="marketing-projects-title">
            <div className="marketing-card__heading">
                <div>
                    <h2 id="marketing-projects-title">Leads por proyecto</h2>
                    <p>{seller ? `Proyectos asignados a ${seller}. Cada fila muestra lo suyo.` : "Cada proyecto con su tendencia y lo captado hoy, en la semana, el mes y el año."}</p>
                </div>
            </div>
            <div className="marketing-projects__grid">
                {cards.map((card) => (
                    <ProjectCardView key={card.name} card={card} periodWord={periodWord} />
                ))}
                {cards.length === 0 && <p className="marketing-preview-empty">No hay proyectos con estos filtros.</p>}
            </div>
        </section>
    );
}

/** Everyone, always: the list is how a seller gets picked, so it ignores the seller filter. */
export function MarketingSellers({ groups, selected, onSelect }: { readonly groups: ReturnType<typeof groupMarketingSample>; readonly selected: string; readonly onSelect: (seller: string) => void }) {
    const maximum = Math.max(1, ...groups.map((group) => group.leads));
    return (
        <section className="marketing-card" aria-labelledby="marketing-sellers-title">
            <div className="marketing-card__heading">
                <div>
                    <h2 id="marketing-sellers-title">Leads por vendedor</h2>
                    <p>Toca un vendedor para ver todo lo suyo; vuelve a tocarlo para ver el panorama global.</p>
                </div>
            </div>
            <ul className="marketing-sellers">
                {groups.map((group) => (
                    <li key={group.name}>
                        <button
                            type="button"
                            aria-pressed={selected === group.name}
                            onClick={() => {
                                onSelect(selected === group.name ? "" : group.name);
                            }}
                        >
                            <span className="marketing-sellers__name">{group.name}</span>
                            <span className="marketing-sellers__bar" aria-hidden="true">
                                <i style={{ width: `${String((group.leads / maximum) * 100)}%` }} />
                            </span>
                            <strong>{countFormat.format(group.leads)}</strong>
                            <span className="marketing-sellers__rate">{group.leads > 0 ? `${percentFormat.format(group.rate)} % con cita` : "—"}</span>
                            <DeltaText delta={group.previousLeads === 0 && group.leads > 0 ? { direction: "flat", text: "Nuevo" } : describeChange(group.change, "%")} />
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
