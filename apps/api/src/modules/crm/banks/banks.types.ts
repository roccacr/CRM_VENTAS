import type { CatalogStatus } from "../catalogs/catalogs.constants.js";
import type { IdentityRequestAuditContext } from "../identity/identity.service.js";
export interface Bank {
    publicId: string;
    name: string;
    status: CatalogStatus;
    version: number;
    createdAt: string;
    updatedAt: string;
    advisorCount: number;
}
export interface BankAdvisor {
    publicId: string;
    bankPublicId: string;
    name: string;
    email: string;
    phone: string;
    area: string;
    status: CatalogStatus;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export interface BankAuditContext extends IdentityRequestAuditContext {
    actorPublicId: string;
    moduleCode: string;
    reason: string;
}
export type BankChange = { kind: "create"; name: string } | { kind: "update"; name: string; expectedVersion: number } | { kind: "status"; status: CatalogStatus; expectedVersion: number };
export type AdvisorContact = Pick<BankAdvisor, "name" | "email" | "phone" | "area">;
export type AdvisorChange = ({ kind: "create" } & AdvisorContact) | ({ kind: "update"; expectedVersion: number } & AdvisorContact) | { kind: "status"; status: CatalogStatus; expectedVersion: number };
