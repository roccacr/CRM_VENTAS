import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { PROJECTS_NEUTRAL, PROJECTS_THEME } from "../../src/modules/administration/catalogs/projects-theme";

const stylesheet = readFileSync(resolve(process.cwd(), "src/modules/administration/catalogs/ProjectsView.css"), "utf8");

function luminance(hex: string): number {
    const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255).map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return channels.reduce((sum, channel, index) => sum + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0), 0);
}

describe("projects palette contrast", () => {
    it("stacks mobile metadata and anchors actions beside status without widening the title", () => {
        const mobile = stylesheet.slice(stylesheet.indexOf("@media (max-width: 767px) {") + "@media (max-width: 767px) {".length, stylesheet.indexOf("/* Keep the input and its tools"));
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = mobile.slice(0, mobile.lastIndexOf("}"));
        document.head.append(style);
        document.body.innerHTML = '<div class="catalog-items-page--projects"><table><tbody><tr class="catalog-items-row"><td>Long project title</td><td>Description</td><td>Integrations</td><td>Status</td><td>Actions</td></tr></tbody></table></div>';
        const row = document.querySelector("tr") as Element;
        const cells = row.querySelectorAll("td");
        expect(getComputedStyle(row).gridTemplateColumns).toBe("minmax(0, 1fr) auto auto");
        expect(getComputedStyle(cells[1] as Element).gridTemplateColumns).toBe("minmax(0, 1fr)");
        expect(getComputedStyle(cells[4] as Element).gridRow).toBe("1");
        expect(getComputedStyle(cells[4] as Element).gridColumn).toBe("3");
    });
    it("groups project filters into three contiguous tracks", () => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        document.body.innerHTML = '<div class="catalog-items-page--projects"><div class="administration-users-datatable-wrap"><div class="dtsp-panesContainer"><div class="dtsp-searchPanes"><div class="dtsp-searchPane"></div><div class="dtsp-searchPane"></div><div class="dtsp-searchPane"></div></div></div></div></div>';
        const panes = document.querySelector(".dtsp-searchPanes");
        expect(panes).not.toBeNull();
        expect(getComputedStyle(panes as Element).gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
        document.querySelectorAll(".dtsp-searchPane").forEach((pane) => {
            expect(getComputedStyle(pane).gridColumn).toBe("auto");
            expect(getComputedStyle(pane).minWidth).toBe("0px");
        });
    });
    it("keeps filter tools inline and uses a compact body scale", () => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        document.body.innerHTML = '<div class="catalog-items-page--projects"><div class="administration-users-datatable-wrap"><div class="dtsp-panesContainer"><div class="dtsp-searchPane"><div class="dtsp-topRow"></div></div></div></div></div>';
        const root = document.querySelector(".catalog-items-page--projects");
        const row = document.querySelector(".dtsp-topRow");
        expect(root).not.toBeNull();
        expect(row).not.toBeNull();
        expect(getComputedStyle(root as Element).fontSize).toBe("13px");
        expect(getComputedStyle(row as Element).display).toBe("flex");
        expect(getComputedStyle(row as Element).flexWrap).toBe("nowrap");
    });
    it.each(["catalog-items-page--projects", "catalog-item-detail-drawer--projects", "catalog-items-modal--projects"])("uses the supplied Bunker palette in %s", (className) => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        const root = document.createElement("div");
        root.className = className;
        document.body.append(root);
        const tokens = getComputedStyle(root);
        const expected = {
            "--color-primary": "#0e1116",
            "--color-primary-dark": "#2f3a4b",
            "--color-neutral-50": "#f5f7fa",
            "--color-neutral-100": "#ebeef3",
            "--color-neutral-200": "#d2dae5",
            "--color-neutral-300": "#abbbce",
            "--color-neutral-400": "#7d96b3",
            "--color-neutral-500": "#5d799a",
            "--color-neutral-600": "#496180",
            "--color-neutral-700": "#3c4f68",
            "--color-neutral-800": "#354357",
            "--color-neutral-900": "#2f3a4b",
            "--color-neutral-950": "#0e1116",
        };
        Object.entries(expected).forEach(([token, color]) => {
            expect(tokens.getPropertyValue(token).trim()).toBe(color);
        });
    });

    afterEach(() => {
        document.head.querySelector("style[data-project-palette]")?.remove();
        document.body.replaceChildren();
    });

    it("keeps the AntD theme scale identical to the stylesheet scale", () => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        const root = document.createElement("div");
        root.className = "catalog-items-modal--projects";
        document.body.append(root);
        const tokens = getComputedStyle(root);
        Object.entries(PROJECTS_NEUTRAL).forEach(([shade, color]) => {
            expect(tokens.getPropertyValue(`--color-neutral-${shade}`).trim()).toBe(color);
        });
        expect(PROJECTS_THEME.token).toMatchObject({ colorPrimary: PROJECTS_NEUTRAL[950], colorText: PROJECTS_NEUTRAL[700], colorTextPlaceholder: PROJECTS_NEUTRAL[600], colorBorder: PROJECTS_NEUTRAL[500] });
    });

    it("applies the documented text hierarchy to the grid", () => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        document.body.innerHTML =
            '<div class="catalog-items-page--projects"><div class="administration-users-datatable-wrap"><table class="dataTable administration-users-datatable"><thead><tr><th>Proyecto</th></tr></thead><tbody><tr class="catalog-items-row"><td><div class="catalog-items-name"><strong>Nombre</strong></div></td></tr></tbody></table></div></div>';
        expect(getComputedStyle(document.querySelector("th") as Element).color).toBe("var(--color-neutral-700)");
        expect(getComputedStyle(document.querySelector("td") as Element).color).toBe("var(--color-neutral-700)");
        expect(getComputedStyle(document.querySelector("strong") as Element).color).toBe("var(--color-neutral-900)");
    });

    it("places search, the three filters and filter controls in one toolbar row", () => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        document.body.innerHTML =
            '<div class="catalog-items-page--projects"><div class="administration-users-datatable-wrap"><div class="dt-container"><div class="dt-layout-row projects-view-toolbar"><div class="dt-layout-cell dt-layout-full"><div class="dt-search"></div><div class="dtsp-panesContainer"><div class="dtsp-titleRow"></div><div class="dtsp-searchPanes"><div class="dtsp-searchPane"></div><div class="dtsp-searchPane"></div><div class="dtsp-searchPane"></div></div></div></div></div></div></div></div>';
        expect(getComputedStyle(document.querySelector(".dt-layout-cell") as Element).gridTemplateColumns).toBe("minmax(220px, 1.4fr) repeat(3, minmax(0, 1fr)) auto");
        expect(getComputedStyle(document.querySelector(".dtsp-panesContainer") as Element).display).toBe("contents");
        expect(getComputedStyle(document.querySelector(".dtsp-searchPanes") as Element).display).toBe("contents");
        expect(getComputedStyle(document.querySelector(".dt-search") as Element).gridColumn).toBe("1");
        expect(getComputedStyle(document.querySelector(".dtsp-titleRow") as Element).gridColumn).toBe("5");
        document.querySelectorAll(".dtsp-searchPane").forEach((pane) => {
            expect(getComputedStyle(pane).gridRow).toBe("1");
        });
    });

    it("hides idle filter controls and pane icons instead of showing them disabled", () => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        document.body.innerHTML =
            '<div class="catalog-items-page--projects"><div class="administration-users-datatable-wrap"><div class="dtsp-panesContainer"><div class="dtsp-titleRow"><div class="dtsp-title"></div><button class="dtsp-clearAll" disabled>Limpiar</button><button class="dtsp-showAll">Expandir</button><button class="dtsp-collapseAll" disabled>Contraer</button></div><div class="dtsp-searchPane"><button class="dtsp-searchIcon"></button><button class="clearButton" disabled></button></div></div></div></div>';
        [".dtsp-title", ".dtsp-clearAll", ".dtsp-collapseAll", ".dtsp-searchIcon", ".clearButton"].forEach((selector) => {
            expect(getComputedStyle(document.querySelector(selector) as Element).display).toBe("none");
        });
        expect(getComputedStyle(document.querySelector(".dtsp-showAll") as Element).display).not.toBe("none");
    });

    it("scopes the row action menu portal to the Projects palette", () => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        const root = document.createElement("div");
        root.className = "catalog-items-dropdown--projects";
        document.body.append(root);
        expect(getComputedStyle(root).getPropertyValue("--color-hover").trim()).toBe(PROJECTS_NEUTRAL[100]);
    });

    it.each([
        ["--color-primary", "--color-surface", 4.5],
        ["--color-primary-dark", "--color-surface", 4.5],
        ["--color-neutral-600", "--color-neutral-100", 4.5],
        ["--color-neutral-900", "--color-surface", 4.5],
        ["--color-success", "--color-success-light", 4.5],
        ["--color-warning", "--color-warning-light", 4.5],
        ["--color-control-border", "--color-neutral-50", 3],
        ["--color-secondary", "--color-surface", 3],
    ] as const)("keeps %s on %s above %s:1", (foreground, background, minimum) => {
        const style = document.createElement("style");
        style.dataset.projectPalette = "";
        style.textContent = stylesheet;
        document.head.append(style);
        const root = document.createElement("div");
        root.className = "catalog-items-page--projects";
        document.body.append(root);
        const tokens = getComputedStyle(root);
        const colors = [foreground, background].map((name) => tokens.getPropertyValue(name).trim());
        colors.forEach((color) => {
            expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        });
        const light = colors.map(luminance);
        expect((Math.max(...light) + 0.05) / (Math.min(...light) + 0.05)).toBeGreaterThanOrEqual(minimum);
    });
});
