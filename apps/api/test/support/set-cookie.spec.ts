import { describe, expect, it } from "vitest";

import { findSetCookieHeader, hasCookieAttribute, readCookieAttribute, readCookieValue, readSetCookieHeaders } from "./set-cookie.js";

describe("set-cookie test support", () => {
    it("lee el Path exacto sin confundir la ruta raiz con rutas hijas", () => {
        const rootCookie = "crm_session=; Path=/; Secure; SameSite=Strict";
        const refreshCookie = "crm_refresh=; Path=/identity/refresh; Secure; HttpOnly; SameSite=Strict";

        expect(readCookieAttribute(rootCookie, "Path")).toBe("/");
        expect(readCookieAttribute(refreshCookie, "Path")).toBe("/identity/refresh");
        expect(readCookieAttribute(refreshCookie, "Path")).not.toBe("/");
    });

    it("distingue atributos con valor de atributos tipo flag", () => {
        const cookie = "crm_csrf=token-seguro; Path=/; Secure; SameSite=Strict";

        expect(readCookieValue(cookie)).toBe("token-seguro");
        expect(readCookieAttribute(cookie, "SameSite")).toBe("Strict");
        expect(hasCookieAttribute(cookie, "Secure")).toBe(true);
        expect(hasCookieAttribute(cookie, "HttpOnly")).toBe(false);
    });

    it("conserva valores de cookie que contienen signos igual", () => {
        const cookie = "crm_refresh=valor.con.relleno==; Path=/identity/refresh; Secure; HttpOnly";

        expect(readCookieValue(cookie)).toBe("valor.con.relleno==");
    });

    it("normaliza set-cookie cuando viene como texto, arreglo o ausente", () => {
        const sessionCookie = "crm_session=abc; Path=/";
        const csrfCookie = "crm_csrf=def; Path=/";

        expect(readSetCookieHeaders(sessionCookie)).toEqual([sessionCookie]);
        expect(readSetCookieHeaders([sessionCookie, csrfCookie])).toEqual([sessionCookie, csrfCookie]);
        expect(readSetCookieHeaders(undefined)).toEqual([]);
    });

    it("encuentra una cookie por nombre y falla claro cuando no existe", () => {
        const sessionCookie = "crm_session=abc; Path=/";
        const csrfCookie = "crm_csrf=def; Path=/";

        expect(findSetCookieHeader([sessionCookie, csrfCookie], "crm_csrf")).toBe(csrfCookie);
        expect(() => findSetCookieHeader([sessionCookie], "crm_refresh")).toThrow("No se encontro Set-Cookie para crm_refresh.");
    });
});
