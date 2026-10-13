import type { AuditEvent } from "./security-audit.api";

/** Unknown roles differ from a recorded empty role set; current memberships are never substituted. */
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
