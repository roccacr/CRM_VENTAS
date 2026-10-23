import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { AppRouteContent, type AppRouteContentProps } from "../../src/routes/AppRouteContent";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";
import { getApprovalCount } from "../../src/services/formalization/approval-summary-service";
import { getHomeSummary } from "../../src/services/formalization/home-summary-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/home-summary-service", () => ({ getHomeSummary: vi.fn() }));
vi.mock("../../src/services/formalization/approval-summary-service", () => ({ getApprovalCount: vi.fn() }));
const role = { code: "formalizacion", name: "Formalización", status: "active" as const };
const stagePermission = { code: "formalizacion.home.stages.read", effect: "allow" as const, scope: "self" as const, source: "role" as const };
const counts = { contracts: { toSend: 6, pendingSignature: 3 }, banking: 4, balance: 5, transferPending: 6, transferSigned: 7, closedThisYear: 8 };
const summary = { schemaVersion: 1 as const, observedAt: "2026-10-23T12:00:00.000Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00.000Z", endExclusive: "2027-01-01T06:00:00.000Z" }, counts, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 2 } };
const labels = ["Por enviar", "Pendientes de firma", "Sin iniciar / En proceso", "Consulta financiera", "Por gestionar", "Firma registrada · Llaves pendientes", "Proceso finalizado"];
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getHomeSummary).mockReset().mockResolvedValue(summary);
    vi.mocked(getApprovalCount).mockReset().mockResolvedValue(2);
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

it.each([undefined, [], [{ code: "formalizacion.home.approvals.read", effect: "deny" as const }], [{ ...stagePermission, effect: "deny" as const }], [stagePermission, { ...stagePermission, effect: "deny" as const }]])("requires the stages effective allow and honors deny before mount, query or refresh: %j", (permissions) => {
    render(<FormalizationHomePage roles={[role]} {...(permissions ? { effectivePermissions: permissions } : {})} />);
    expect(screen.queryByRole("heading", { name: "Contratos pendientes" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Gestión bancaria" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recargar banners" })).toBeNull();
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    expect(getHomeSummary).not.toHaveBeenCalled();
});

it.each([true, false])("uses only API effective roles for Owner; formalizacion present=%s", async (hasFormalization) => {
    const owner = { ...role, code: "owner", name: "Owner" };
    render(<FormalizationHomePage roles={hasFormalization ? [owner, role] : [owner]} effectivePermissions={[stagePermission]} />);
    if (hasFormalization) {
        await screen.findByLabelText("Valor: Por enviar, 6");
        expect(screen.getByRole("button", { name: "Recargar banners" })).toBeTruthy();
        expect(getHomeSummary).toHaveBeenCalledTimes(1);
    } else {
        expect(screen.queryByRole("heading", { name: "Contratos pendientes" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Recargar banners" })).toBeNull();
        expect(getHomeSummary).not.toHaveBeenCalled();
    }
});

it("discards stages on direct deny while keeping approvals and its refresh independent", async () => {
    let resolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const approvals = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    const { rerender } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, approvals]} />);
    await screen.findByLabelText("Órdenes pendientes de aprobación: 2");
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, { ...stagePermission, effect: "deny" }, approvals]} />);
    await act(async () => {
        resolve(summary);
        await Promise.resolve();
    });
    expect(screen.queryByLabelText("Valor: Por enviar, 6")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recargar banners" }));
    expect(getHomeSummary).toHaveBeenCalledTimes(1);
    await screen.findByLabelText("Órdenes pendientes de aprobación: 2");
    expect(getApprovalCount).toHaveBeenCalledTimes(2);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
});

it("refreshes all authorized banners without navigation or duplicate requests", async () => {
    const onNavigate = vi.fn();
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, { code: "formalizacion.home.approvals.read", effect: "allow" }]} onNavigate={onNavigate} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    await screen.findByLabelText("Órdenes pendientes de aprobación: 2");
    let resolveStages!: (value: typeof summary) => void;
    let resolveApprovals!: (value: number) => void;
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((resolve) => {
            resolveStages = resolve;
        }),
    );
    vi.mocked(getApprovalCount).mockReturnValueOnce(
        new Promise((resolve) => {
            resolveApprovals = resolve;
        }),
    );
    const refresh = screen.getByRole("button", { name: "Recargar banners" });
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    for (const label of labels) expect(screen.getByRole("status", { name: `Cargando ${label}` })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Cargando pendientes de aprobación" })).toBeTruthy();
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
    expect(getApprovalCount).toHaveBeenCalledTimes(2);
    await act(async () => {
        resolveStages({ ...summary, counts: { ...counts, contracts: { toSend: 5, pendingSignature: 4 } } });
        resolveApprovals(1);
        await Promise.resolve();
    });
    await screen.findByLabelText("Valor: Por enviar, 5");
    expect(screen.getByLabelText("Órdenes pendientes de aprobación: 1")).toBeTruthy();
    expect(onNavigate).not.toHaveBeenCalled();
});

it.each(["stages", "approvals"])("refreshes only the authorized %s source", async (source) => {
    render(<FormalizationHomePage roles={source === "stages" ? [role] : []} effectivePermissions={source === "approvals" ? [{ code: "formalizacion.home.approvals.read", effect: "allow" }] : [stagePermission]} />);
    if (source === "stages") await screen.findByLabelText("Valor: Por enviar, 6");
    else await screen.findByLabelText("Órdenes pendientes de aprobación: 2");
    fireEvent.click(screen.getByRole("button", { name: "Recargar banners" }));
    if (source === "stages") {
        await screen.findByLabelText("Valor: Por enviar, 6");
        expect(getHomeSummary).toHaveBeenCalledTimes(2);
        expect(getApprovalCount).not.toHaveBeenCalled();
    } else {
        await screen.findByLabelText("Órdenes pendientes de aprobación: 2");
        expect(getApprovalCount).toHaveBeenCalledTimes(2);
        expect(getHomeSummary).not.toHaveBeenCalled();
    }
});

it("hides refresh when no banner is authorized", () => {
    render(<FormalizationHomePage roles={[]} />);
    expect(screen.queryByRole("button", { name: "Recargar banners" })).toBeNull();
    expect(getHomeSummary).not.toHaveBeenCalled();
    expect(getApprovalCount).not.toHaveBeenCalled();
});

it.each([undefined, [], [{ ...role, code: "owner" }], [{ ...role, status: "inactive" as const }]])("gates all six stage banners before query for %j", (roles) => {
    render(<FormalizationHomePage roles={roles} effectivePermissions={[stagePermission]} />);
    expect(screen.queryByRole("heading", { name: "Gestión bancaria" })).toBeNull();
    expect(getHomeSummary).not.toHaveBeenCalled();
});

it("shares one StrictMode request and preloads all seven numbers", async () => {
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
    for (const label of labels) expect(screen.getByRole("status", { name: `Cargando ${label}` })).toBeTruthy();
    expect(getHomeSummary).toHaveBeenCalledTimes(1);
    await act(async () => {
        resolve(summary);
        await Promise.resolve();
    });
    expect(screen.getAllByLabelText(/^Valor:/).map((node) => node.textContent)).toEqual(["6", "3", "4", "5", "6", "7", "8"]);
});

it("refreshes on visible focus, deduplicates, clears in queues and refetches on Home return", async () => {
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent.focus(window);
    expect(getHomeSummary).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    let resolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    fireEvent(document, new Event("visibilitychange"));
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
    fireEvent.focus(window);
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status", { name: "Cargando Por enviar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las órdenes" }));
    fireEvent.focus(window);
    await act(async () => {
        resolve(summary);
        await Promise.resolve();
    });
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    await screen.findByLabelText("Valor: Por enviar, 6");
    expect(getHomeSummary).toHaveBeenCalledTimes(3);
});

it("invalidates pending results on disable and role revocation", async () => {
    let resolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const { rerender } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    rerender(<FormalizationHomePage roles={[]} effectivePermissions={[stagePermission]} />);
    await act(async () => {
        resolve(summary);
        await Promise.resolve();
    });
    expect(screen.queryByLabelText("Valor: Por enviar, 6")).toBeNull();
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} initialView="orders" />);
    fireEvent.focus(window);
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
});

it("marks every rejected source metric unverified and retries the common aggregate once", async () => {
    vi.mocked(getHomeSummary).mockRejectedValueOnce(new Error("source unavailable"));
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    expect(await screen.findAllByRole("alert")).toHaveLength(6);
    for (const label of labels) {
        expect(screen.getByLabelText(`${label}: sin verificar`).textContent).toBe("0");
        expect(screen.queryByLabelText(`Valor: ${label}, 0`)).toBeNull();
    }
    expect(screen.queryByText("Contratos no disponibles")).toBeNull();
    let resolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar Gestión bancaria" }));
    for (const label of labels) expect(screen.getByRole("status", { name: `Cargando ${label}` })).toBeTruthy();
    fireEvent.focus(window);
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
    await act(async () => {
        resolve(summary);
        await Promise.resolve();
    });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.getAllByLabelText(/^Valor:/).map((node) => node.textContent)).toEqual(["6", "3", "4", "5", "6", "7", "8"]);
});

it.each(["session", "user"])("discards a pending result when the authenticated %s changes", async (context) => {
    const profile: IdentityProfile = {
        auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
        user: { publicId: "user", displayName: "Test", email: "test@example.test", status: "active", permissionVersion: 1, profileImageUrl: null },
        session: { publicId: "session-a", status: "active", permissionVersion: 1, expiresAt: "2026-10-24T00:00:00Z", expiresInSeconds: 3600 },
        roles: [role],
        orgUnits: [{ publicId: "formalization", code: "formalizacion", name: "Formalización", membership: "member", scope: "self", status: "active" }],
        permissions: [{ ...stagePermission, scope: "self", source: "role" }],
    };
    const props: AppRouteContentProps = { authState: { status: "authenticated", profile }, authRetryFeedback: null, isAuthRetryDisabled: false, isMicrosoftSessionPending: false, isSubmittingLogin: false, loginError: null, onLocalLogin: vi.fn(), onLogout: vi.fn(), onMicrosoftLogin: vi.fn(), onNavigate: vi.fn(), onRetryAuthCheck: vi.fn(), path: "/home/formalization" };
    let resolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const { rerender } = render(<AppRouteContent {...props} />);
    await screen.findByRole("status", { name: "Cargando Por enviar" });
    rerender(<AppRouteContent {...props} authState={{ status: "authenticated", profile: { ...profile, user: { ...profile.user, publicId: context === "user" ? "user-b" : "user" }, session: { ...profile.session, publicId: context === "session" ? "session-b" : "session-a" } } }} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    await act(async () => {
        resolve({ ...summary, counts: { ...counts, contracts: { toSend: 999, pendingSignature: 999 } } });
        await Promise.resolve();
    });
    expect(screen.queryByLabelText("Valor: Por enviar, 999")).toBeNull();
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
});

it("does not let a disabled request overwrite a new Home read or release its flight", async () => {
    let oldResolve!: (value: typeof summary) => void;
    let newResolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary)
        .mockReturnValueOnce(
            new Promise((done) => {
                oldResolve = done;
            }),
        )
        .mockReturnValueOnce(
            new Promise((done) => {
                newResolve = done;
            }),
        );
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las órdenes" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    await act(async () => {
        oldResolve(summary);
        await Promise.resolve();
    });
    expect(screen.getByRole("status", { name: "Cargando Por enviar" })).toBeTruthy();
    fireEvent.focus(window);
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
    await act(async () => {
        newResolve(summary);
        await Promise.resolve();
    });
    await screen.findByLabelText("Valor: Por enviar, 6");
});
