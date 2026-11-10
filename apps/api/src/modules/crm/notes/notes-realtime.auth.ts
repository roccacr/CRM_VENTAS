import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Socket } from "socket.io";

import { isValidSignedCsrfToken } from "../../../common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { IdentityService } from "../identity/identity.service.js";
import { notesRealtimeAuthSchema } from "./notes-realtime.contract.js";
export interface NotesRealtimeIdentity {
    userId: string;
    sessionToken: string;
    expiresAt: number;
}
/** Frontera BFF propia del socket. Los guards HTTP no autentican mensajes de Engine.IO. */
@Injectable()
export class NotesRealtimeAuth {
    /** Dependencias nativas de la aplicación. */
    constructor(
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(IdentityService) private readonly identity: IdentityService,
    ) {}
    /** La misma lista permitida del frontend que HTTP. Un Origin ausente se rechaza. */
    allowedOrigin(origin: unknown): boolean {
        return typeof origin === "string" && [this.config.getOrThrow<string>("FRONTEND_ORIGIN"), ...(this.config.get<string>("FRONTEND_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim())].includes(origin);
    }
    /** Reutiliza la prueba firmada de doble envío y la sesión opaca. Una cookie de credencial duplicada se cierra. */
    async authenticate(socket: Socket): Promise<NotesRealtimeIdentity> {
        if (!this.allowedOrigin(socket.handshake.headers.origin)) throw new UnauthorizedException();
        const auth = notesRealtimeAuthSchema.safeParse(socket.handshake.auth);
        if (!auth.success) throw new UnauthorizedException();
        const cookies = this.cookies(socket.handshake.headers.cookie);
        const sessionToken = cookies.get(SESSION_COOKIE_NAME);
        const csrf = cookies.get(CSRF_COOKIE_NAME);
        if (!sessionToken || !csrf || csrf !== auth.data.csrfToken || !isValidSignedCsrfToken(csrf, this.config.getOrThrow<string>("COOKIE_SECRET"), sessionToken)) throw new UnauthorizedException();
        return this.current(sessionToken);
    }
    private cookies(header: string | undefined): Map<string, string> {
        if (!header || header.length > 8192) throw new UnauthorizedException();
        const cookies = new Map<string, string>();
        for (const part of header.split(";")) {
            const split = part.indexOf("=");
            if (split < 1) continue;
            const key = part.slice(0, split).trim();
            if (cookies.has(key)) throw new UnauthorizedException();
            try {
                cookies.set(key, decodeURIComponent(part.slice(split + 1).trim()));
            } catch {
                throw new UnauthorizedException();
            }
        }
        return cookies;
    }
    /** Una lectura fresca del perfil exige cierre de sesión, vencimiento, estado de la cuenta y la versión de permisos. */
    async current(sessionToken: string): Promise<NotesRealtimeIdentity> {
        const profile = await this.identity.getCurrentUser(sessionToken);
        const expiresAt = Date.parse(profile.session.expiresAt);
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new UnauthorizedException();
        return { userId: profile.user.publicId, sessionToken, expiresAt };
    }
}
