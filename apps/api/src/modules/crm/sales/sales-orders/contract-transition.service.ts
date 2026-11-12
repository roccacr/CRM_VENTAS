import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ulid } from "ulid";

import { canReadFormalizationOrder } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import type { IdentityProfile } from "../../identity/identity.types.js";
import { type ContractAction, type ContractTransitionDto, validateContractTransition } from "./contract-transition.dto.js";
import { ContractTransitionRepository } from "./contract-transition.repository.js";
import { validateFiniquitoInput } from "./finiquito.policy.js";
import { parseFiniquitoOverviewInput } from "./finiquito-overview.query.js";
import { formalizationPermissionScope } from "./follow-up.service.js";
import { validatePurchaseFunds } from "./purchase-funds.dto.js";

/** HTTP y los llamadores internos presentan una sesión viva. El actor no viene de quien llama. */
@Injectable()
export class ContractTransitionService {
    /** Misma lectura efectiva que una orden; la capacidad de escritura se valida de nuevo al guardar. */
    async finiquitoOverview(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("No tiene permiso para consultar órdenes.");
        const data = await this.repository.finiquitoOverview(parseFiniquitoOverviewInput(input));
        return { ...data, canUpdate: formalizationPermissionScope(profile, "formalizacion.orders.stage.update").allowed };
    }
    /** Lectura y mutación usan el permiso vivo de la orden. La rama la autorizan solo las banderas confirmadas del ERP. */
    async finiquito(session: string | undefined, input: unknown, write = false, context: { ipAddress?: string; userAgent?: string } = {}) {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("No tiene permiso para consultar esta orden.");
        const scope = formalizationPermissionScope(profile, "formalizacion.orders.stage.update");
        if (write && !scope.allowed) throw new ForbiddenException("No tiene permiso para gestionar el finiquito.");
        const { target, change } = validateFiniquitoInput(input, write);
        const data = await this.repository.finiquito({ ...target, action: "set", operationId: change?.operationId ?? ulid(), expectedSequence: 0, actorPublicId: profile.user.publicId, ownOnly: false, reason: "", correlationId: ulid(), ...context }, change);
        return { ...data, canUpdate: scope.allowed };
    }

    /** El formulario versionado exige el mismo permiso vivo que su mutación. */
    async purchaseFundsSnapshot(session: string | undefined, source: string, id: string) {
        const profile = await this.identity.getCurrentUser(session);
        const scope = formalizationPermissionScope(profile, "formalizacion.orders.stage.update");
        if (!scope.allowed) throw new ForbiddenException("No tiene permiso para editar los fondos de compra");
        const identity = validateContractTransition({ source, id, expectedSequence: 0, operationId: ulid() }, "send");
        return this.repository.purchaseFundsSnapshot({ source: identity.source, id: identity.id, expectedSequence: identity.expectedSequence, operationId: identity.operationId, action: "send", actorPublicId: profile.user.publicId, ownOnly: scope.ownOnly, reason: "", correlationId: ulid() });
    }
    /** La clasificación independiente usa el permiso vivo de edición y conserva el diario de etapas. */
    async updatePurchaseFunds(session: string | undefined, input: unknown, context: { ipAddress?: string; userAgent?: string } = {}) {
        const profile = await this.identity.getCurrentUser(session);
        const scope = formalizationPermissionScope(profile, "formalizacion.orders.stage.update");
        if (!scope.allowed) throw new ForbiddenException("No tiene permiso para editar los fondos de compra");
        return this.repository.updatePurchaseFunds({ ...validatePurchaseFunds(input), action: "set", actorPublicId: profile.user.publicId, ownOnly: scope.ownOnly, reason: "", correlationId: ulid(), ...context });
    }
    /** Reutiliza la identidad viva y el colaborador de persistencia transaccional. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(ContractTransitionRepository) private readonly repository: ContractTransitionRepository,
    ) {}

    /** Autoriza antes de tocar cualquiera de las dos fuentes de negocio. Un deny explícito gana. */
    async transition(session: string | undefined, action: ContractAction, input: ContractTransitionDto, context: { ipAddress?: string; userAgent?: string } = {}) {
        const profile = await this.identity.getCurrentUser(session);
        const permission = action === "set" ? "formalizacion.orders.stage.update" : `formalizacion.contracts.${action}`;
        const scope = formalizationPermissionScope(profile, permission);
        if (!scope.allowed) throw new ForbiddenException("No tiene permiso para esta transicion");
        const dto = validateContractTransition(input, action);
        this.assertTargetDenials(profile, action, dto);
        const targetScope = this.targetScope(profile, action, dto, scope);
        const skipScope = formalizationPermissionScope(profile, "formalizacion.orders.stage.skip");
        return this.repository.transition({
            source: dto.source,
            id: dto.id,
            expectedSequence: dto.expectedSequence,
            operationId: dto.operationId,
            targetState: dto.targetState,
            purchaseFundsOrigin: dto.purchaseFundsOrigin,
            action,
            actorPublicId: profile.user.publicId,
            ownOnly: this.combinedOwnOnly(targetScope, skipScope),
            canSkipStages: skipScope.allowed,
            reason: (dto.reason ?? "").trim(),
            correlationId: ulid(),
            ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
            ...(context.userAgent ? { userAgent: context.userAgent } : {}),
        });
    }

    private combinedOwnOnly(target: { ownOnly: boolean }, skip: { allowed: boolean; ownOnly: boolean }): boolean {
        return target.ownOnly || (skip.allowed && skip.ownOnly);
    }

    /** Autorizar el destino es independiente del permiso del selector. */
    private targetScope(profile: IdentityProfile, action: ContractAction, dto: ContractTransitionDto, original: { ownOnly: boolean }) {
        if (action !== "set") return original;
        const scope = formalizationPermissionScope(profile, `formalizacion.orders.stage.${dto.targetState ?? ""}`);
        if (!scope.allowed) throw new ForbiddenException("No tiene permiso para pasar a esta etapa");
        return { ownOnly: original.ownOnly || scope.ownOnly };
    }

    /** El permiso amplio del selector no anula un deny explícito de la acción de contrato que corresponde. */
    private assertTargetDenials(profile: IdentityProfile, action: ContractAction, dto: ContractTransitionDto): void {
        if (action !== "set") return;
        const corresponding: Partial<Record<string, string>> = { contract_pending_signature: "formalizacion.contracts.send", contract_pending_send: "formalizacion.contracts.revert" };
        const code = corresponding[dto.targetState ?? ""];
        if (profile.permissions.some((entry) => entry.code === code && entry.effect === "deny")) throw new ForbiddenException("No tiene permiso para seleccionar esta etapa");
    }
}
