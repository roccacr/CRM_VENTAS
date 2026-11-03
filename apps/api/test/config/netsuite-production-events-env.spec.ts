import { expect, it } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
const minimal = { AUDIT_HASH_SECRET: "a".repeat(64), AUTH_TOKEN_HASH_SECRET: "b".repeat(64), COOKIE_SECRET: "c".repeat(64), DB_HOST: "127.0.0.1", DB_NAME: "CRM_THINK_V2", DB_USER: "test", FRONTEND_ORIGIN: "http://localhost:5173" };
it("defaults production event reception and persistence off", () => {
    expect(validateEnv(minimal)).toMatchObject({ NETSUITE_PRODUCTION_EVENTS_ENABLED: false, NETSUITE_PRODUCTION_EVENTS_PERSIST: false });
});
it.each([{ NODE_ENV: "development" }, { FRONTEND_ORIGIN: "http://localhost:5173" }, { NETSUITE_ENVIRONMENT: "sandbox" }, { NETSUITE_PRODUCTION_EVENTS_SECRET: undefined }, { NETSUITE_PRODUCTION_EVENTS_SECRET: "invalid" }, { NETSUITE_PRODUCTION_EVENTS_SECRET: minimal.COOKIE_SECRET }, { NETSUITE_PRODUCTION_EVENTS_SECRET: minimal.AUTH_TOKEN_HASH_SECRET }, { NETSUITE_PRODUCTION_EVENTS_SECRET: minimal.AUDIT_HASH_SECRET }, { NETSUITE_LOCAL_EVENTS_SECRET: "d".repeat(64) }])(
    "rejects production event misconfiguration %j",
    (override) => {
        expect(() => validateEnv({ ...minimal, NODE_ENV: "production", FRONTEND_ORIGIN: "https://habita.roccacr.com", NETSUITE_ENVIRONMENT: "production", NETSUITE_PRODUCTION_EVENTS_ENABLED: "true", NETSUITE_PRODUCTION_EVENTS_SECRET: "d".repeat(64), ...override })).toThrow();
    },
);
it("requires reception before enabling production persistence", () => {
    expect(() => validateEnv({ ...minimal, NETSUITE_PRODUCTION_EVENTS_PERSIST: "true" })).toThrow("NETSUITE_PRODUCTION_EVENTS_PERSIST");
});
