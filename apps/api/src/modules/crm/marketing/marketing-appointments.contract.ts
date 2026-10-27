import type { MarketingEntity } from "./marketing-home.contract.js";

export type AppointmentState = "scheduled" | "completed" | "cancelled" | "unknown";
export type AppointmentAttendance = "attended" | "missed" | null;
export interface AppointmentDimensions {
    sellerId: string;
    projectId: string;
}
export interface MarketingAppointmentEvent {
    id: string;
    date: string;
    status: AppointmentState;
    attendance: AppointmentAttendance;
    links: AppointmentDimensions[];
}
export interface MarketingAppointmentCohort extends AppointmentDimensions {
    date: string;
    withAppointment: number;
}
export type MarketingAppointments =
    | { available: false }
    | {
          available: true;
          events: MarketingAppointmentEvent[];
          leadsWithAppointment: MarketingAppointmentCohort[];
          quality: { unresolvedLinks: number; invalidDates: number; unknownStatuses: number; nativeTypeConfigured: boolean };
      };
export interface NativeAppointmentLead extends AppointmentDimensions {
    id: string;
    date: string;
}
export interface NativeAppointmentAlias extends AppointmentDimensions {
    id: string;
    system: string;
    externalId: string;
}
export interface NativeAppointmentEvent extends NativeAppointmentLead {
    eventId: string;
    status: AppointmentState;
    attendance: AppointmentAttendance;
}
export interface NativeAppointmentEvidence {
    cohorts: NativeAppointmentLead[];
    aliases: NativeAppointmentAlias[];
    events: NativeAppointmentEvent[];
    typeCount: number;
}
export interface LegacyAppointmentLead {
    id: string;
    date: string;
    providerId: string;
    providerMatches: number;
    sellerReference: string;
    projectReference: string;
    projectName: string | null;
}
export interface LegacyAppointmentEvent extends Omit<LegacyAppointmentLead, "date"> {
    eventId: string;
    date: string;
    status: AppointmentState;
    attendance: AppointmentAttendance;
}
export interface LegacyAppointmentEvidence {
    cohorts: LegacyAppointmentLead[];
    events: LegacyAppointmentEvent[];
    invalidDates: number;
    unresolvedEventIds?: string[];
}
export interface AppointmentIdentityResolvers {
    nativeSeller: (id: string) => MarketingEntity;
    nativeProject: (id: string) => MarketingEntity;
    legacySeller: (reference: string) => MarketingEntity;
    legacyProject: (reference: string, name: string | null) => MarketingEntity;
}
