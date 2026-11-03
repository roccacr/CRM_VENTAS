import "@testing-library/jest-dom/vitest";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationClientDrawer } from "../../src/modules/home/FormalizationClientDrawer";
import { FormalizationOrderDrawer } from "../../src/modules/home/FormalizationOrderDrawer";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { getOrderClientDetail, type OrderClientDetail } from "../../src/services/formalization/order-client-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/order-client-service", () => ({ getOrderClientDetail: vi.fn() }));
const permissions = [{ code: "formalizacion.orders.whatsapp", effect: "allow" }];
const item: FollowUpItem = { id: "legacy:78", source: "legacy", number: "LV208", nativeCode: null, client: "Cliente", clientEmail: "contrato@example.com", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
const detail: OrderClientDetail = { phone: "84398049", countryCode: null, name: "Cliente canónico", warnings: [], groups: [{ title: "Contacto", fields: [{ label: "Teléfono", value: "Número mostrado no interpretado" }] }] };
const views = ["order", "client"] as const;
type View = (typeof views)[number];
function surface(view: View, order = item, effectivePermissions = permissions) {
    return view === "order" ? <FormalizationOrderDrawer item={order} position={1} total={2} onClose={vi.fn()} onSelectPrevious={vi.fn()} onSelectNext={vi.fn()} stagePermissions={effectivePermissions} /> : <FormalizationClientDrawer item={order} open onClose={vi.fn()} effectivePermissions={effectivePermissions} />;
}
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getOrderClientDetail).mockResolvedValue(detail);
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});

it.each(views.flatMap((view) => (["native", "legacy"] as const).map((source) => ({ view, source }))))("offers canonical WhatsApp Web for $source in the $view drawer with its independent permission", async ({ view, source }) => {
    render(surface(view, { ...item, source, id: source === "legacy" ? "legacy:78" : "01ARZ3NDEKTSV4RRFFQ69G5FAV" }));
    const link = await screen.findByRole("link", { name: "Ir a WhatsApp" });
    expect(link).toHaveAttribute("href", "https://web.whatsapp.com/send?phone=50684398049");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(new URL(link.getAttribute("href") ?? "").searchParams.has("text")).toBe(false);
    expect(screen.queryByRole("button", { name: "Agendar evento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver perfil del cliente" })).not.toBeInTheDocument();
    if (view === "order") expect(screen.getByRole("link", { name: "Abrir Outlook" })).toBeInTheDocument();
});
it.each(views.flatMap((view) => [[], [...permissions, { code: "formalizacion.orders.whatsapp", effect: "deny" }]].map((effectivePermissions) => ({ view, effectivePermissions }))))("hides WhatsApp without effective permission in the $view drawer", async ({ view, effectivePermissions }) => {
    render(surface(view, item, effectivePermissions));
    await screen.findByText("Número mostrado no interpretado");
    expect(screen.queryByRole("link", { name: "Ir a WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir a WhatsApp" })).not.toBeInTheDocument();
});
it.each(views.flatMap((view) => [null, "84398049 ext123", "84398049 / 88887777"].map((phone) => ({ view, phone }))))("disables WhatsApp rather than guessing an invalid phone in the $view drawer", async ({ view, phone }) => {
    vi.mocked(getOrderClientDetail).mockResolvedValue({ ...detail, phone });
    render(surface(view));
    expect(await screen.findByRole("button", { name: "Ir a WhatsApp" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Ir a WhatsApp" })).not.toBeInTheDocument();
    expect(screen.getByText(/no tiene un teléfono válido para WhatsApp/)).toBeInTheDocument();
});
it.each(views)("keeps the selected order phone despite a late previous response in the %s drawer", async (view) => {
    let resolve: (data: OrderClientDetail) => void = () => {};
    vi.mocked(getOrderClientDetail).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const mounted = render(surface(view));
    vi.mocked(getOrderClientDetail).mockResolvedValueOnce({ ...detail, phone: "+1 (212) 555-0123", countryCode: "US" });
    mounted.rerender(surface(view, { ...item, id: "legacy:79", number: "LV209" }));
    const link = await screen.findByRole("link", { name: "Ir a WhatsApp" });
    await act(async () => {
        resolve(detail);
        await Promise.resolve();
    });
    expect(link).toHaveAttribute("href", "https://web.whatsapp.com/send?phone=12125550123");
    expect(getOrderClientDetail).toHaveBeenLastCalledWith({ source: "legacy", id: "legacy:79" });
});
