import { describeRange, nameRange } from "./marketing-home-format";
import { canAdvanceMarketingSelection, firstMarketingActivity, MARKETING_COMPARISONS, MARKETING_PERIOD_MODES, type MarketingComparison, type MarketingPeriodMode, type MarketingPreviewFilters, type MarketingRange, type MarketingSelection, parseISODate, shiftMarketingSelection, toISODate } from "./marketing-home-preview.model";

const monthNames = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat("es-CR", { month: "long" }).format(new Date(2026, month, 1)));

interface PickerProps {
    readonly selection: MarketingSelection;
    readonly today: Date;
    readonly onChange: (selection: MarketingSelection) => void;
}

/** Los inputs nativos de fecha conservan el teclado, el idioma y el selector móvil. Un valor vacío o inválido se ignora. */
function DateField({ label, text = label, value, max, onPick }: { readonly label: string; readonly text?: string; readonly value: string; readonly max: string; readonly onPick: (value: string) => void }) {
    return (
        <label className="marketing-period__field">
            <span>{text}</span>
            <input
                type="date"
                aria-label={label}
                value={value}
                max={max}
                onChange={(event) => {
                    if (parseISODate(event.target.value)) onPick(event.target.value);
                }}
            />
        </label>
    );
}

/** El mes son dos selectores, no un input de mes, porque Firefox y Safari de escritorio no lo pintan como selector. */
function MonthFields({ selection, today, onChange }: PickerProps) {
    const anchor = parseISODate(selection.anchor) ?? today;
    const years = Array.from({ length: 3 }, (_, index) => today.getFullYear() - 2 + index);
    const pick = (year: number, month: number) => {
        const first = new Date(year, month, 1);
        onChange({ ...selection, anchor: toISODate(first > today ? today : first) });
    };
    return (
        <>
            <label className="marketing-period__field">
                <span>Mes</span>
                <select
                    aria-label="Mes"
                    value={anchor.getMonth()}
                    onChange={(event) => {
                        pick(anchor.getFullYear(), Number(event.target.value));
                    }}
                >
                    {monthNames.map((name, month) => (
                        <option key={name} value={month}>
                            {name}
                        </option>
                    ))}
                </select>
            </label>
            <label className="marketing-period__field">
                <span>Año</span>
                <select
                    aria-label="Año"
                    value={anchor.getFullYear()}
                    onChange={(event) => {
                        pick(Number(event.target.value), anchor.getMonth());
                    }}
                >
                    {years.map((year) => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </label>
        </>
    );
}

const FIELD_LABEL: Record<Exclude<MarketingPeriodMode, "month" | "range">, string> = { day: "Día", week: "Un día de la semana", year: "Un día del año" };

/** Los inputs de la unidad elegida: una fecha para día o semana, mes y año, o dos fechas para un rango. */
function PeriodFields(props: PickerProps) {
    const { selection, today, onChange } = props;
    const max = toISODate(today);
    if (selection.mode === "month") return <MonthFields {...props} />;
    if (selection.mode === "range") {
        return (
            <>
                <DateField
                    label="Desde"
                    value={selection.rangeStart}
                    max={max}
                    onPick={(rangeStart) => {
                        onChange({ ...selection, rangeStart });
                    }}
                />
                <DateField
                    label="Hasta"
                    value={selection.rangeEnd}
                    max={max}
                    onPick={(rangeEnd) => {
                        onChange({ ...selection, rangeEnd });
                    }}
                />
            </>
        );
    }
    return (
        <DateField
            label={FIELD_LABEL[selection.mode]}
            value={selection.anchor}
            max={max}
            onPick={(anchor) => {
                onChange({ ...selection, anchor });
            }}
        />
    );
}

/** Solo la comparación personalizada pide fechas. Las demás opciones salen del periodo. */
function CompareFields({ selection, today, onChange }: PickerProps) {
    const max = toISODate(today);
    return (
        <>
            <label className="marketing-period__field marketing-period__field--wide">
                <select
                    aria-label="Comparar con"
                    value={selection.comparison}
                    onChange={(event) => {
                        onChange({ ...selection, comparison: event.target.value as MarketingComparison });
                    }}
                >
                    {MARKETING_COMPARISONS.map((option) => (
                        <option key={option.key} value={option.key}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
            {selection.comparison === "custom" && (
                <>
                    <DateField
                        label="Comparar desde"
                        text="Desde"
                        value={selection.compareStart}
                        max={max}
                        onPick={(compareStart) => {
                            onChange({ ...selection, compareStart });
                        }}
                    />
                    <DateField
                        label="Comparar hasta"
                        text="Hasta"
                        value={selection.compareEnd}
                        max={max}
                        onPick={(compareEnd) => {
                            onChange({ ...selection, compareEnd });
                        }}
                    />
                </>
            )}
        </>
    );
}

interface MarketingPeriodPickerProps {
    readonly filters: MarketingPreviewFilters;
    readonly today: Date;
    readonly period: MarketingRange;
    readonly comparison: MarketingRange;
    readonly onChange: (filters: MarketingPreviewFilters) => void;
}

/** Día, semana, mes o rango libre, con flechas para avanzar en el tiempo y una comparación que la persona puede cambiar. */
export function MarketingPeriodPicker({ filters, today, period, comparison, onChange }: MarketingPeriodPickerProps) {
    const { selection } = filters;
    const update = (next: MarketingSelection) => {
        onChange({ ...filters, selection: next });
    };
    const start = filters.ad ? firstMarketingActivity(filters, today) : null;
    return (
        <section className="marketing-period" aria-label="Periodo y comparación">
            <div className="marketing-period__groups">
                <div className="marketing-period__group">
                    <span className="marketing-period__legend">Periodo</span>
                    <div className="marketing-period__controls">
                        <div className="marketing-preview-grouping" role="group" aria-label="Tipo de periodo">
                            {MARKETING_PERIOD_MODES.map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={selection.mode === key}
                                    onClick={() => {
                                        update({ ...selection, mode: key });
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="marketing-period__stepper">
                            <button
                                type="button"
                                aria-label="Periodo anterior"
                                onClick={() => {
                                    update(shiftMarketingSelection(selection, -1, today));
                                }}
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                aria-label="Periodo siguiente"
                                disabled={!canAdvanceMarketingSelection(selection, today)}
                                onClick={() => {
                                    update(shiftMarketingSelection(selection, 1, today));
                                }}
                            >
                                ›
                            </button>
                        </div>
                        <PeriodFields selection={selection} today={today} onChange={update} />
                        {start && (
                            <button
                                type="button"
                                className="marketing-preview-button marketing-period__since"
                                onClick={() => {
                                    update({ ...selection, mode: "range", rangeStart: toISODate(start), rangeEnd: toISODate(today), comparison: "previous" });
                                }}
                            >
                                Desde que empezó este anuncio
                            </button>
                        )}
                    </div>
                </div>
                <div className="marketing-period__group">
                    <span className="marketing-period__legend">Comparar con</span>
                    <div className="marketing-period__controls">
                        <CompareFields selection={selection} today={today} onChange={update} />
                    </div>
                </div>
            </div>
            <p className="marketing-period__summary">
                Viendo <strong>{describeRange(period)}</strong> · comparado con <strong>{describeRange(comparison)}</strong>
                {nameRange(period, today) === "hoy" && nameRange(comparison, today) === "ayer" ? " (resumen rápido: hoy contra ayer)" : ""}
            </p>
        </section>
    );
}
