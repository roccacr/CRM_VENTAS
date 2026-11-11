import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { IdentityService } from "./identity.service.js";
import { IdentityProfileRepository } from "./identity-profile.repository.js";

/** Presencia efímera para el único proceso de Habita; nunca guarda tokens ni historial de navegación. */
@Injectable()
export class IdentityPresenceService {
    private readonly sessions = new Map<string, number>();
    /** Reutiliza autenticación y valida en BD las sesiones antes de exponer nombres. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(IdentityProfileRepository) private readonly profiles: IdentityProfileRepository,
    ) {}

    private prune(): void {
        const cutoff = Date.now() - 90000;
        for (const [id, seen] of this.sessions) if (seen <= cutoff) this.sessions.delete(id);
    }

    /** El cuerpo del cliente no decide qué usuario está conectado: solo cuenta la cookie autenticada. */
    async heartbeat(token: string | undefined): Promise<{ ok: true }> {
        const profile = await this.identity.getCurrentUser(token);
        this.prune();
        if (!this.sessions.has(profile.session.publicId) && this.sessions.size >= 5000) throw new ServiceUnavailableException("Presencia temporalmente no disponible.");
        this.sessions.set(profile.session.publicId, Date.now());
        return { ok: true };
    }

    /** Owner activo exclusivamente. Los permisos de administración de otros roles no amplían este acceso. */
    async list(token: string | undefined) {
        const profile = await this.identity.getCurrentUser(token);
        if (!profile.roles.some((role) => role.code === "owner" && role.status === "active")) throw new ForbiddenException("Solo Owner puede consultar las personas en línea.");
        this.prune();
        const rows = this.sessions.size ? await this.profiles.findPresentUsers([...this.sessions.keys()]) : [];
        const users = [...new Map(rows.map((user) => [user.publicId, user])).values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
        return { users, observedAt: new Date().toISOString() };
    }
}
