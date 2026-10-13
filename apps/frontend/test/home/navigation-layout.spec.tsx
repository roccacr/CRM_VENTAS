import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { GlobalHomeShell } from "../../src/modules/home/GlobalHomeShell";
import { installBrowserApiDoubles } from "../support/browser";
const navigationStyles = readFileSync(resolve(process.cwd(), "src/modules/home/GlobalHomeShell.css"), "utf8");

it("preserves the standard navigation styling for a Home-only Formalization profile", () => {
    installBrowserApiDoubles();
    render(
        <GlobalHomeShell initialWorkspaceCode="formalization" activeMenuItemCode="formalization-home" effectivePermissions={[{ code: "formalizacion.home.read", effect: "allow" }]} orgUnits={[{ code: "formalizacion", status: "active" }]}>
            Content
        </GlobalHomeShell>,
    );
    expect(screen.getByRole("navigation", { name: "Navegación principal" }).className).toBe("global-home-menu");
    expect(screen.getByRole("button", { name: "Inicio" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: "Contratos" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expedientes" })).toBeNull();
    expect(navigationStyles).not.toContain(".global-home-menu--single");
});

it("keeps dropdowns outside the tablet navigation clipping area", () => {
    const panel = navigationStyles.slice(navigationStyles.indexOf(".global-home-menu__dropdown {"));
    expect(panel.slice(0, panel.indexOf("}"))).toContain("position: fixed");
    const tablet = navigationStyles.slice(navigationStyles.indexOf("@media (max-width: 1024px)"), navigationStyles.indexOf("@media (max-width: 560px)"));
    expect(tablet).not.toContain("mask-image: linear-gradient");
});

it("keeps the tablet header in the desktop single row and height", () => {
    const tablet = navigationStyles.slice(navigationStyles.indexOf("@media (max-width: 1024px)"), navigationStyles.indexOf("@media (max-width: 560px)"));
    expect(tablet).not.toContain("--global-home-header-height:");
    expect(tablet).not.toContain("grid-row: 2");
    expect(tablet).toContain("grid-template-columns: max-content minmax(0, 1fr) max-content");
});

it("applies the enterprise palette only to navigation surfaces", () => {
    const tokenStart = navigationStyles.indexOf("/* Explicit navigation adoption");
    expect(tokenStart).toBeGreaterThan(0);
    const rule = navigationStyles.slice(tokenStart, navigationStyles.indexOf("}", tokenStart) + 1);
    for (const selector of [".global-home-header", ".global-home-menu", ".global-home-mobile-bar", ".global-home-mobile-drawer-shell"]) expect(rule).toContain(selector);
    expect(rule).not.toContain(".global-home-shell {");
    expect(rule).toContain("--shell-focus: #496180");
    expect(rule).toContain("--shell-hover: #ebeef3");
    expect(rule).toContain("--shell-border: #d2dae5");
});

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
    expect(menu.style.left).toBe(`${String(Math.max(16, Math.min(left, window.innerWidth - 16 - 314)))}px`);
    expect(menu.style.top).toBe("134px");
    fireEvent(window, new Event("resize"));
    expect(menu.style.maxHeight).toBe(`${String(window.innerHeight - 134 - 16)}px`);
    menu.style.left = "0px";
    fireEvent.scroll(screen.getByRole("navigation", { name: "Navegación principal" }));
    expect(menu.style.left).not.toBe("0px");
});
