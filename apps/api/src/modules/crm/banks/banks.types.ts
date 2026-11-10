import type { CatalogStatus } from "../catalogs/catalogs.constants.js";
import type { IdentityRequestAuditContext } from "../identity/identity.service.js";
/** Lo que sale del catálogo: id público y versión. La llave numérica no viaja. */
export interface Bank {
    publicId: string;
    name: string;
    status: CatalogStatus;
    version: number;
    createdAt: string;
    updatedAt: string;
    advisorCount: number;
}
/** El padre del ejecutivo es el ULID del banco. El id interno no se expone. */
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
/** Motivo, módulo y actor los fija el servidor desde la sesión. El cliente no elige quién queda en la bitácora. */
export interface BankAuditContext extends IdentityRequestAuditContext {
    actorPublicId: string;
    moduleCode: string;
    reason: string;
}
/** Alta, edición o estado. Editar o cambiar el estado sin la versión leída no cabe en este tipo. */
export type BankChange = { kind: "create"; name: string } | { kind: "update"; name: string; expectedVersion: number } | { kind: "status"; status: CatalogStatus; expectedVersion: number };
/** El contacto no incluye el banco. Por aquí no se traslada al ejecutivo. */
export type AdvisorContact = Pick<BankAdvisor, "name" | "email" | "phone" | "area">;
/** Alta y edición llevan el contacto completo. El estado solo cambia estado y versión. */
export type AdvisorChange = ({ kind: "create" } & AdvisorContact) | ({ kind: "update"; expectedVersion: number } & AdvisorContact) | { kind: "status"; status: CatalogStatus; expectedVersion: number };
