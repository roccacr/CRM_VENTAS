/** Membresías ordenadas del banner. El cierre y el adéndum pueden coincidir con otras series. */
export const distributionKeys = ["approvals", "send", "signature", "bank_not_started", "bank_in_progress", "balance", "transfer", "signed", "closed", "addendum"] as const;
export type DistributionKey = (typeof distributionKeys)[number];
export interface ProjectDistributionResponse {
    schemaVersion: 1;
    observedAt: string;
    totalOrders: number;
    series: DistributionKey[];
    projects: { id: string | null; name: string; total: number; counts: Partial<Record<DistributionKey, number>> }[];
}
