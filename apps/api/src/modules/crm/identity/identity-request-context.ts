import { AsyncLocalStorage } from "node:async_hooks";

import type { IdentityProfile } from "./identity.types.js";

const profiles = new AsyncLocalStorage<WeakMap<object, Map<string, Promise<IdentityProfile>>>>();

/** Abre un alcance nuevo antes de los guards. No usa una caché global: el perfil de una petición no se filtra a otra. */
export const runIdentityRequestScope = <T>(next: () => T): T => profiles.run(new WeakMap(), next);

/** El middleware mete guard, controlador y servicio en el mismo alcance de la petición. */
export const identityRequestContextMiddleware = (_request: unknown, _response: unknown, next: () => void): void => {
    runIdentityRequestScope(next);
};

/** Reutiliza aciertos y fallos solo en esta petición, esta instancia y este token. Otro token vuelve a leer. */
export const reuseRequestProfile = (owner: object, token: string, load: () => Promise<IdentityProfile>): Promise<IdentityProfile> => {
    const scope = profiles.getStore();
    if (!scope) return load();
    let tokens = scope.get(owner);
    if (!tokens) {
        tokens = new Map();
        scope.set(owner, tokens);
    }
    let profile = tokens.get(token);
    if (!profile) {
        profile = load();
        tokens.set(token, profile);
    }
    return profile;
};
