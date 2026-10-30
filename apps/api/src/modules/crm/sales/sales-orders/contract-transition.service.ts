import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ulid } from "ulid";

import { hasFormalizationRole } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import type { IdentityProfile } from "../../identity/identity.types.js";
import { type ContractAction, type ContractTransitionDto, validateContractTransition } from "./contract-transition.dto.js";
import { ContractTransitionRepository } from "./contract-transition.repository.js";
import { formalizationPermissionScope } from "./follow-up.service.js";

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
        const permission = action === "set" ? "formalizacion.orders.stage.update" : `formalizacion.contracts.${action}`;
        if (!hasFormalizationRole(profile)) throw new ForbiddenException("Se requiere el rol activo Formalizacion");
        const scope = formalizationPermissionScope(profile, permission);
        if (!scope.allowed) throw new ForbiddenException("No tiene permiso para esta transicion");
        const dto = validateContractTransition(input, action);
        this.assertTargetDenials(profile, action, dto);
        const targetScope = this.targetScope(profile, action, dto, scope);
        const skipScope = formalizationPermissionScope(profile, "formalizacion.orders.stage.skip");
        return this.repository.transition({ source: dto.source, id: dto.id, expectedSequence: dto.expectedSequence, operationId: dto.operationId, targetState: dto.targetState, action, actorPublicId: profile.user.publicId, ownOnly: this.combinedOwnOnly(targetScope, skipScope), canSkipStages: skipScope.allowed, reason: (dto.reason ?? "").trim(), correlationId: ulid(), ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}), ...(context.userAgent ? { userAgent: context.userAgent } : {}) });
    }

    private combinedOwnOnly(target: { ownOnly: boolean }, skip: { allowed: boolean; ownOnly: boolean }): boolean {
        return target.ownOnly || (skip.allowed && skip.ownOnly);
    }

    /** Destination authorization is independent of the selector grant. */
    private targetScope(profile: IdentityProfile, action: ContractAction, dto: ContractTransitionDto, original: { ownOnly: boolean }) {
        if (action !== "set") return original;
        const scope = formalizationPermissionScope(profile, `formalizacion.orders.stage.${dto.targetState ?? ""}`);
        if (!scope.allowed) throw new ForbiddenException("No tiene permiso para pasar a esta etapa");
        return { ownOnly: original.ownOnly || scope.ownOnly };
    }

    /** The broader selector grant never overrides an explicit denial of the matching contract action. */
    private assertTargetDenials(profile: IdentityProfile, action: ContractAction, dto: ContractTransitionDto): void {
        if (action !== "set") return;
        const corresponding: Partial<Record<string, string>> = { contract_pending_signature: "formalizacion.contracts.send", contract_pending_send: "formalizacion.contracts.revert" };
        const code = corresponding[dto.targetState ?? ""];
        if (profile.permissions.some((entry) => entry.code === code && entry.effect === "deny")) throw new ForbiddenException("No tiene permiso para seleccionar esta etapa");
    }
}
