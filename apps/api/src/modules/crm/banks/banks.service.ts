import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { type CatalogPermissionAction, isCatalogContextModuleCode } from "../catalogs/catalogs.constants.js";
import { type IdentityRequestAuditContext, IdentityService } from "../identity/identity.service.js";
import type { BankContextDto, BankStatusDto, CreateBankAdvisorDto, CreateBankDto, ListBanksQueryDto, UpdateBankAdvisorDto, UpdateBankDto } from "./banks.dto.js";
import { canUseBanks } from "./banks.permissions.js";
import { BanksRepository } from "./banks.repository.js";
/** Autoriza por permisos efectivos del rol o de la persona, conservando módulo, lectura y acción. */
@Injectable()
export class BanksService {
    /** Reuses current identity and transactional persistence. */
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
    /** Authorizes bank read before accessing its page. */
    async listBanks(token: string | undefined, query: ListBanksQueryDto) {
        await this.authorize(token, query, "read");
        return this.repository.listBanks(query);
    }
    /** Authorizes bank read before accessing a public identity. */
    async getBank(token: string | undefined, id: string, query: BankContextDto) {
        await this.authorize(token, query, "read");
        return this.repository.getBank(id);
    }
    /** Authorizes bank read before accessing its contacts. */
    async listAdvisors(token: string | undefined, id: string, query: ListBanksQueryDto) {
        await this.authorize(token, query, "read");
        return this.repository.listAdvisors(id, query);
    }
    /** Binds the create action to the session actor. */
    async createBank(token: string | undefined, body: CreateBankDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, "create");
        return this.repository.mutateBank(undefined, { kind: "create", name: body.name.trim() }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** Binds the edit action and expected version to the session actor. */
    async updateBank(token: string | undefined, id: string, body: UpdateBankDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, "update");
        return this.repository.mutateBank(id, { kind: "update", name: body.name.trim(), expectedVersion: body.expectedVersion }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** Activation requires update; inactivation requires inactivate. */
    async bankStatus(token: string | undefined, id: string, body: BankStatusDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, body.status === "inactive" ? "inactivate" : "update");
        return this.repository.mutateBank(id, { kind: "status", status: body.status, expectedVersion: body.expectedVersion }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** Normalizes mandatory contact fields before persistence. */
    async createAdvisor(token: string | undefined, id: string, body: CreateBankAdvisorDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, "create");
        return this.repository.mutateAdvisor({ bankId: id }, { kind: "create", name: body.name.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim(), area: body.area.trim() }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** Preserves the parent identity while normalizing contact fields. */
    async updateAdvisor(token: string | undefined, ids: { bankId: string; advisorId: string }, body: UpdateBankAdvisorDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, "update");
        return this.repository.mutateAdvisor(ids, { kind: "update", name: body.name.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim(), area: body.area.trim(), expectedVersion: body.expectedVersion }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
    /** Applies bank permissions to advisor activation and inactivation. */
    async advisorStatus(token: string | undefined, ids: { bankId: string; advisorId: string }, body: BankStatusDto, context: IdentityRequestAuditContext = {}) {
        const actorPublicId = await this.authorize(token, body, body.status === "inactive" ? "inactivate" : "update");
        return this.repository.mutateAdvisor(ids, { kind: "status", status: body.status, expectedVersion: body.expectedVersion }, { ...context, actorPublicId, moduleCode: body.moduleCode, reason: body.reason.trim() });
    }
}
