import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { AppRouteContent, type AppRouteContentProps } from "../../src/routes/AppRouteContent";
import type { IdentityProfile, IdentityRole } from "../../src/services/auth/identity-contracts";
import type * as FollowUpService from "../../src/services/formalization/follow-up-service";
import { getHomeSummary } from "../../src/services/formalization/home-summary-service";
import { installBrowserApiDoubles } from "../support/browser";

// Banner tests isolate their source from the independently tested canonical follow-up read.
vi.mock("../../src/services/formalization/follow-up-service", async (importOriginal) => {
    const original = await importOriginal<typeof FollowUpService>();
    return { ...original, getFollowUp: vi.fn().mockResolvedValue({ schemaVersion: 1, observedAt: "2026-10-26T12:00:00Z", filters: { search: "", projectId: "", queue: "all" }, page: { number: 1, size: 25, total: 0, totalPages: 0 }, counts: { all: 0, approvals: 0, contracts: 0, send: 0, signature: 0, bank: 0, balance: 0, transfer: 0, signed: 0, closed: 0 }, projects: [], items: [], sources: { native: { total: 0 }, legacy: { total: 0, enabled: true } } }) };
});
vi.mock("../../src/services/formalization/home-summary-service", () => ({ getHomeSummary: vi.fn() }));
const role: IdentityRole = { code: "formalizacion", name: "Formalización", status: "active" };
const stagePermission = { code: "formalizacion.home.stages.read", effect: "allow" as const, scope: "self" as const, source: "role" as const };
const counts = { contracts: { toSend: 6, pendingSignature: 3 }, banking: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 };
const summary = { schemaVersion: 1 as const, observedAt: "2026-10-22T20:00:00.000Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00Z", endExclusive: "2027-01-01T06:00:00Z" }, counts, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 5 } };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getHomeSummary).mockReset().mockResolvedValue(summary);
});
afterEach(cleanup);

it.each([
    ["Por enviar", "Contratos por enviar"],
    ["Pendientes de firma", "Contratos pendientes de firma"],
])("keeps the %s queue read-only without command requests", async (label, title) => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Unexpected operational request"));
    vi.stubGlobal("fetch", fetchMock);
    try {
        render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, { code: "formalizacion.contracts.send", effect: "allow" }, { code: "formalizacion.contracts.revert", effect: "allow" }]} />);
        fireEvent.click(await screen.findByRole("button", { name: `Abrir ${label}` }));
        const heading = screen.getByRole("heading", { name: title, level: 1 });
        const header = heading.closest("header");
        expect(header).not.toBeNull();
        if (!header) throw new Error("Missing queue header");
        expect(within(header).queryByText("0 órdenes")).toBeNull();
        const queue = await screen.findByRole("region", { name: "Órdenes filtradas" });
        expect(within(queue).getByText("No hay órdenes para estos filtros.")).toBeTruthy();
        expect(within(queue).getAllByRole("row")).toHaveLength(2);
        expect(screen.queryByRole("table", { name: "Contratos" })).toBeNull();
        expect(screen.queryAllByRole("button", { name: /Registrar envío|Revertir envío|Ver seguimiento de/ })).toHaveLength(0);
        expect(screen.queryByText(/órdenes cargadas|DEMO-OV-/)).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(getHomeSummary).toHaveBeenCalledTimes(1);
    } finally {
        vi.unstubAllGlobals();
    }
});

it.each([undefined, [], [{ ...role, code: "owner" }], [{ ...role, code: "jefe" }], [{ ...role, status: "inactive" }]])("does not mount contracts without an effective grant for roles %j", (roles) => {
    render(<FormalizationHomePage roles={roles} effectivePermissions={[]} />);
    expect(screen.queryByRole("heading", { name: "Contratos pendientes" })).toBeNull();
    expect(getHomeSummary).not.toHaveBeenCalled();
});

it("loads real counts only with an effective grant, then unmounts on revocation", async () => {
    const { rerender } = render(<FormalizationHomePage />);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    expect(screen.getByRole("status", { name: "Cargando Por enviar" })).toBeTruthy();
    await screen.findByLabelText("Valor: Por enviar, 6");
    expect(screen.getByLabelText("Valor: Pendientes de firma, 3")).toBeTruthy();
    rerender(<FormalizationHomePage roles={[{ ...role, status: "inactive" }]} effectivePermissions={[]} />);
    expect(screen.queryByRole("heading", { name: "Contratos pendientes" })).toBeNull();
    expect(getHomeSummary).toHaveBeenCalledTimes(1);
});

it("shows unknown slots with an explicit error", async () => {
    vi.mocked(getHomeSummary).mockRejectedValue(new Error("offline"));
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    expect((await screen.findAllByRole("alert")).map((node) => node.textContent)).toEqual(Array(6).fill("Sin verificar"));
    expect(screen.getByLabelText("Por enviar: sin verificar").textContent).toBe("—");
    expect(screen.getByLabelText("Pendientes de firma: sin verificar").textContent).toBe("—");
    expect(screen.queryByText("Contratos no disponibles")).toBeNull();
    expect(screen.queryByLabelText("Valor: Por enviar, 0")).toBeNull();
    expect(screen.getByText("Por enviar", { selector: ".formalization-banner__caption" })).toBeTruthy();
    expect(screen.getByText("Pendientes de firma", { selector: ".formalization-banner__caption" })).toBeTruthy();
    expect(screen.queryByText(/No se pudieron verificar/)).toBeNull();
    fireEvent.mouseOver(screen.getByRole("button", { name: "Reintentar conteos de contratos" }));
    expect((await screen.findByRole("tooltip")).textContent).toBe("No se pudieron verificar los conteos de contratos. Reintentar consulta.");
});

it("replaces each count with its own preload while loading and shares the StrictMode request", async () => {
    let resolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary).mockReturnValue(
        new Promise((done) => {
            resolve = done;
        }),
    );
    render(
        <StrictMode>
            <FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />
        </StrictMode>,
    );
    for (const label of ["Por enviar", "Pendientes de firma"]) {
        const metric = screen.getByRole("button", { name: `Abrir ${label}` });
        expect(within(metric).getByRole("status", { name: `Cargando ${label}` })).toBeTruthy();
        expect(within(metric).queryByText("0")).toBeNull();
    }
    expect(screen.queryByText(/Sin verificar/)).toBeNull();
    expect(screen.getByText("Por enviar", { selector: ".formalization-banner__caption" })).toBeTruthy();
    expect(screen.getByText("Pendientes de firma", { selector: ".formalization-banner__caption" })).toBeTruthy();
    expect(getHomeSummary).toHaveBeenCalledTimes(1);
    resolve(summary);
    await screen.findByLabelText("Valor: Por enviar, 6");
    expect(screen.getByLabelText("Valor: Pendientes de firma, 3")).toBeTruthy();
});

it("does not request a hidden contracts banner on direct Orders entry", () => {
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} initialView="orders" />);
    expect(getHomeSummary).not.toHaveBeenCalled();
});

it("marks successful zero counts as verified", async () => {
    vi.mocked(getHomeSummary).mockResolvedValue({ ...summary, counts: { ...counts, contracts: { toSend: 0, pendingSignature: 0 } } });
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    await screen.findByLabelText("Valor: Por enviar, 0");
    expect(screen.getByLabelText("Valor: Pendientes de firma, 0")).toBeTruthy();
    expect(screen.queryByText(/Sin verificar/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
});

it("retries failed contracts and displays the successful source counts", async () => {
    vi.mocked(getHomeSummary)
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ ...summary, counts: { ...counts, contracts: { toSend: 186, pendingSignature: 0 } } });
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar conteos de contratos" }));
    await screen.findByLabelText("Valor: Por enviar, 186");
    expect(screen.getByLabelText("Valor: Pendientes de firma, 0")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
});

it("ignores late results after revocation and fetches anew on grant", async () => {
    let resolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const { rerender } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    rerender(<FormalizationHomePage roles={[]} effectivePermissions={[]} />);
    resolve(summary);
    await waitFor(() => {
        expect(screen.queryByLabelText("Valor: Por enviar, 6")).toBeNull();
    });
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
});

it.each(["formalizacion.home.read", "formalizacion.contracts.read", "unrelated.read"])("keeps role-only reads through the authenticated root despite deny %s", async (code) => {
    const profile: IdentityProfile = {
        auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
        user: { publicId: "user", displayName: "Test", email: "test@example.test", status: "active", permissionVersion: 1, profileImageUrl: null },
        session: { publicId: "session", status: "active", permissionVersion: 1, expiresAt: "2026-10-23T00:00:00.000Z", expiresInSeconds: 3600 },
        roles: [role],
        orgUnits: [{ publicId: "formalization", code: "formalizacion", name: "Formalización", membership: "member", scope: "self", status: "active" }],
        permissions: [{ ...stagePermission, scope: "self", source: "role" }],
    };
    const props: AppRouteContentProps = { authState: { status: "authenticated", profile }, authRetryFeedback: null, isAuthRetryDisabled: false, isMicrosoftSessionPending: false, isSubmittingLogin: false, loginError: null, onLocalLogin: vi.fn(), onLogout: vi.fn(), onMicrosoftLogin: vi.fn(), onNavigate: vi.fn(), onRetryAuthCheck: vi.fn(), path: "/home/formalization" };
    const { rerender } = render(
        <AppRouteContent
            {...props}
            authState={{
                status: "authenticated",
                profile: {
                    ...profile,
                    permissions: [
                        { ...stagePermission, scope: "self", source: "role" },
                        { code, scope: "self", source: "role", effect: "deny" },
                    ],
                },
            }}
        />,
    );
    await screen.findByRole("heading", { name: "Formalización", level: 1 });
    await screen.findByLabelText("Valor: Por enviar, 6");
    rerender(<AppRouteContent {...props} authState={{ status: "authenticated", profile: { ...profile, roles: [], permissions: [] } }} />);
    expect(screen.queryByRole("heading", { name: "Contratos pendientes" })).toBeNull();
    expect(getHomeSummary).toHaveBeenCalledTimes(1);
});
