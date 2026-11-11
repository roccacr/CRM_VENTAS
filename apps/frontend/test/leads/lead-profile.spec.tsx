import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeadProfilePage } from "../../src/modules/leads/LeadProfilePage";
import { getAppRoute } from "../../src/routes/app-routes";
import { resolveRouteState } from "../../src/routes/auth-state";
import { ApiClientError, apiRequest } from "../../src/services/api/api-client";
import { canReadLeadProfile, leadProfilePath } from "../../src/services/leads/lead-profile-service";
import { readLeadIdentity } from "../../src/services/leads/lead-profile-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", () => ({
    apiRequest: vi.fn(),
    ApiClientError: class extends Error {
        constructor(
            message: string,
            readonly status: number,
        ) {
            super(message);
        }
    },
}));
beforeEach(installBrowserApiDoubles);
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});
describe("acceso al perfil completo", () => {
    it("shows a retry instead of an endless skeleton when the proxy returns HTML", async () => {
        window.history.replaceState(null, "", "/home/formalization/perfil?source=legacy&id=12");
        vi.mocked(apiRequest).mockResolvedValue(null);
        render(<LeadProfilePage effectivePermissions={[{ code: "lead.profile.read", effect: "allow", scope: "self", source: "role" }]} />);
        expect(await screen.findByText("No fue posible cargar el perfil completo")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
        expect(screen.queryByRole("status", { name: "Cargando perfil completo del lead" })).not.toBeInTheDocument();
    });
    it("genera una identidad por origen y PK, nunca por la orden", () => {
        expect(leadProfilePath({ source: "legacy", id: "12" })).toBe("/home/formalization/perfil?source=legacy&id=12");
        expect(leadProfilePath({ source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" })).toBe("/home/formalization/perfil?source=native&id=01ARZ3NDEKTSV4RRFFQ69G5FAV");
    });
    it("una denegación prevalece sobre un permiso", () => {
        expect(
            canReadLeadProfile([
                { code: "lead.profile.read", effect: "allow" },
                { code: "lead.profile.read", effect: "deny" },
            ]),
        ).toBe(false);
        expect(canReadLeadProfile([{ code: "lead.profile.read", effect: "allow" }])).toBe(true);
    });
    it("el acceso directo sin permiso no monta ni consulta el perfil", () => {
        render(<LeadProfilePage effectivePermissions={[]} />);
        expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
        expect(apiRequest).not.toHaveBeenCalled();
    });
    it.each(["role", "override"])("autoriza el permiso efectivo de origen %s sin exigir un menú operativo", (source) => {
        const profile = { permissions: [{ code: "lead.profile.read", effect: "allow", source }], orgUnits: [], roles: [] };
        expect(resolveRouteState(profile as never, "/home/formalization/perfil?source=legacy&id=12").status).toBe("authenticated");
        expect(resolveRouteState({ ...profile, permissions: [] } as never, "/home/formalization/perfil?source=legacy&id=12").status).toBe("forbidden");
    });
    it("rechaza IDs cruzados y parámetros duplicados", () => {
        expect(readLeadIdentity("?source=native&id=12")).toBeNull();
        expect(readLeadIdentity("?source=legacy&id=12&id=13")).toBeNull();
        expect(readLeadIdentity("?source=legacy&id=12")).toEqual({ source: "legacy", id: "12" });
    });
    it("muestra carga y el perfil confirmado por la API", async () => {
        window.history.replaceState(null, "", "/home/formalization/perfil?source=legacy&id=12");
        vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, observedAt: "2026-11-02T12:00:00Z", id: "12", source: "legacy", sources: ["legacy"], sections: [{ title: "Contacto", fields: [{ code: "fullName", label: "Nombre", value: "Nombre prueba", source: "legacy", legacyValue: null }] }], history: { items: [], hasMore: false, nextCursor: null }, orders: { native: { items: [], hasMore: false, page: 1 }, legacy: { items: [], hasMore: false, page: 1 } } });
        render(<LeadProfilePage effectivePermissions={[{ code: "lead.profile.read", effect: "allow", scope: "self", source: "override" }]} />);
        expect(screen.getByRole("status", { name: "Cargando perfil completo del lead" })).toBeInTheDocument();
        expect(await screen.findByRole("heading", { name: "Nombre prueba" })).toBeInTheDocument();
        expect(apiRequest).toHaveBeenCalledWith("/leads/profile?source=legacy&id=12&orderPage=1");
    });
    it("muestra no encontrado cuando el endpoint devuelve 404", async () => {
        window.history.replaceState(null, "", "/home/formalization/perfil?source=legacy&id=12");
        vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("No encontrado", 404, null));
        render(<LeadProfilePage effectivePermissions={[{ code: "lead.profile.read", effect: "allow", scope: "self", source: "role" }]} />);
        expect(await screen.findByText("Lead no encontrado")).toBeInTheDocument();
    });
    it("muestra el perfil nuevo unificado, sus orígenes y los valores legacy distintos", async () => {
        window.history.replaceState(null, "", "/home/formalization/perfil?source=native&id=01ARZ3NDEKTSV4RRFFQ69G5FAV");
        vi.mocked(apiRequest).mockResolvedValue({
            schemaVersion: 1,
            observedAt: "2026-11-02T12:00:00Z",
            id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
            source: "native",
            sources: ["native", "legacy"],
            sections: [
                {
                    title: "Datos generales",
                    fields: [
                        { code: "fullName", label: "Nombre", value: "Nombre nativo", source: "native", legacyValue: "Nombre anterior" },
                        { code: "profession", label: "Profesión", value: "Profesión complementaria", source: "legacy", legacyValue: null },
                    ],
                },
            ],
            history: { items: [], hasMore: false, nextCursor: null },
            orders: { native: { items: [], hasMore: false, page: 1 }, legacy: { items: [], hasMore: false, page: 1 } },
        });
        render(<LeadProfilePage effectivePermissions={[{ code: "lead.profile.read", effect: "allow", scope: "self", source: "role" }]} />);
        expect(await screen.findByRole("heading", { name: "Nombre nativo" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("tab", { name: "Información completa" }));
        expect(screen.getByText("Valor distinto en el sistema anterior: Nombre anterior")).toBeInTheDocument();
        expect(screen.getByText("Profesión complementaria")).toBeInTheDocument();
        expect(screen.getAllByText("Nuevo").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Anterior").length).toBeGreaterThan(0);
    });
    it("retira el perfil cuando la API deniega un permiso que la UI aún tenía", async () => {
        window.history.replaceState(null, "", "/home/formalization/perfil?source=legacy&id=12");
        vi.mocked(apiRequest)
            .mockResolvedValueOnce({ schemaVersion: 1, observedAt: "2026-11-02T12:00:00Z", id: "12", source: "legacy", sources: ["legacy"], sections: [{ title: "Contacto", fields: [{ code: "fullName", label: "Nombre", value: "Perfil antes de revocar", source: "legacy", legacyValue: null }] }], history: { items: [], hasMore: true, nextCursor: "next" }, orders: { native: { items: [], hasMore: false, page: 1 }, legacy: { items: [], hasMore: false, page: 1 } } })
            .mockRejectedValueOnce(new ApiClientError("Permiso revocado", 403, null));
        render(<LeadProfilePage effectivePermissions={[{ code: "lead.profile.read", effect: "allow", scope: "self", source: "role" }]} />);
        expect(await screen.findByRole("heading", { name: "Perfil antes de revocar" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Siguiente página del historial" }));
        expect(await screen.findByText("Acceso denegado")).toBeInTheDocument();
        expect(screen.queryAllByText("Perfil antes de revocar")).toHaveLength(0);
        expect(apiRequest).toHaveBeenCalledTimes(2);
    });
});

it.each(["/home/formalization/perfil?source=legacy&id=20519", "/perfil?source=legacy&id=20519"])("mantiene Formalización y su permiso en %s", (path) => {
    expect(getAppRoute(path)).toMatchObject({ workspaceCode: "formalization", permissionCode: "lead.profile.read" });
});
