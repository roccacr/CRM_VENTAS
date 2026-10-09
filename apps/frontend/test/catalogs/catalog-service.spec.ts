import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApiUrl } from "../../src/config/frontend-env";

const createJsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        headers: {
            "content-type": "application/json",
        },
        status,
    });

const getRequestUrl = (input: RequestInfo | URL): URL => new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);

const catalogResponse = {
    catalog: {
        code: "projects",
        label: "Proyectos",
        moduleCode: "catalog_project",
    },
    items: [
        {
            detail: "Proyecto importado",
            externalReferences: [{ externalId: "252150004", status: "active", systemCode: "netsuite", systemName: "NetSuite" }],
            name: "CRM Legacy",
            nativeCode: "projects-crm-legacy",
            publicId: "CAT-001",
            status: "active",
            updatedAt: "2026-10-05T15:00:00.000Z",
        },
    ],
    total: 1,
};

describe("catalog-service", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("lista catalogos administrativos enviando modulo scoped, limite, busqueda y estado", async () => {
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = getRequestUrl(input);

            expect(url.pathname).toBe("/catalogs/projects/items");
            expect(url.searchParams.get("moduleCode")).toBe("administration");
            expect(url.searchParams.get("limit")).toBe("100");
            expect(url.searchParams.get("search")).toBe("CRM");
            expect(url.searchParams.get("status")).toBe("active");

            return createJsonResponse(catalogResponse);
        });

        vi.stubGlobal("fetch", fetchMock);
        const { listCatalogItems } = await import("../../src/services/catalogs/catalog-service");

        await expect(listCatalogItems("projects", { limit: 100, moduleCode: "administration", search: "CRM", status: "active" })).resolves.toEqual(catalogResponse);
        expect(fetchMock).toHaveBeenCalledWith(
            buildApiUrl("/catalogs/projects/items?moduleCode=administration&search=CRM&status=active&limit=100"),
            expect.objectContaining({
                credentials: "include",
                method: "GET",
            }),
        );
    });

    it("no envia estado remoto cuando el filtro visible esta en Todos", async () => {
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = getRequestUrl(input);

            expect(url.searchParams.get("status")).toBeNull();

            return createJsonResponse(catalogResponse);
        });

        vi.stubGlobal("fetch", fetchMock);
        const { listCatalogItems } = await import("../../src/services/catalogs/catalog-service");

        await listCatalogItems("projects", { limit: 100, moduleCode: "administration", status: "all" });
        expect(fetchMock).toHaveBeenCalledWith(buildApiUrl("/catalogs/projects/items?moduleCode=administration&limit=100"), expect.any(Object));
    });

    it.each([null, undefined])("normalizes absent optional detail and references (%s) for explicit UI fallbacks", async (missingValue) => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => createJsonResponse({ ...catalogResponse, items: [{ ...catalogResponse.items[0], detail: missingValue, externalReferences: missingValue }] })),
        );
        const { listCatalogItems } = await import("../../src/services/catalogs/catalog-service");
        const response = await listCatalogItems("projects", { moduleCode: "administration" });
        expect(response.items[0]).toMatchObject({ detail: null, externalReferences: [] });
    });

    it("rejects damaged assigned references rather than presenting them as unassigned", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => createJsonResponse({ ...catalogResponse, items: [{ ...catalogResponse.items[0], externalReferences: [{ externalId: null, status: "active", systemCode: "odoo", systemName: "Odoo" }] }] })),
        );
        const { listCatalogItems } = await import("../../src/services/catalogs/catalog-service");
        await expect(listCatalogItems("projects", { moduleCode: "administration" })).rejects.toThrow("CatalogExternalReference");
    });
});
