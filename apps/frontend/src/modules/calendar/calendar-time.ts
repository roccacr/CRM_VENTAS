import { Temporal } from "temporal-polyfill";

export const CALENDAR_TIME_ZONE = "America/Costa_Rica";
/** datetime-local inputs represent Costa Rica wall time, never the device's zone. */
export function localToUtc(value: string): string {
    return Temporal.PlainDateTime.from(value, { overflow: "reject" }).toZonedDateTime(CALENDAR_TIME_ZONE).toInstant().toString();
}
/** Preserves seconds and milliseconds when editing an event's Costa Rica wall time. */
export function utcToLocal(value: string): string {
    return Temporal.Instant.from(value).toZonedDateTimeISO(CALENDAR_TIME_ZONE).toPlainDateTime().toString({ smallestUnit: "millisecond" });
}
/** Today's date in the calendar's zone, independent of the device. */
export function calendarToday(): string {
    return Temporal.Now.zonedDateTimeISO(CALENDAR_TIME_ZONE).toPlainDate().toString();
}
/** An exclusive day boundary, including month/year rollovers. */
export function calendarNextDay(value: string): string {
    return Temporal.PlainDate.from(value).add({ days: 1 }).toString();
}
