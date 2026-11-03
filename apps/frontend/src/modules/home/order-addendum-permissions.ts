export interface AddendumPermission {
    readonly code: string;
    readonly effect: string;
}
function allowed(permissions: readonly AddendumPermission[], code: string): boolean {
    const matches = permissions.filter((permission) => permission.code === code);
    return matches.some((permission) => permission.effect === "allow") && !matches.some((permission) => permission.effect === "deny");
}
/** El permiso de adéndum oculta solo sus datos; no concede ni retira lectura de la orden. */
export function canReadOrderAddendum(permissions: readonly AddendumPermission[] = []): boolean {
    return allowed(permissions, "formalizacion.orders.read") && allowed(permissions, "formalizacion.orders.addendum.read");
}
/** Completar o cancelar conserva su permiso específico, independiente de la marcación manual. */
export function canUpdateOrderAddendum(permissions: readonly AddendumPermission[]): boolean {
    return canReadOrderAddendum(permissions) && allowed(permissions, "formalizacion.orders.addendum.update");
}
/** Se usan grants efectivos: no se infiere autorización por el nombre Owner ni por el rol mostrado. */
export function canMarkOrderAddendum(permissions: readonly AddendumPermission[]): boolean {
    return canReadOrderAddendum(permissions) && allowed(permissions, "formalizacion.orders.addendum.mark_pending");
}

/** Registrar enviado requiere lectura efectiva de la orden y su marcador. */
export function canMarkOrderAddendumSent(permissions: readonly AddendumPermission[]): boolean {
    return canReadOrderAddendum(permissions);
}
