import { countFormat, percentFormat } from "../home/marketing-home-format";
import { type CaptureDepth, type CaptureKpiFigures, type CaptureMeasure, captureMeasureInfo } from "./lead-capture-report";

interface Tile {
    readonly key: string;
    readonly label: string;
    readonly value: string;
    readonly caption: string;
}

/** Los tres banners de cada medida: cuántos, qué parte de todos los leads o cuántos proyectos, y el promedio por proyecto, campaña o anuncio. El promedio es el total dividido entre los grupos y se explica en el pie. */
const UNITS: Record<CaptureDepth, { readonly one: string; readonly many: string; readonly path: string }> = {
    1: { one: "proyecto", many: "proyectos", path: "proyecto" },
    2: { one: "campaña", many: "campañas", path: "proyecto › campaña" },
    3: { one: "anuncio", many: "anuncios", path: "proyecto › campaña › anuncio" },
};

function tilesFor(figures: CaptureKpiFigures, measure: CaptureMeasure, depth: CaptureDepth): Tile[] {
    const unit = measure === "lossReasons" ? { one: "motivo", many: "motivos", path: "motivo" } : UNITS[depth];
    const info = measure === "lossReasons" ? { label: "Leads perdidos", noun: "leads perdidos" } : captureMeasureInfo(measure);
    const second: Tile = measure === "leads" ? { key: "projects", label: "Proyectos con leads", value: countFormat.format(figures.projects), caption: "con al menos un lead en el periodo" } : { key: "share", label: `${info.label} · % general`, value: figures.share === null ? "—" : `${percentFormat.format(figures.share)} %`, caption: "de todos los leads del periodo" };
    return [{ key: "total", label: info.label, value: countFormat.format(figures.total), caption: "en el periodo, con el filtro actual" }, second, { key: "average", label: `Promedio de ${info.noun} por ${unit.one}`, value: percentFormat.format(figures.average), caption: `${countFormat.format(figures.total)} ${info.noun} ÷ ${countFormat.format(figures.units)} ${figures.units === 1 ? unit.one : unit.many} con leads` }];
}

/** Banners de indicadores sobre el gráfico. Siguen los mismos filtros y la misma selección de proyectos que el gráfico. */
export function CaptureKpis({ figures, measure, depth }: { readonly figures: CaptureKpiFigures; readonly measure: CaptureMeasure; readonly depth: CaptureDepth }) {
    return (
        <ul className="capture-kpis" aria-label="Indicadores del periodo">
            {tilesFor(figures, measure, depth).map((tile) => (
                <li className="capture-kpis__tile" key={tile.key}>
                    <span className="capture-kpis__label">{tile.label}</span>
                    <strong className="capture-kpis__value">{tile.value}</strong>
                    <span className="capture-kpis__caption">{tile.caption}</span>
                </li>
            ))}
        </ul>
    );
}
