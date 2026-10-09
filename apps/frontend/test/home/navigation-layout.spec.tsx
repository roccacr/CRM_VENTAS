import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { GlobalHomeShell } from "../../src/modules/home/GlobalHomeShell";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

it.each([38, 850])("keeps a dropdown inside the viewport from trigger x=%s and repositions on resize", (left) => {
    installBrowserApiDoubles();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        return { x: left, y: 80, left, top: 80, right: left + 170, bottom: 128, width: this.classList.contains("global-home-menu__dropdown") ? 314 : 170, height: 48, toJSON: () => ({}) };
    });
    render(<GlobalHomeShell initialWorkspaceCode="all">Content</GlobalHomeShell>);
    fireEvent.click(screen.getByRole("button", { name: /^Administración$/ }));
    const menu = screen.getByRole("menu", { name: "Opciones de Administración" });
    expect(menu.style.left).toBe(`${String(Math.min(0, window.innerWidth - 16 - left - 314))}px`);
    fireEvent(window, new Event("resize"));
    expect(menu.style.maxHeight).toBe(`${String(window.innerHeight - 134 - 16)}px`);
});
