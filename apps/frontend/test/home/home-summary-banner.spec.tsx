import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { AppRouteContent, type AppRouteContentProps } from "../../src/routes/AppRouteContent";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";
import { getApprovalCount } from "../../src/services/formalization/approval-summary-service";
import type * as FollowUpService from "../../src/services/formalization/follow-up-service";
import { getHomeSummary } from "../../src/services/formalization/home-summary-service";
import { installBrowserApiDoubles } from "../support/browser";

// Banner tests isolate their source from the independently tested canonical follow-up read.
vi.mock("../../src/services/formalization/follow-up-service", async (importOriginal) => {
    const original = await importOriginal<typeof FollowUpService>();
    return { ...original, getFollowUp: vi.fn().mockResolvedValue({ schemaVersion: 1, observedAt: "2026-10-26T12:00:00Z", filters: { search: "", projectId: "", queue: "all" }, page: { number: 1, size: 25, total: 0, totalPages: 0 }, counts: { all: 0, approvals: 0, contracts: 0, send: 0, signature: 0, bank: 0, balance: 0, transfer: 0, signed: 0, closed: 0 }, projects: [], items: [], sources: { native: { total: 0 }, legacy: { total: 0, enabled: true } } }) };
});
vi.mock("../../src/services/formalization/home-summary-service", () => ({ getHomeSummary: vi.fn() }));
vi.mock("../../src/services/formalization/approval-summary-service", () => ({ getApprovalCount: vi.fn() }));
const role = { code: "formalizacion", name: "Formalización", status: "active" as const };
const stagePermission = { code: "formalizacion.home.stages.read", effect: "allow" as const, scope: "self" as const, source: "role" as const };
const counts = { contracts: { toSend: 6, pendingSignature: 3 }, banking: 4, bankingInProgress: 2, balance: 5, transferPending: 6, transferSigned: 7, closedThisYear: 8 };
const summary = { schemaVersion: 1 as const, observedAt: "2026-10-23T12:00:00.000Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00.000Z", endExclusive: "2027-01-01T06:00:00.000Z" }, counts, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 2 } };
const labels = ["Por enviar", "Pendientes de firma", "Sin iniciar", "En proceso", "Consulta financiera", "Por gestionar", "Firma registrada · Llaves pendientes", "Proceso finalizado"];
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getHomeSummary).mockReset().mockResolvedValue(summary);
    vi.mocked(getApprovalCount).mockReset().mockResolvedValue(2);
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

it("shows keyboard-accessible condition help beside every banner without opening the approvals queue", async () => {
    const approvals = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, approvals]} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    for (const title of ["Pendientes de aprobación", "Contratos pendientes", "Gestión bancaria", "Pendientes de saldo", "Traspasos pendientes", "Traspaso firmado", "Formalizaciones cerradas este año"]) {
        const help = screen.getByRole("button", { name: `Condiciones de ${title}` });
        expect(help.parentElement?.closest("button")).toBeNull();
    }
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Condiciones de Contratos pendientes" }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Aprobación Formalización marcada");
    expect(tooltip.textContent).toContain("Por enviar o Pendiente de firma");
    fireEvent.click(screen.getByRole("button", { name: "Condiciones de Pendientes de aprobación" }));
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
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

it.each([true, false])("uses effective grants regardless of Owner inherited role; formalizacion present=%s", async (hasFormalization) => {
    const owner = { ...role, code: "owner", name: "Owner" };
    render(<FormalizationHomePage roles={hasFormalization ? [owner, role] : [owner]} effectivePermissions={[stagePermission]} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    expect(screen.getByRole("button", { name: "Recargar banners" })).toBeTruthy();
    expect(getHomeSummary).toHaveBeenCalledTimes(1);
});

it("discards the read subtree on direct deny and refreshes remaining approvals", async () => {
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
    expect(getApprovalCount).toHaveBeenCalledTimes(3);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
});

it("refreshes authorized banners and ignores an approval response superseded by a second refresh", async () => {
    const onNavigate = vi.fn();
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission, { code: "formalizacion.home.approvals.read", effect: "allow" }]} onNavigate={onNavigate} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    await screen.findByLabelText("Órdenes pendientes de aprobación: 2");
    let resolveStages!: (value: typeof summary) => void;
    const approvalResponses: ((value: number) => void)[] = [];
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((resolve) => {
            resolveStages = resolve;
        }),
    );
    vi.mocked(getApprovalCount).mockImplementation(() => new Promise((resolve) => approvalResponses.push(resolve)));
    const refresh = screen.getByRole("button", { name: "Recargar banners" });
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    for (const label of labels) expect(screen.getByRole("status", { name: `Cargando ${label}` })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Cargando pendientes de aprobación" })).toBeTruthy();
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
    expect(getApprovalCount).toHaveBeenCalledTimes(3);
    await act(async () => {
        resolveStages({ ...summary, counts: { ...counts, contracts: { toSend: 5, pendingSignature: 4 } } });
        approvalResponses[1]?.(1);
        await Promise.resolve();
    });
    await screen.findByLabelText("Valor: Por enviar, 5");
    expect(screen.getByLabelText("Órdenes pendientes de aprobación: 1")).toBeTruthy();
    await act(async () => {
        approvalResponses[0]?.(9);
        await Promise.resolve();
    });
    expect(screen.queryByLabelText("Órdenes pendientes de aprobación: 9")).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
});

it.each(["stages", "approvals"])("refreshes only the authorized %s source", async (source) => {
    render(<FormalizationHomePage roles={[role]} effectivePermissions={source === "approvals" ? [{ code: "formalizacion.home.approvals.read", effect: "allow" }] : [stagePermission]} />);
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

it.each([undefined, [], [{ ...role, code: "owner" }], [{ ...role, status: "inactive" as const }]])("requires a grant before querying regardless of roles %j", (roles) => {
    render(<FormalizationHomePage roles={roles} effectivePermissions={[]} />);
    expect(screen.queryByRole("heading", { name: "Gestión bancaria" })).toBeNull();
    expect(getHomeSummary).not.toHaveBeenCalled();
});

it("shares one StrictMode request and preloads all eight numbers", async () => {
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
    expect(screen.getAllByLabelText(/^Valor:/).map((node) => node.textContent)).toEqual(["6", "3", "4", "2", "5", "6", "7", "8"]);
});

it("refreshes on visible focus, deduplicates, clears in queues and refetches on Home return", async () => {
    const { rerender } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
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
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} initialView="orders" />);
    fireEvent.focus(window);
    await act(async () => {
        resolve(summary);
        await Promise.resolve();
    });
    expect(getHomeSummary).toHaveBeenCalledTimes(2);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    await screen.findByLabelText("Valor: Por enviar, 6");
    expect(getHomeSummary).toHaveBeenCalledTimes(3);
});

it("invalidates pending results on disable and effective permission revocation", async () => {
    let resolve!: (value: typeof summary) => void;
    vi.mocked(getHomeSummary).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const { rerender } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    rerender(<FormalizationHomePage roles={[]} effectivePermissions={[]} />);
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
        expect(screen.getByLabelText(`${label}: sin verificar`).textContent).toBe("—");
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
    expect(screen.getAllByLabelText(/^Valor:/).map((node) => node.textContent)).toEqual(["6", "3", "4", "2", "5", "6", "7", "8"]);
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
    const { rerender } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} initialView="orders" />);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[stagePermission]} />);
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
