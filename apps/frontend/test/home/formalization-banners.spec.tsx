import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getApprovalCount } from "../../src/services/formalization/approval-summary-service";
import { getHomeSummary } from "../../src/services/formalization/home-summary-service";

vi.mock("../../src/services/formalization/approval-summary-service", () => ({ getApprovalCount: vi.fn() }));
vi.mock("../../src/services/formalization/home-summary-service", () => ({ getHomeSummary: vi.fn() }));
const role = { code: "formalizacion", name: "Formalización", status: "active" as const };
const stagePermission = { code: "formalizacion.home.stages.read", effect: "allow" as const, scope: "self" as const, source: "role" as const };
const counts = { contracts: { toSend: 0, pendingSignature: 0 }, banking: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 };
beforeEach(() => {
    vi.mocked(getApprovalCount).mockReset().mockResolvedValue(0);
    vi.mocked(getHomeSummary)
        .mockReset()
        .mockResolvedValue({ schemaVersion: 1, observedAt: "2026-10-23T12:00:00Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00Z", endExclusive: "2027-01-01T06:00:00Z" }, counts, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 0 } });
});

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { getAppRoute } from "../../src/routes/app-routes";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);

it("retries failed approvals before opening the empty queue", async () => {
    installBrowserApiDoubles();
    vi.mocked(getApprovalCount).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(2);
    render(<FormalizationHomePage effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar pendientes de aprobación" }));
    await screen.findByLabelText("Órdenes pendientes de aprobación: 2");
    expect(getApprovalCount).toHaveBeenCalledTimes(2);
});

it("shares the approval request during StrictMode replay", async () => {
    installBrowserApiDoubles();
    vi.mocked(getApprovalCount).mockResolvedValue(17);
    render(
        <StrictMode>
            <FormalizationHomePage effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />
        </StrictMode>,
    );
    await screen.findByLabelText("Órdenes pendientes de aprobación: 17");
    expect(getApprovalCount).toHaveBeenCalledTimes(1);
});

it("does not request a hidden approval banner on direct Orders entry", () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage initialView="orders" effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    expect(getApprovalCount).not.toHaveBeenCalled();
});

it.each([true, false])("does not log dummy contract data in development: %s", (development) => {
    installBrowserApiDoubles();
    vi.stubEnv("DEV", development);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
        render(<FormalizationHomePage />);
        expect(log).not.toHaveBeenCalled();
        expect(getApprovalCount).not.toHaveBeenCalled();
    } finally {
        log.mockRestore();
        vi.unstubAllEnvs();
    }
});

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

it("preserves decorative SVG artwork for permitted banner containers", () => {
    installBrowserApiDoubles();
    const { container } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, { code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
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

it("shows a separate approval strip only with an effective grant and preserves other banners", () => {
    installBrowserApiDoubles();
    const permission = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    const { container, rerender } = render(<FormalizationHomePage />);
    expect(screen.queryByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeNull();
    expect(screen.getByRole("region", { name: "Bienvenida a Formalización" })).toBeTruthy();
    expect(screen.getByText("Hola")).toBeTruthy();
    expect(container.querySelectorAll(".formalization-home__banners > article")).toHaveLength(0);
    rerender(<FormalizationHomePage effectivePermissions={[permission, { ...permission, effect: "deny" }]} />);
    expect(screen.queryByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeNull();
    rerender(<FormalizationHomePage effectivePermissions={[permission]} />);
    expect(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }).closest(".formalization-home__header")).toBeTruthy();
    expect(container.querySelectorAll(".formalization-home__banners > article")).toHaveLength(0);
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

it("does not mount any unauthorized stage banners", async () => {
    const Page = getAppRoute("/home/formalization")?.Page;
    expect(Page).toBeDefined();
    if (!Page) return;
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    await screen.findByRole("heading", { name: "Formalización", level: 1 });
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    for (const label of ["Gestión bancaria", "Pendientes de saldo", "Traspasos pendientes", "Traspaso firmado", "Formalizaciones cerradas este año"]) expect(screen.queryByRole("heading", { name: label })).toBeNull();
    expect(screen.queryByText(/aún cuenta contratos firmados/)).toBeNull();
    expect(screen.queryAllByLabelText(/^Valor:/)).toHaveLength(0);
    expect(getHomeSummary).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Dato no disponible")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar contrato" })).toBeNull();
});

it.each([
    ["Sin iniciar / En proceso", "Gestión bancaria", 1],
    ["Consulta financiera", "Pendientes de saldo", 1],
    ["Por gestionar", "Traspasos pendientes", 1],
    ["Firma registrada · Llaves pendientes", "Traspaso firmado", 3],
    ["Proceso finalizado", "Formalizaciones cerradas este año", 0],
])("opens the %s banner as an empty table", async (label, title) => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization")?.Page;
    if (!Page) throw new Error("Missing Formalization Home");
    render(<Page roles={[role]} effectivePermissions={[stagePermission]} currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    fireEvent.click(await screen.findByRole("button", { name: `Abrir ${label}` }));
    expect(screen.getByRole("heading", { name: title, level: 1 })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
});
