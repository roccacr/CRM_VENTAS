import CheckOutlined from "@ant-design/icons/CheckOutlined";
import LockOutlined from "@ant-design/icons/LockOutlined";
import { useState } from "react";

import { buildApiUrl } from "../../config/frontend-env";
import type { AccessProblemKind, SessionStatusPhase } from "../../routes/auth-state";
import type { IdentityUser } from "../../services/auth/identity-contracts";

/**
 * Pantallas completas que reemplazan al shell mientras la sesión no permite
 * entrar: verificación, acceso denegado, ruta inexistente y fallo de conexión.
 *
 * Ninguna muestra datos del CRM ni detalle técnico del BFF.
 */

const ROCCA_LOGO_SRC = "/Logo/logo2.jpg";

/** Textos de cada fallo de acceso. No incluyen estado HTTP, stack ni detalle del BFF. */
const ACCESS_PROBLEM_COPY: Record<AccessProblemKind, { readonly description: string; readonly title: string }> = {
    expired: {
        description: "Por seguridad, tu sesión terminó. Inicia sesión nuevamente para continuar.",
        title: "Sesión expirada",
    },
    offline: {
        description: "No pudimos contactar el servicio de identidad. Revisa tu red y vuelve a intentar.",
        title: "Sin conexión",
    },
    server: {
        description: "El sistema no pudo validar tu acceso por un error temporal. Intenta de nuevo en unos minutos.",
        title: "Error inesperado",
    },
    unexpected: {
        description: "No pudimos confirmar tu sesión. Intenta iniciar sesión nuevamente o reintenta la conexión.",
        title: "Acceso requerido",
    },
};

const getDisplayName = (user: IdentityUser): string => user.displayName.trim() || user.email.trim() || "Usuario actual";

/** Iniciales de respaldo; si el nombre es un correo se ignora el dominio. */
const getInitials = (user: IdentityUser): string => {
    const words = getDisplayName(user)
        .replace(/@.*/u, "")
        .split(/\s+/u)
        .map((word) => word.trim())
        .filter(Boolean);

    if (words.length === 0) {
        return "U";
    }

    return words
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");
};

/** El API puede devolver la foto como ruta relativa al BFF o como URL absoluta. */
const buildPhotoUrl = (profileImageUrl: string): string => new URL(profileImageUrl.startsWith("http") ? profileImageUrl : buildApiUrl(profileImageUrl)).toString();

/** Foto del usuario; si no carga, cae a iniciales sin romper la pantalla. */
function SessionStatusAvatarContent({ user }: { readonly user: IdentityUser }) {
    const [isImageUnavailable, setIsImageUnavailable] = useState(false);
    const imageSrc = user.profileImageUrl && !isImageUnavailable ? buildPhotoUrl(user.profileImageUrl) : null;

    return imageSrc ? (
        <img
            className="app-auth-loader__avatar-image"
            src={imageSrc}
            alt={`Foto de ${getDisplayName(user)}`}
            onError={() => {
                setIsImageUnavailable(true);
            }}
        />
    ) : (
        <span className="app-auth-loader__avatar-initials">{getInitials(user)}</span>
    );
}

/** Spinner que rodea el avatar. Sin usuario es decorativo y se oculta a lectores de pantalla. */
function SessionStatusAvatar({ phase, user }: { readonly phase: SessionStatusPhase; readonly user: IdentityUser | null }) {
    const isValidated = phase === "validated";
    const className = `app-auth-loader__spinner-shell${user ? " app-auth-loader__spinner-shell--user" : ""}${isValidated ? " app-auth-loader__spinner-shell--validated" : ""}`;

    return (
        <span className={className} aria-hidden={user ? undefined : true}>
            <span className="app-auth-loader__spinner" />
            {user ? <SessionStatusAvatarContent user={user} /> : null}
            {isValidated ? (
                <span className="app-auth-loader__validated-badge" aria-hidden="true">
                    <CheckOutlined />
                </span>
            ) : null}
        </span>
    );
}

/**
 * Pantalla de verificación de sesión.
 *
 * Se anuncia con `role="status"` para que el lector de pantalla informe el
 * cambio de "verificando" a "validada" sin mover el foco.
 */
export function SessionStatusScreen({ phase, user }: { readonly phase: SessionStatusPhase; readonly user: IdentityUser | null }) {
    const isValidated = phase === "validated";

    return (
        <main className="app-auth-state app-auth-state--loading">
            <section className="app-auth-loader" role="status" aria-live="polite" aria-labelledby="app-auth-loader-title">
                <img className="app-auth-state__logo" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="ROCCA Development Group" />
                {/* La key reinicia el avatar al cambiar de fase o de foto, para reintentar la imagen. */}
                <SessionStatusAvatar key={`${phase}-${user?.profileImageUrl ?? "profile-fallback"}`} phase={phase} user={user} />
                <div className="app-auth-loader__copy">
                    <h1 id="app-auth-loader-title">{isValidated ? "Sesión validada" : "Verificando sesión"}</h1>
                    {user ? <p className="app-auth-loader__user-name">{getDisplayName(user)}</p> : null}
                    <p>{isValidated ? "Entrando a tu espacio de trabajo…" : "Preparando tu entorno de trabajo…"}</p>
                </div>
            </section>
        </main>
    );
}

interface AuthStateCardProps {
    readonly description: string;
    readonly isSecondaryActionDisabled?: boolean;
    readonly onPrimaryAction: () => void;
    readonly onSecondaryAction?: () => void;
    readonly primaryActionLabel: string;
    readonly secondaryActionLabel?: string;
    readonly supportMessage?: string | null | undefined;
    readonly title: string;
}

/** Tarjeta común de las pantallas de acceso: una acción principal y, opcionalmente, un reintento. */
function AuthStateCard({ description, isSecondaryActionDisabled = false, onPrimaryAction, onSecondaryAction, primaryActionLabel, secondaryActionLabel, supportMessage, title }: AuthStateCardProps) {
    return (
        <main className="app-auth-state">
            <section className="app-auth-card" aria-labelledby="app-auth-card-title">
                <img className="app-auth-state__logo" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="ROCCA Development Group" />
                <span className="app-auth-card__icon" aria-hidden="true">
                    <LockOutlined />
                </span>
                <div className="app-auth-card__copy">
                    <h1 id="app-auth-card-title">{title}</h1>
                    <p>{description}</p>
                </div>
                <button className="app-auth-card__primary" type="button" onClick={onPrimaryAction}>
                    {primaryActionLabel}
                </button>
                {onSecondaryAction && secondaryActionLabel ? (
                    <button className="app-auth-card__secondary" type="button" disabled={isSecondaryActionDisabled} onClick={onSecondaryAction}>
                        {secondaryActionLabel}
                    </button>
                ) : null}
                {supportMessage ? (
                    <p className="app-auth-card__feedback" role="status">
                        {supportMessage}
                    </p>
                ) : null}
            </section>
        </main>
    );
}

/** Sesión válida sin permiso para la vista. La única salida es cambiar de cuenta. */
export function ForbiddenScreen({ onLogout }: { readonly onLogout: () => void }) {
    return <AuthStateCard description="Tu usuario está autenticado, pero no tiene permiso para abrir esta vista." onPrimaryAction={onLogout} primaryActionLabel="Volver a iniciar sesión" title="Acceso no autorizado" />;
}

/** Ruta fuera del mapa. No muestra datos de sesión para no confirmar qué rutas existen. */
export function NotFoundScreen({ onNavigateHome }: { readonly onNavigateHome: () => void }) {
    return <AuthStateCard description="La dirección solicitada no existe o fue movida dentro del CRM." onPrimaryAction={onNavigateHome} primaryActionLabel="Volver al inicio" title="Ruta no encontrada" />;
}

interface AccessProblemScreenProps {
    readonly isRetryDisabled: boolean;
    readonly onLogin: () => void;
    readonly onRetry: () => void;
    readonly problem: AccessProblemKind;
    readonly retryMessage?: string | null;
}

/** Fallo al validar la sesión. Ofrece login o reintento; nunca abre el shell. */
export function AccessProblemScreen({ isRetryDisabled, onLogin, onRetry, problem, retryMessage }: AccessProblemScreenProps) {
    const copy = ACCESS_PROBLEM_COPY[problem];

    return <AuthStateCard description={copy.description} isSecondaryActionDisabled={isRetryDisabled} onPrimaryAction={onLogin} onSecondaryAction={onRetry} primaryActionLabel="Iniciar sesión" secondaryActionLabel="Reintentar conexión" supportMessage={retryMessage} title={copy.title} />;
}
