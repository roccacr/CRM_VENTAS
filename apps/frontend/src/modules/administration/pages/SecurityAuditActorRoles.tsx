import type { AuditEvent } from "./security-audit.api";

/** Un rol desconocido no es lo mismo que un conjunto vacío ya registrado. No se sustituye por las membresías actuales. */
export function AuditActorRoles({ roles }: { readonly roles: AuditEvent["actorRoles"] }) {
    if (roles === null) return <small>Roles históricos no registrados</small>;
    if (roles.length === 0) return <small>Sin roles al momento del evento</small>;
    return (
        <>
            {roles.map((role) => (
                <small key={role.code}>
                    <span>{role.name}</span> <span>({role.code})</span>
                </small>
            ))}
        </>
    );
}
