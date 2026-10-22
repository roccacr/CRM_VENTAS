export const APPROVAL_LEGACY_READER = Symbol("APPROVAL_LEGACY_READER");

/** Temporary read-only source; cursor pages contain legacy identities only. */
export interface ApprovalLegacyReader {
    enabled(): boolean;
    pendingIds(after: number): Promise<number[]>;
}
