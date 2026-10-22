import { AsyncLocalStorage } from "node:async_hooks";

import type { IdentityProfile } from "./identity.types.js";

const profiles = new AsyncLocalStorage<WeakMap<object, Map<string, Promise<IdentityProfile>>>>();

/** Establishes a fresh scope before guards and services; never use enterWith or a global cache. */
export const runIdentityRequestScope = <T>(next: () => T): T => profiles.run(new WeakMap(), next);

/** Nest middleware wraps the downstream guard/controller/service async chain in one scope. */
export const identityRequestContextMiddleware = (_request: unknown, _response: unknown, next: () => void): void => {
    runIdentityRequestScope(next);
};

/** Reuses successes and failures only within this request, service instance and exact opaque token. */
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
