import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { GlobalHomeShell } from "../../src/modules/home/GlobalHomeShell";
import { installBrowserApiDoubles } from "../support/browser";

beforeEach(installBrowserApiDoubles);
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

async function openMenu(props: Partial<ComponentProps<typeof GlobalHomeShell>> = {}) {
    const user = userEvent.setup();
    const view = render(
        <StrictMode>
            <GlobalHomeShell {...props}>
                <button type="button">Contenido</button>
            </GlobalHomeShell>
        </StrictMode>,
    );
    const trigger = screen.getByRole("button", { name: "Abrir menú de navegación" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Menú móvil de navegación" });
    return { user, view, trigger, dialog };
}

it("moves focus inside, wraps Tab and Shift+Tab, and restores focus on Escape", async () => {
    const { user, trigger, dialog } = await openMenu();
    const close = within(dialog).getByRole("button", { name: "Cerrar menú" });
    const logout = within(dialog).getByRole("button", { name: "Cerrar sesión" });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(logout).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("searchbox")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger.closest("[inert]")).toBeNull();
});

it("makes the background inert, contains escaped focus and cleans up on unmount", async () => {
    const { dialog, view } = await openMenu();
    const content = screen.getByRole("button", { name: "Contenido" });
    expect(content.closest("[inert]")).not.toBeNull();
    expect(dialog.closest("[inert]")).toBeNull();
    content.focus();
    expect(within(dialog).getByRole("button", { name: "Cerrar menú" })).toHaveFocus();
    view.unmount();
    expect(document.querySelector("[inert]")).toBeNull();
});

it.each(["Cerrar menú", "Cerrar menú de navegación"])("restores focus after %s and supports reopening", async (name) => {
    const { user, trigger } = await openMenu();
    await user.click(screen.getByRole("button", { name }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar menú" })).toHaveFocus();
});

it("keeps focus when expanding a workspace and closes on keyboard navigation", async () => {
    const onMenuItemSelect = vi.fn();
    const onWorkspaceChange = vi.fn();
    const { user, trigger, dialog } = await openMenu({ onMenuItemSelect, onWorkspaceChange });
    const workspace = within(dialog).getByRole("button", { name: "Administración", expanded: false });
    workspace.focus();
    await user.keyboard("{Enter}");
    expect(workspace).toHaveFocus();
    expect(workspace).toHaveAttribute("aria-expanded", "true");
    expect(onWorkspaceChange).toHaveBeenCalledWith("administration");
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Usuarios" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onMenuItemSelect).toHaveBeenCalledWith("/home/administration/users");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
});

it("preserves the logout action from the keyboard", async () => {
    const onLogout = vi.fn();
    const { user, dialog } = await openMenu({ onLogout });
    within(dialog).getByRole("button", { name: "Cerrar sesión" }).focus();
    await user.keyboard("{Enter}");
    expect(onLogout).toHaveBeenCalledOnce();
});

it("preserves pre-existing inert state outside the shell on close", async () => {
    const existing = document.createElement("section");
    existing.setAttribute("inert", "inert");
    document.body.append(existing);
    try {
        const { user } = await openMenu();
        expect(existing).toHaveAttribute("inert", "");
        await user.keyboard("{Escape}");
        expect(existing).toHaveAttribute("inert", "inert");
    } finally {
        existing.remove();
    }
});

it("closes on crossing to desktop, releases the background and removes the media listener", async () => {
    const desktop = Object.assign(new EventTarget(), { matches: false, media: "(min-width: 768px)" });
    const originalMatchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query) => (query === desktop.media ? (desktop as MediaQueryList) : originalMatchMedia(query)));
    const removeListener = vi.spyOn(desktop, "removeEventListener");
    const { user, view, dialog } = await openMenu();

    fireEvent.resize(window);
    act(() => {
        desktop.dispatchEvent(new Event("change"));
    });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cerrar menú" })).toHaveFocus();

    act(() => {
        desktop.matches = true;
        desktop.dispatchEvent(new Event("change"));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("[inert]")).toBeNull();
    const content = screen.getByRole("button", { name: "Contenido" });
    content.focus();
    expect(content).toHaveFocus();

    act(() => {
        desktop.matches = false;
        desktop.dispatchEvent(new Event("change"));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir menú de navegación" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cerrar menú" })).toHaveFocus();
    removeListener.mockClear();
    view.unmount();
    expect(removeListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(document.querySelector("[inert]")).toBeNull();
});
