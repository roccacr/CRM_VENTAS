import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getApprovalCount } from "../../src/services/formalization/approval-summary-service";
import type * as FollowUpService from "../../src/services/formalization/follow-up-service";
import { getFollowUp } from "../../src/services/formalization/follow-up-service";
import { getHomeSummary } from "../../src/services/formalization/home-summary-service";
import type * as OrderAddendumService from "../../src/services/formalization/order-addendum-service";
import { getPendingAddendumCount } from "../../src/services/formalization/order-addendum-service";

// Banner tests isolate their source from the independently tested canonical follow-up read.
vi.mock("../../src/services/formalization/follow-up-service", async (importOriginal) => {
    const original = await importOriginal<typeof FollowUpService>();
    return { ...original, getFollowUp: vi.fn().mockResolvedValue({ schemaVersion: 1, observedAt: "2026-10-26T12:00:00Z", filters: { search: "", projectId: "", queue: "all" }, page: { number: 1, size: 25, total: 0, totalPages: 0 }, counts: { all: 0, approvals: 0, contracts: 0, send: 0, signature: 0, bank: 0, balance: 0, transfer: 0, signed: 0, closed: 0 }, projects: [], items: [], sources: { native: { total: 0 }, legacy: { total: 0, enabled: true } } }) };
});
vi.mock("../../src/services/formalization/approval-summary-service", () => ({ getApprovalCount: vi.fn() }));
vi.mock("../../src/services/formalization/home-summary-service", () => ({ getHomeSummary: vi.fn() }));
vi.mock("../../src/services/formalization/order-addendum-service", async (importOriginal) => ({ ...(await importOriginal<typeof OrderAddendumService>()), getPendingAddendumCount: vi.fn() }));
const role = { code: "formalizacion", name: "Formalización", status: "active" as const };
const stagePermission = { code: "formalizacion.home.stages.read", effect: "allow" as const, scope: "self" as const, source: "role" as const };
const counts = { contracts: { toSend: 0, pendingSignature: 0 }, banking: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 };
beforeEach(() => {
    vi.mocked(getPendingAddendumCount).mockReset().mockResolvedValue(0);
    vi.mocked(getApprovalCount).mockReset().mockResolvedValue(0);
    vi.mocked(getHomeSummary)
        .mockReset()
        .mockResolvedValue({ schemaVersion: 1, observedAt: "2026-10-23T12:00:00Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00Z", endExclusive: "2027-01-01T06:00:00Z" }, counts, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 0 } });
});

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { getAppRoute } from "../../src/routes/app-routes";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);

const addendumRead = [
    { code: "formalizacion.orders.read", effect: "allow" },
    { code: "formalizacion.orders.addendum.read", effect: "allow" },
] as const;
const addendumBanner = { code: "formalizacion.home.addendum.read", effect: "allow" } as const;
it("shows the independent addendum banner beside approvals and opens its authorized queue", async () => {
    installBrowserApiDoubles();
    vi.mocked(getPendingAddendumCount).mockResolvedValue(3);
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[addendumBanner, ...addendumRead, { code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    await screen.findByLabelText("Órdenes pendientes de adéndum: 3");
    expect(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver pendientes de adéndum de Formalización" }));
    await waitFor(() => {
        expect(vi.mocked(getFollowUp).mock.calls.at(-1)?.[0]).toMatchObject({ queues: ["addendum"] });
    });
});
it.each([{ permissions: [] }, { permissions: [addendumBanner, { ...addendumBanner, effect: "deny" as const }] }])("does not request an unauthorized addendum banner: %j", ({ permissions }) => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[...permissions, ...addendumRead]} />);
    expect(getPendingAddendumCount).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^Órdenes pendientes de adéndum:/)).toBeNull();
});
it("permits the Home count without granting the addendum queue", async () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[addendumBanner]} />);
    await screen.findByLabelText("Órdenes pendientes de adéndum: 0");
    expect(screen.getByRole("button", { name: "Ver pendientes de adéndum de Formalización" }).hasAttribute("disabled")).toBe(true);
});
it("retries an unavailable addendum count instead of showing a false zero", async () => {
    installBrowserApiDoubles();
    vi.mocked(getPendingAddendumCount).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(4);
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[addendumBanner, ...addendumRead]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar pendientes de adéndum" }));
    await screen.findByLabelText("Órdenes pendientes de adéndum: 4");
});
it("starts a fresh pending count when refreshed during an older request", async () => {
    installBrowserApiDoubles();
    const pending: ((count: number) => void)[] = [];
    vi.mocked(getPendingAddendumCount).mockImplementation(
        () =>
            new Promise<number>((resolve) => {
                pending.push(resolve);
            }),
    );
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[addendumBanner, ...addendumRead]} />);
    fireEvent.click(screen.getByRole("button", { name: "Recargar banners" }));
    await waitFor(() => {
        expect(pending).toHaveLength(2);
    });
    pending[1]?.(2);
    await screen.findByLabelText("Órdenes pendientes de adéndum: 2");
    await act(async () => {
        pending[0]?.(9);
        await Promise.resolve();
    });
    expect(screen.getByLabelText("Órdenes pendientes de adéndum: 2")).toBeTruthy();
    expect(screen.queryByLabelText("Órdenes pendientes de adéndum: 9")).toBeNull();
});

it("retries failed approvals before opening the empty queue", async () => {
    installBrowserApiDoubles();
    vi.mocked(getApprovalCount).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(2);
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar pendientes de aprobación" }));
    await screen.findByLabelText("Órdenes pendientes de aprobación: 2");
    expect(getApprovalCount).toHaveBeenCalledTimes(2);
});

it("shares the approval request during StrictMode replay", async () => {
    installBrowserApiDoubles();
    vi.mocked(getApprovalCount).mockResolvedValue(17);
    render(
        <StrictMode>
            <FormalizationHomePage roles={[role]} effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />
        </StrictMode>,
    );
    await screen.findByLabelText("Órdenes pendientes de aprobación: 17");
    expect(getApprovalCount).toHaveBeenCalledTimes(1);
});

it("does not request a hidden approval banner on direct Orders entry", () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage roles={[role]} initialView="orders" effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
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
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
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
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    await waitFor(() => {
        expect(screen.getByLabelText("Órdenes pendientes de aprobación: 17")).toBeTruthy();
    });
});

it("shows unavailable rather than zero on source failure", async () => {
    installBrowserApiDoubles();
    vi.mocked(getApprovalCount).mockRejectedValue(new Error("offline"));
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    await waitFor(() => {
        expect(screen.getByText("No disponible")).toBeTruthy();
    });
    expect(screen.queryByLabelText("Órdenes pendientes de aprobación: 0")).toBeNull();
});

it("keeps unauthorized follow-up disabled and an empty recent-activity surface", () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage />);
    expect(screen.queryByRole("heading", { name: "Pendientes por proyecto" })).toBeNull();
    expect(screen.queryByText("Órdenes por proyecto y etapa")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Tiempos de gestión bancaria" })).toBeNull();
    expect(screen.queryByText("Duración por orden financiada")).toBeNull();
    expect(screen.getByRole("heading", { name: "Movimientos recientes" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Filtrar por proyecto" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^Ver movimiento de/ })).toHaveLength(0);
    expect(screen.getByText("Los movimientos recientes aún no están disponibles.")).toBeTruthy();
});

it("keeps follow-up disabled without grants and enables it from the effective approval permission alone", () => {
    installBrowserApiDoubles();
    const { rerender } = render(<FormalizationHomePage />);
    expect(screen.queryByRole("combobox", { name: "Bandeja de seguimiento" })).toBeNull();
    const permission = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    expect(screen.getByText("El seguimiento de órdenes aún no está disponible.")).toBeTruthy();
    // La autorizacion usa solo los grants efectivos de la API; el rol activo ya no es requisito.
    rerender(<FormalizationHomePage effectivePermissions={[permission]} />);
    expect(screen.getByRole("combobox", { name: "Bandeja de seguimiento" })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
});

it.each(["role", "override"] as const)("keeps approvals unmounted until an effective %s permission arrives", (source) => {
    installBrowserApiDoubles();
    const { rerender } = render(<FormalizationHomePage />);
    const bannerName = "Ver pendientes de aprobación de Formalización";
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[]} />);
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[{ code: "contract.review", effect: "allow" }]} />);
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
    const grant = { code: "formalizacion.home.approvals.read", effect: "allow" as const, source };
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[grant]} />);
    expect(screen.getByRole("button", { name: bannerName })).toBeTruthy();
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[grant, { ...grant, effect: "deny" }]} />);
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
    rerender(<FormalizationHomePage />);
    expect(screen.queryByRole("button", { name: bannerName })).toBeNull();
});

it("uses distinct background artwork without foreground icons in permitted banners", () => {
    installBrowserApiDoubles();
    const { container } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, { code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    expect(container.querySelector(".formalization-banner__icon")).toBeNull();
    const patterns = [...container.querySelectorAll(".formalization-banner > svg.formalization-banner__pattern")];
    expect(patterns).toHaveLength(7);
    expect(new Set(patterns.map((pattern) => pattern.lastElementChild?.getAttribute("d"))).size).toBe(7);
    for (const pattern of patterns) {
        expect(pattern.getAttribute("aria-hidden")).toBe("true");
    }
});

it("uses the formalization artwork and hides the temporary all-orders shortcut", () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage currentUser={{ displayName: "Roberto", email: "roberto@example.test" }} />);
    const welcome = screen.getByRole("region", { name: "Bienvenida a Formalización" });
    expect(welcome.querySelector("img")?.getAttribute("src")).toContain("rocca-formalization-generated.png");
    expect(welcome.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(screen.getByText("Hola, Roberto")).toBeTruthy();
    expect(screen.queryByText("Las colas de abajo muestran cuántas órdenes hay en cada etapa.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver todas las órdenes" })).toBeNull();
});

it("shows a separate approval strip only with an effective grant and preserves other banners", () => {
    installBrowserApiDoubles();
    const permission = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    const { container, rerender } = render(<FormalizationHomePage />);
    expect(screen.queryByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeNull();
    expect(screen.getByRole("region", { name: "Bienvenida a Formalización" })).toBeTruthy();
    expect(screen.getByText("Hola")).toBeTruthy();
    expect(container.querySelectorAll(".formalization-home__banners > article")).toHaveLength(0);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[permission, { ...permission, effect: "deny" }]} />);
    expect(screen.queryByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeNull();
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[permission]} />);
    expect(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }).closest(".formalization-home__header")).toBeTruthy();
    expect(container.querySelectorAll(".formalization-home__banners > article")).toHaveLength(0);
    expect(screen.getByLabelText("Órdenes pendientes de aprobación: Consultando…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }));
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[]} />);
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
    ["Sin iniciar", "Gestión bancaria", 1],
    ["Consulta financiera", "Pendientes de saldo", 1],
    ["Por gestionar", "Traspasos pendientes", 1],
    ["Firma registrada · Llaves pendientes", "Traspaso firmado", 3],
    ["Proceso finalizado", "Formalizaciones cerradas este año", 0],
])("adds the %s banner to the Home filter", async (label) => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization")?.Page;
    if (!Page) throw new Error("Missing Formalization Home");
    render(<Page roles={[role]} effectivePermissions={[stagePermission]} currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    fireEvent.click(await screen.findByRole("button", { name: `Abrir ${label}` }));
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
    await waitFor(() => {
        expect(vi.mocked(getFollowUp).mock.calls.at(-1)?.[0]?.queues).not.toEqual([]);
    });
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    expect(screen.getByRole("combobox", { name: "Bandeja de seguimiento" })).toBeTruthy();
});

it("contracts-only hides other stage banners and queue options", async () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[{ ...stagePermission, code: "formalizacion.home.contracts.read" }]} />);
    expect(await screen.findByRole("heading", { name: "Contratos pendientes" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Gestión bancaria" })).toBeNull();
    expect(screen.queryByRole("option", { name: /Gestión bancaria/ })).toBeNull();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Bandeja de seguimiento" }));
    expect(await screen.findByRole("option", { name: /Por enviar/ })).toBeTruthy();
});

it("revoking one category discards its mounted queue and pending data", async () => {
    installBrowserApiDoubles();
    const contracts = { ...stagePermission, code: "formalizacion.home.contracts.read" };
    const bank = { ...stagePermission, code: "formalizacion.home.banking.read" };
    const { rerender } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[contracts, bank]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir Sin iniciar" }));
    expect(await screen.findByRole("heading", { name: "Pendientes de seguimiento" })).toBeTruthy();
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[contracts]} />);
    expect(screen.queryByRole("heading", { name: "Gestión bancaria" })).toBeNull();
    expect(screen.queryByRole("option", { name: /Gestión bancaria/ })).toBeNull();
});

it("requests approvals from the effective grant without requiring an active role", () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    expect(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeTruthy();
    expect(getApprovalCount).toHaveBeenCalledTimes(1);
});

it("shows independently verified banking counts and no invented zero after summary failure", async () => {
    installBrowserApiDoubles();
    vi.mocked(getHomeSummary).mockResolvedValueOnce({ schemaVersion: 1, observedAt: "2026-11-02T12:00:00Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00Z", endExclusive: "2027-01-01T06:00:00Z" }, counts: { ...counts, banking: 8, bankingInProgress: 3 }, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 0 } });
    const view = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    expect(await screen.findByLabelText("Valor: Sin iniciar, 8")).toBeTruthy();
    expect(screen.getByLabelText("Valor: En proceso, 3")).toBeTruthy();
    view.unmount();
    vi.mocked(getHomeSummary).mockRejectedValue(new Error("offline"));
    const failedView = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    await screen.findByRole("button", { name: "Reintentar conteos de contratos" });
    for (const value of failedView.container.querySelectorAll(".formalization-banner__value")) expect(value.textContent).toBe("\u2014");
    expect(screen.queryByLabelText(/^Valor:/)).toBeNull();
});

it("adds banner queues and banking substates to the Home filter without replacing the screen", async () => {
    installBrowserApiDoubles();
    const navigate = vi.fn();
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, { code: "formalizacion.home.approvals.read", effect: "allow" }]} onNavigate={navigate} />);
    expect(screen.queryByRole("button", { name: "Ver todas las órdenes" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }));
    await waitFor(() => {
        expect(vi.mocked(getFollowUp).mock.calls.at(-1)?.[0]).toMatchObject({ queues: ["approvals"], page: 1 });
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir Por enviar" }));
    await waitFor(() => {
        expect(vi.mocked(getFollowUp).mock.calls.at(-1)?.[0]).toMatchObject({ queues: ["approvals", "send"] });
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir En proceso" }));
    await waitFor(() => {
        expect(vi.mocked(getFollowUp).mock.calls.at(-1)?.[0]).toMatchObject({ queues: ["approvals", "send", "bank"], bankStages: ["bank_management_in_progress"] });
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir En proceso" }));
    await waitFor(() => {
        expect(vi.mocked(getFollowUp).mock.calls.at(-1)?.[0]?.queues).toEqual(["approvals", "send", "bank"]);
    });
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Bandeja de seguimiento" })).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
});

it("preserves the project and search when a banner adds another queue", async () => {
    installBrowserApiDoubles();
    const email = "banner-preserve@example.invalid";
    const key = `crm:follow-up:v1:${email}:home:all:`;
    localStorage.setItem(key, JSON.stringify({ projectIds: ["legacy-project:1"], selections: ["balance"] }));
    render(<FormalizationHomePage currentUser={{ displayName: "Test", email }} roles={[role]} effectivePermissions={[stagePermission]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar operación" }), { target: { value: "expediente" } });
    await waitFor(() => {
        expect(vi.mocked(getFollowUp).mock.calls.at(-1)?.[0]?.search).toBe("expediente");
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir Por enviar" }));
    await waitFor(() => {
        expect(vi.mocked(getFollowUp).mock.calls.at(-1)?.[0]).toMatchObject({ projectIds: ["legacy-project:1"], search: "expediente", queues: ["balance", "send"], page: 1 });
    });
    localStorage.removeItem(key);
});
