import { describe, expect, it } from "vitest";

import { getCanonicalLocalDevelopmentUrl } from "../../src/config/frontend-env";

describe("frontend-env", () => {
    it("redirige alias local 127.0.0.1 al host canonico localhost en desarrollo", () => {
        expect(getCanonicalLocalDevelopmentUrl("http://127.0.0.1:5173/auth/login?microsoftStatus=failed#top", true)).toBe("http://localhost:5173/auth/login?microsoftStatus=failed#top");
    });

    it("no cambia la URL canonica ni entornos que no son desarrollo", () => {
        expect(getCanonicalLocalDevelopmentUrl("http://localhost:5173/auth/login", true)).toBeNull();
        expect(getCanonicalLocalDevelopmentUrl("http://127.0.0.1:5173/auth/login", false)).toBeNull();
    });
});
