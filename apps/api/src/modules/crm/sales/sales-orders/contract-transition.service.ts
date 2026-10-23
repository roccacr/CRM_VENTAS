import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ulid } from "ulid";

import { hasFormalizationRole } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import { type ContractAction, type ContractTransitionDto, validateContractTransition } from "./contract-transition.dto.js";
import { ContractTransitionRepository } from "./contract-transition.repository.js";

/** Both HTTP and internal callers must present a live session; no caller-supplied actors. */
@Injectable()
export class ContractTransitionService {
    /** Reuses the live identity service and transactional persistence collaborator. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(ContractTransitionRepository) private readonly repository: ContractTransitionRepository,
    ) {}

    /** Authorizes before accessing either business source. Explicit denies always win. */
    async transition(session: string | undefined, action: ContractAction, input: ContractTransitionDto, context: { ipAddress?: string; userAgent?: string } = {}) {
        const profile = await this.identity.getCurrentUser(session);
        const permission = `formalizacion.contracts.${action}`;
        if (!hasFormalizationRole(profile)) throw new ForbiddenException("Se requiere el rol activo Formalizacion");
        const permissions = profile.permissions.filter((entry) => entry.code === permission);
        if (!permissions.some((entry) => entry.effect === "allow") || permissions.some((entry) => entry.effect === "deny")) throw new ForbiddenException("No tiene permiso para esta transicion");
        const dto = validateContractTransition(input, action);
        return this.repository.transition({ source: dto.source, id: dto.id, expectedSequence: dto.expectedSequence, operationId: dto.operationId, action, actorPublicId: profile.user.publicId, reason: dto.reason ?? "", correlationId: ulid(), ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}), ...(context.userAgent ? { userAgent: context.userAgent } : {}) });
    }
}
