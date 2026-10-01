import { describe, expect, it } from "vitest";

import { getCanonicalLocalDevelopmentUrl, getDevelopmentNetworkApiOrigin } from "../../src/config/frontend-env";

describe("frontend-env", () => {
    it("redirige alias local 127.0.0.1 al host canonico localhost en desarrollo", () => {
        expect(getCanonicalLocalDevelopmentUrl("http://127.0.0.1:5173/auth/login?microsoftStatus=failed#top", true)).toBe("http://localhost:5173/auth/login?microsoftStatus=failed#top");
    });

    it("no cambia la URL canonica ni entornos que no son desarrollo", () => {
        expect(getCanonicalLocalDevelopmentUrl("http://localhost:5173/auth/login", true)).toBeNull();
        expect(getCanonicalLocalDevelopmentUrl("http://127.0.0.1:5173/auth/login", false)).toBeNull();
    });

    it("usa el host de red local para el API cuando Vite se abre por IP en desarrollo", () => {
        expect(getDevelopmentNetworkApiOrigin("http://localhost:3000", "http://192.168.100.8:5173/home/administration/users", true)).toBe("http://192.168.100.8:3000");
    });

    it("mantiene localhost para el API cuando la app se abre desde localhost", () => {
        expect(getDevelopmentNetworkApiOrigin("http://localhost:3000", "http://localhost:5173/auth/login", true)).toBeNull();
    });
});
