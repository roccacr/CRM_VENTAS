import type { MarketingSampleRow } from "../../../src/modules/home/marketing-home-preview.model";

const SAMPLE_DAYS = 800;

const COMBINATIONS: readonly { project: string; campaign: string; ad: string; seller: string; rate: number; since?: number }[] = [
    { project: "Proyecto Norte", campaign: "Lanzamiento", ad: "Recorrido en video", seller: "Dayan", rate: 0.34 },
    { project: "Proyecto Norte", campaign: "Lanzamiento", ad: "Carrusel de espacios", seller: "Gabriel", rate: 0.3 },
    { project: "Proyecto Norte", campaign: "Visita guiada", ad: "Recorrido en video", seller: "Dayan", rate: 0.36 },
    { project: "Proyecto Parque", campaign: "Lanzamiento", ad: "Recorrido en video", seller: "Marlon", rate: 0.38 },
    { project: "Proyecto Parque", campaign: "Visita guiada", ad: "Carrusel de espacios", seller: "Gabriel", rate: 0.42 },
    { project: "Proyecto Parque", campaign: "Visita guiada", ad: "Imagen del proyecto", seller: "Dayan", rate: 0.33 },
    { project: "Proyecto Centro", campaign: "Fin de semana", ad: "Imagen del proyecto", seller: "Marlon", rate: 0.35 },
    { project: "Proyecto Centro", campaign: "Fin de semana", ad: "Recorrido en video", seller: "Gabriel", rate: 0.37 },
    { project: "Proyecto Centro", campaign: "Visita guiada", ad: "Imagen del proyecto", seller: "Valeria", rate: 0.36 },
    { project: "Proyecto Norte", campaign: "Fin de semana", ad: "Carrusel de espacios", seller: "Valeria", rate: 0.33 },
    // A recent ad, so "since it started" has something real to show.
    { project: "Proyecto Parque", campaign: "Lanzamiento", ad: "Reel nuevo", seller: "Marlon", rate: 0.44, since: 18 },
];

/** Deterministic pseudo-random value in [0, 1) so the demo never changes between renders or tests. */
function noise(day: number, slot: number, salt: number): number {
    const hash = Math.imul(day * 31 + slot * 17 + salt * 7 + 12345, 2654435761) >>> 0;
    return ((hash >>> 8) % 1000) / 1000;
}

/** Only recent appointments can still be pending; older ones are either done or missed. */
function pendingAppointments(daysAgo: number, appointments: number): number {
    if (daysAgo <= 2) return appointments;
    if (daysAgo <= 7) return Math.round(appointments * 0.5);
    return daysAgo <= 14 ? Math.round(appointments * 0.15) : 0;
}

type Combination = (typeof COMBINATIONS)[number];

/** Combinations that exist on that day: a recent ad only appears after its launch. */
function activeCombination(daysAgo: number, slot: number): Combination {
    const pool = COMBINATIONS.filter((combination) => combination.since === undefined || daysAgo < combination.since);
    return pool[(daysAgo * 3 + slot + (daysAgo % 5)) % pool.length] ?? COMBINATIONS[0] ?? { project: "", campaign: "", ad: "", seller: "", rate: 0.35 };
}

/** Appointment outcomes for the leads of one row. */
function appointmentOutcome(daysAgo: number, slot: number, withAppointment: number) {
    const appointments = withAppointment + (withAppointment > 0 && noise(daysAgo, slot, 3) < 0.25 ? 1 : 0);
    const pending = pendingAppointments(daysAgo, appointments);
    // Rounding a 14% rate over one or two appointments always yields zero, so roll the dice per row instead.
    const settled = appointments - pending;
    const missed = settled > 0 && noise(daysAgo, slot, 4) < settled * 0.16 ? 1 : 0;
    return { appointments, attended: settled - missed, missed };
}

/** One combination on one day, with recent growth and a mild seasonal swing so periods differ. */
function buildRow(daysAgo: number, slot: number): MarketingSampleRow {
    const { project, campaign, ad, seller, rate } = activeCombination(daysAgo, slot);
    const growth = (1 + Math.max(0, (360 - daysAgo) / 360) * 0.2) * (1 + 0.15 * Math.sin(daysAgo / 9));
    const leads = Math.max(1, Math.round((3 + noise(daysAgo, slot, 1) * 7) * growth));
    const withAppointment = Math.min(leads, Math.round(leads * (rate + (noise(daysAgo, slot, 2) - 0.5) * 0.1)));
    return { project, campaign, ad, seller, daysAgo, leads, withAppointment, ...appointmentOutcome(daysAgo, slot, withAppointment) };
}

/** Three active combinations per day over more than two years: any period and its year-ago twin have data. */
function buildSample(): MarketingSampleRow[] {
    return Array.from({ length: SAMPLE_DAYS * 3 }, (_, index) => buildRow(Math.floor(index / 3), index % 3));
}

export const MARKETING_SAMPLE: readonly MarketingSampleRow[] = buildSample();
