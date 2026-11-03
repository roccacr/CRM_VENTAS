import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { IdentityService } from "../identity/identity.service.js";
import { LEAD_PROFILE_PERMISSION, validateLeadProfileQuery } from "./lead-profile.contract.js";
import { LeadProfileRepository } from "./lead-profile.repository.js";

/** Resuelve el perfil mediante lecturas autorizadas, sin importar datos entre bases. */
@Injectable()
export class LeadProfileService {
    /** Inyección explícita compatible con el runtime tsx y las pruebas. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(LeadProfileRepository) private readonly repository: LeadProfileRepository,
    ) {}

    /** Es global por decisión de negocio; no depende del vendedor, banners ni rol del solicitante. */
    async read(session: string | undefined, query: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const grants = profile.permissions.filter((permission) => permission.code === LEAD_PROFILE_PERMISSION);
        if (!grants.some((permission) => permission.effect === "allow") || grants.some((permission) => permission.effect === "deny")) throw new ForbiddenException("Acceso denegado al perfil completo del lead.");
        return this.repository.read(validateLeadProfileQuery(query));
    }
}
