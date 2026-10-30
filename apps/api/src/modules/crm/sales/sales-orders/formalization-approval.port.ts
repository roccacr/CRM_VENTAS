import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { ContractTransitionLegacy } from "./contract-transition.port.js";

export const FORMALIZATION_APPROVAL_ERP = Symbol("FORMALIZATION_APPROVAL_ERP");
export const FORMALIZATION_APPROVAL_LEGACY = Symbol("FORMALIZATION_APPROVAL_LEGACY");
/** A transport success alone is never an approval confirmation. */
export interface FormalizationApprovalConfirmation {
    id: string;
    approved: true;
    alreadyApproved: boolean;
    environment: "sandbox" | "production";
}
export interface FormalizationApprovalErp {
    approveFormalization(id: string): Promise<FormalizationApprovalConfirmation>;
}
export interface LegacyApprovalOrder {
    id: string;
    netsuiteId: string;
    active: boolean;
    prerequisitesApproved: boolean;
    formalization: "approved" | "not_approved" | "unknown";
}
/** Every write uses the canonical transaction; there is no second writable pool. */
export interface FormalizationApprovalLegacy extends Pick<ContractTransitionLegacy, "owner" | "event" | "append"> {
    lockApproval(tx: Transaction<CrmDatabase>, id: string): Promise<LegacyApprovalOrder | undefined>;
    approveFormalization(tx: Transaction<CrmDatabase>, id: string): Promise<void>;
}
export interface FormalizationApprovalCommand {
    source: "native" | "legacy";
    id: string;
    expectedSequence: number;
    operationId: string;
    actorPublicId: string;
    ownOnly: boolean;
    correlationId: string;
}
