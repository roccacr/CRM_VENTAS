const percent = new Intl.NumberFormat("es-CR", { style: "percent", maximumFractionDigits: 1 });

/** Compara órdenes únicas de dos circuitos disjuntos; las membresías de bandeja no son el denominador. */
export function distributionMetrics(commercial: number, finiquito: number) {
    const total = commercial + finiquito;
    return {
        total,
        commercialShare: total > 0 ? commercial / total : null,
        finiquitoShare: total > 0 ? finiquito / total : null,
        finiquitoToCommercial: commercial > 0 ? finiquito / commercial : null,
    };
}

/** Un denominador ausente no equivale a 0 % ni a infinito. */
export function distributionPercent(value: number | null, empty = "—"): string {
    return value === null ? empty : percent.format(value);
}
