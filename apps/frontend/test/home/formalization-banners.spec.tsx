import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getApprovalCount } from "../../src/services/formalization/approval-summary-service";

vi.mock("../../src/services/formalization/approval-summary-service", () => ({ getApprovalCount: vi.fn() }));
beforeEach(() => {
    vi.mocked(getApprovalCount).mockReset().mockResolvedValue(0);
});

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { getAppRoute } from "../../src/routes/app-routes";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);

it("shows an accessible preload until the approval response arrives", async () => {
    installBrowserApiDoubles();
    let resolveCount: (count: number) => void = () => {};
    vi.mocked(getApprovalCount).mockImplementation(
        () =>
            new Promise<number>((resolve) => {
                resolveCount = resolve;
            }),
    );
    render(<FormalizationHomePage effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    expect(screen.getByRole("status", { name: "Cargando pendientes de aprobación" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }).getAttribute("aria-busy")).toBe("true");
    resolveCount(2);
    await waitFor(() => {
        expect(screen.getByLabelText("Órdenes pendientes de aprobación: 2")).toBeTruthy();
    });
    expect(screen.queryByRole("status", { name: "Cargando pendientes de aprobación" })).toBeNull();
});

it("loads the real count only with permission", async () => {
    installBrowserApiDoubles();
    vi.mocked(getApprovalCount).mockResolvedValue(17);
    const { rerender } = render(<FormalizationHomePage />);
    expect(getApprovalCount).not.toHaveBeenCalled();
    rerender(<FormalizationHomePage effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    await waitFor(() => {
        expect(screen.getByLabelText("Órdenes pendientes de aprobación: 17")).toBeTruthy();
    });
});

it("shows unavailable rather than zero on source failure", async () => {
    installBrowserApiDoubles();
    vi.mocked(getApprovalCount).mockRejectedValue(new Error("offline"));
    render(<FormalizationHomePage effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    await waitFor(() => {
        expect(screen.getByText("No disponible")).toBeTruthy();
    });
    expect(screen.queryByLabelText("Órdenes pendientes de aprobación: 0")).toBeNull();
});

it("keeps project filtering and an empty recent-activity surface", () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage />);
    expect(screen.queryByRole("heading", { name: "Pendientes por proyecto" })).toBeNull();
    expect(screen.queryByText("Órdenes por proyecto y etapa")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Tiempos de gestión bancaria" })).toBeNull();
    expect(screen.queryByText("Duración por orden financiada")).toBeNull();
    expect(screen.getByRole("heading", { name: "Movimientos recientes" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Filtrar por proyecto" })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver movimiento de/ })).toHaveLength(0);
    expect(screen.getByText("Los movimientos recientes aún no están disponibles.")).toBeTruthy();
});

it("aligns follow-up select with banners and removes unauthorized approvals including after revocation", () => {
    installBrowserApiDoubles();
    const { rerender } = render(<FormalizationHomePage />);
    const select = () => screen.getByRole<HTMLSelectElement>("combobox", { name: "Bandeja de seguimiento" });
    const labels = () => [...select().options].map((option) => option.value);
    const expected = ["Todas", "Contratos pendientes", "Gestión bancaria", "Pendientes de saldo", "Traspasos pendientes", "Traspaso firmado", "Formalizaciones cerradas este año"];
    expect(labels()).toEqual(expected);
    expect(screen.queryByText("Mayor antigüedad primero · Días en la etapa actual")).toBeNull();
    expect(select().value).toBe("Todas");
    expect(screen.getByRole("option", { name: "Todas (0)" })).toBeTruthy();
    fireEvent.change(select(), { target: { value: "Traspaso firmado" } });
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    const permission = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    rerender(<FormalizationHomePage effectivePermissions={[permission]} />);
    expect(labels()).toEqual(["Todas", "Pendientes de aprobación", ...expected.slice(1)]);
    fireEvent.change(select(), { target: { value: "Pendientes de aprobación" } });
    expect(screen.getByText("Seguimiento no disponible")).toBeTruthy();
    rerender(<FormalizationHomePage effectivePermissions={[]} />);
    expect(labels()).toEqual(expected);
    expect(select().value).toBe("Todas");
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    expect(screen.queryByRole("option", { name: "Amara" })).toBeNull();
    expect(screen.getByRole("option", { name: "Todas (0)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Gestión bancaria (0)" })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    fireEvent.change(select(), { target: { value: "Contratos pendientes" } });
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
});

it.each(["role", "override"] as const)("keeps approvals unmounted until an effective %s permission arrives", (source) => {
    installBrowserApiDoubles();
    const { rerender } = render(<FormalizationHomePage />);
    const bannerName = "Ver pendientes de aprobación de Formalización";
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
    rerender(<FormalizationHomePage effectivePermissions={[]} />);
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
    rerender(<FormalizationHomePage effectivePermissions={[{ code: "contract.review", effect: "allow" }]} />);
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
    const grant = { code: "formalizacion.home.approvals.read", effect: "allow" as const, source };
    rerender(<FormalizationHomePage effectivePermissions={[grant]} />);
    expect(screen.getByRole("button", { name: bannerName })).toBeTruthy();
    rerender(<FormalizationHomePage effectivePermissions={[grant, { ...grant, effect: "deny" }]} />);
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
    rerender(<FormalizationHomePage />);
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
});

it("uses distinct decorative SVG artwork in the seven unchanged icon containers", () => {
    installBrowserApiDoubles();
    const { container } = render(<FormalizationHomePage effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    const icons = [...container.querySelectorAll(".formalization-banner__icon img")];
    expect(icons).toHaveLength(7);
    expect(icons.map((icon) => icon.getAttribute("src")?.split("/").pop())).toEqual(["approvals.svg", "contracts.svg", "bank.svg", "balance.svg", "transfer.svg", "signed.svg", "closed.svg"]);
    for (const icon of icons) {
        expect(icon.getAttribute("alt")).toBe("");
        expect(icon.getAttribute("width")).toBe("24");
        expect(icon.getAttribute("height")).toBe("24");
        expect(icon.parentElement?.getAttribute("aria-hidden")).toBe("true");
    }
});

it("uses the formalization artwork in the personalized welcome and keeps order navigation", () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage currentUser={{ displayName: "Roberto", email: "roberto@example.test" }} />);
    const welcome = screen.getByRole("region", { name: "Bienvenida a Formalización" });
    expect(welcome.querySelector("img")?.getAttribute("src")).toContain("rocca-formalization-generated.png");
    expect(welcome.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(screen.getByText("Hola, Roberto")).toBeTruthy();
    expect(screen.queryByText("Las colas de abajo muestran cuántas órdenes hay en cada etapa.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las órdenes" }));
    expect(screen.getByRole("heading", { name: "Todas las órdenes", level: 1 })).toBeTruthy();
});

it("shows a separate approval strip only with an effective grant and preserves the six-banner grid", () => {
    installBrowserApiDoubles();
    const permission = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    const { container, rerender } = render(<FormalizationHomePage />);
    expect(screen.queryByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeNull();
    expect(screen.getByRole("region", { name: "Bienvenida a Formalización" })).toBeTruthy();
    expect(screen.getByText("Hola")).toBeTruthy();
    expect(container.querySelectorAll(".formalization-home__banners > article")).toHaveLength(6);
    rerender(<FormalizationHomePage effectivePermissions={[permission, { ...permission, effect: "deny" }]} />);
    expect(screen.queryByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeNull();
    rerender(<FormalizationHomePage effectivePermissions={[permission]} />);
    expect(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }).closest(".formalization-home__header")).toBeTruthy();
    expect(container.querySelectorAll(".formalization-home__banners > article")).toHaveLength(6);
    expect(screen.getByLabelText("Órdenes pendientes de aprobación: Consultando…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }));
    expect(screen.getByRole("heading", { name: "Pendientes de aprobación", level: 1 })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    rerender(<FormalizationHomePage effectivePermissions={[]} />);
    expect(screen.queryByRole("heading", { name: "Pendientes de aprobación", level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
});

it("opens management directly on all orders and returns Home through app navigation", async () => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization/orders")?.Page;
    expect(Page).toBeDefined();
    if (!Page) throw new Error("Missing management route");
    const navigate = vi.fn();
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} onNavigate={navigate} />);
    expect(await screen.findByRole("heading", { name: "Todas las órdenes", level: 1 })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    expect(navigate).toHaveBeenCalledWith("/home/formalization");
});

it("renders six banners with zero totals instead of demo counts", async () => {
    const Page = getAppRoute("/home/formalization")?.Page;
    expect(Page).toBeDefined();
    if (!Page) return;
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    expect(await screen.findAllByRole("article")).toHaveLength(6);
    for (const label of ["Contratos pendientes", "Gestión bancaria", "Pendientes de saldo", "Traspasos pendientes", "Traspaso firmado", "Formalizaciones cerradas este año"]) expect(screen.getByRole("heading", { name: label })).toBeTruthy();
    expect(screen.queryByText(/aún cuenta contratos firmados/)).toBeNull();
    expect(screen.getAllByLabelText(/^Valor:/).map((element) => element.textContent.trim())).toEqual(["0", "0", "0", "0", "0", "0", "0"]);
    expect(screen.queryByLabelText("Dato no disponible")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar contrato" })).toBeNull();
});

it.each([
    ["Por enviar", "Contratos por enviar", 1],
    ["Pendientes de firma", "Contratos pendientes de firma", 1],
    ["Sin iniciar / En proceso", "Gestión bancaria", 1],
    ["Consulta financiera", "Pendientes de saldo", 1],
    ["Por gestionar", "Traspasos pendientes", 1],
    ["Firma registrada · Llaves pendientes", "Traspaso firmado", 3],
    ["Proceso finalizado", "Formalizaciones cerradas este año", 0],
])("opens the %s banner as an empty table", async (label, title) => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization")?.Page;
    if (!Page) throw new Error("Missing Formalization Home");
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    fireEvent.click(await screen.findByRole("button", { name: `Abrir ${label}` }));
    expect(screen.getByRole("heading", { name: title, level: 1 })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
});
