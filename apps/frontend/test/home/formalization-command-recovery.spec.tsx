import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { FormalizationOrderRecord } from "../../src/modules/home/FormalizationOrderPreview";
import type * as FollowUpService from "../../src/services/formalization/follow-up-service";
import { type FollowUpItem, getFollowUp, getFormalizationOrderRecord } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/follow-up-service", async (original) => ({ ...(await original<typeof FollowUpService>()), getFollowUp: vi.fn(), getFormalizationOrderRecord: vi.fn() }));
vi.mock("../../src/modules/home/FormalizationStageEditor", () => ({
    FormalizationStageEditor: ({ allowed, onSaved }: { allowed: boolean; onSaved: () => Promise<void> }) => (
        <button
            disabled={!allowed}
            onClick={() => {
                void onSaved();
            }}
        >
            Committed command
        </button>
    ),
}));
vi.mock("../../src/modules/home/FormalizationRecordSummary", () => ({ FormalizationRecordSummary: () => null }));
vi.mock("../../src/modules/home/useNetsuiteOrderConsole", () => ({ useNetsuiteOrderConsole: () => ({ primary: null, status: "success" }) }));
const item: FollowUpItem = { id: "legacy:208", source: "legacy", number: "OV208", nativeCode: null, client: null, project: null, unit: null, responsible: null, state: { code: "bank_management", label: "Bank", since: null, days: null }, nextStep: "", completedThisYear: false, stateVersion: 1 };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.resetAllMocks();
    window.history.replaceState(null, "", "/home/formalization");
});
afterEach(cleanup);
it("revalidates a committed command using exact record authority without banner access", async () => {
    const update = vi.fn();
    vi.mocked(getFormalizationOrderRecord).mockResolvedValue({ ...item, stateVersion: 2 });
    render(<FormalizationOrderRecord item={item} canUpdateStage onBack={() => undefined} onStageSaved={update} />);
    fireEvent.click(screen.getByRole("button", { name: "Committed command" }));
    await screen.findByText(/Estado guardado y verificado/);
    expect(getFormalizationOrderRecord).toHaveBeenCalledWith("legacy", "208");
    expect(getFollowUp).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ stateVersion: 2 }));
});
it("discards late revalidation for a different source with the same id", async () => {
    let resolve: ((value: FollowUpItem) => void) | undefined;
    vi.mocked(getFormalizationOrderRecord).mockImplementation(
        () =>
            new Promise((done) => {
                resolve = done;
            }),
    );
    const update = vi.fn();
    const view = render(<FormalizationOrderRecord item={item} canUpdateStage onBack={() => undefined} onStageSaved={update} />);
    fireEvent.click(screen.getByRole("button", { name: "Committed command" }));
    view.rerender(<FormalizationOrderRecord item={{ ...item, source: "native" }} canUpdateStage onBack={() => undefined} onStageSaved={update} />);
    await act(async () => {
        resolve?.(item);
        await Promise.resolve();
    });
    expect(update).not.toHaveBeenCalled();
});
it("offers retry and back when initial URL loading fails without banner grants", async () => {
    window.history.replaceState(null, "", "/home/formalization?orderSource=legacy&orderId=208");
    vi.mocked(getFormalizationOrderRecord).mockRejectedValue(new Error("offline"));
    render(<FormalizationHomePage roles={[{ code: "jefe_formalizaciones", name: "Chief", status: "active" }]} effectivePermissions={[{ code: "formalizacion.orders.read", effect: "allow" }]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar carga de orden" }));
    await waitFor(() => {
        expect(getFormalizationOrderRecord).toHaveBeenCalledTimes(2);
    });
    fireEvent.click(await screen.findByRole("button", { name: /Volver a Formalizaci/ }));
    await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Reintentar carga de orden" })).toBeNull();
    });
    expect(window.location.search).toBe("");
    expect(getFollowUp).not.toHaveBeenCalled();
});

it("permits an active chief alone to use independently granted stage commands", async () => {
    window.history.replaceState(null, "", "/home/formalization?orderSource=legacy&orderId=208");
    vi.mocked(getFormalizationOrderRecord).mockResolvedValue(item);
    render(
        <FormalizationHomePage
            roles={[{ code: "jefe_formalizaciones", name: "Chief", status: "active" }]}
            effectivePermissions={[
                { code: "formalizacion.orders.read", effect: "allow" },
                { code: "formalizacion.orders.stage.update", effect: "allow" },
            ]}
        />,
    );
    const command = await screen.findByRole("button", { name: "Committed command" });
    expect(command.hasAttribute("disabled")).toBe(false);
    expect(getFollowUp).not.toHaveBeenCalled();
});
