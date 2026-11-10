import { Temporal } from "temporal-polyfill";

export const CALENDAR_TIME_ZONE = "America/Costa_Rica";
/** El input de fecha y hora es hora de pared de Costa Rica. Una fecha inválida se rechaza y no se corre al día siguiente. */
export function localToUtc(value: string): string {
    return Temporal.PlainDateTime.from(value, { overflow: "reject" }).toZonedDateTime(CALENDAR_TIME_ZONE).toInstant().toString();
}
/** Al editar, conserva segundos y milisegundos de la hora de pared de Costa Rica. */
export function utcToLocal(value: string): string {
    return Temporal.Instant.from(value).toZonedDateTimeISO(CALENDAR_TIME_ZONE).toPlainDateTime().toString({ smallestUnit: "millisecond" });
}
/** La fecha de hoy en la zona del calendario, aparte de la zona del dispositivo. */
export function calendarToday(): string {
    return Temporal.Now.zonedDateTimeISO(CALENDAR_TIME_ZONE).toPlainDate().toString();
}
/** El límite exclusivo del día siguiente, también cuando cambia el mes o el año. */
export function calendarNextDay(value: string): string {
    return Temporal.PlainDate.from(value).add({ days: 1 }).toString();
}
