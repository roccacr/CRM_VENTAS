const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";

/**
 * Prisma escribe `Date` como instante UTC. Para columnas legacy que el CRM
 * presenta como hora local sin zona, guardamos el reloj de Costa Rica como si
 * fuera UTC y evitamos mostrar movimientos seis horas adelante.
 */
export function createCostaRicaWallClockDate(now = new Date()): Date {
    const parts = new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
        month: "2-digit",
        second: "2-digit",
        timeZone: COSTA_RICA_TIME_ZONE,
        year: "numeric",
    }).formatToParts(now);
    const valueByType = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    return new Date(Date.UTC(Number(valueByType.year), Number(valueByType.month) - 1, Number(valueByType.day), Number(valueByType.hour), Number(valueByType.minute), Number(valueByType.second)));
}
