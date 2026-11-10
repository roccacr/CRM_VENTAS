import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { type CatalogPermissionAction, isCatalogContextModuleCode } from "../catalogs/catalogs.constants.js";
import { type IdentityRequestAuditContext, IdentityService } from "../identity/identity.service.js";
import type { BankContextDto, BankStatusDto, CreateBankAdvisorDto, CreateBankDto, ListBanksQueryDto, UpdateBankAdvisorDto, UpdateBankDto } from "./banks.dto.js";
import { canUseBanks } from "./banks.permissions.js";
import { BanksRepository } from "./banks.repository.js";
/** El módulo del cuerpo elige el permiso. El banco es compartido. Lectura y la acción se exigen juntas, y el deny gana. */
@Injectable()
export class BanksService {
    /** Reutiliza la sesión vigente. La escritura queda en el repositorio, dentro de su transacción. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(BanksRepository) private readonly repository: BanksRepository,
    ) {}
    private async authorize(token: string | undefined, body: BankContextDto, action: CatalogPermissionAction) {
        if (!isCatalogContextModuleCode(body.moduleCode)) throw new BadRequestException("Módulo de catálogo no soportado.");
        const profile = await this.identity.getCurrentUser(token);
        if (!canUseBanks(profile, body.moduleCode, action)) throw new ForbiddenException("Permiso insuficiente.");
        return profile.user.publicId;
    }
    /** La página no se abre sin permiso de lectura en ese módulo. */
    async listBanks(token: string | undefined, query: ListBanksQueryDto) {
        await this.authorize(token, query, "read");
        return this.repository.listBanks(query);
    }
    /** Consultar un banco exige la misma lectura que el listado. */
    async getBank(token: string | undefined, id: string, query: BankContextDto) {
        await this.authorize(token, query, "read");
        return this.repository.getBank(id);
    }
    /** Los ejecutivos se leen con el permiso del banco, no con uno aparte. */
    async listAdvisors(token: string | undefined, id: string, query: ListBanksQueryDto) {
        await this.authorize(token, query, "read");
        return this.repository.listAdvisors(id, query);
    }
    /** El alta queda a nombre de la sesión. El cuerpo no trae el actor. */
    async createBank(token: string | undefined, body: CreateBankDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, "create");
        return this.repository.mutateBank(undefined, { kind: "create", name: body.name.trim() }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** La edición lleva la versión leída y el actor de la sesión. */
    async updateBank(token: string | undefined, id: string, body: UpdateBankDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, "update");
        return this.repository.mutateBank(id, { kind: "update", name: body.name.trim(), expectedVersion: body.expectedVersion }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** Activar exige actualizar. Inactivar exige inactivar. No es el mismo permiso. */
    async bankStatus(token: string | undefined, id: string, body: BankStatusDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, body.status === "inactive" ? "inactivate" : "update");
        return this.repository.mutateBank(id, { kind: "status", status: body.status, expectedVersion: body.expectedVersion }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** El contacto se recorta y el correo queda en minúsculas antes de persistir. */
    async createAdvisor(token: string | undefined, id: string, body: CreateBankAdvisorDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, "create");
        return this.repository.mutateAdvisor({ bankId: id }, { kind: "create", name: body.name.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim(), area: body.area.trim() }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** El banco de la ruta se conserva. El cuerpo no puede mover al ejecutivo. */
    async updateAdvisor(token: string | undefined, ids: { bankId: string; advisorId: string }, body: UpdateBankAdvisorDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, "update");
        return this.repository.mutateAdvisor(ids, { kind: "update", name: body.name.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim(), area: body.area.trim(), expectedVersion: body.expectedVersion }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** Activar o inactivar un ejecutivo usa el mismo corte de permiso que el banco. */
    async advisorStatus(token: string | undefined, ids: { bankId: string; advisorId: string }, body: BankStatusDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, body.status === "inactive" ? "inactivate" : "update");
        return this.repository.mutateAdvisor(ids, { kind: "status", status: body.status, expectedVersion: body.expectedVersion }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
}
