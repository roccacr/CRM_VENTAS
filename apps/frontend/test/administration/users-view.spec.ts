import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const projectsStylesheet = readFileSync(resolve(process.cwd(), "src/modules/administration/catalogs/ProjectsView.css"), "utf8");
const usersStylesheet = readFileSync(resolve(process.cwd(), "src/modules/administration/pages/UsersView.css"), "utf8");

const ROOT = "users-view catalog-items-page--projects";
const TABLE_HEAD = "<thead><tr><th>Usuario</th><th>Estado</th><th>Rol</th><th>Acceso</th><th>Última actividad</th><th></th></tr></thead>";
const TABLE_ROW = '<tr data-user-email="a@b.c"><td class="administration-users-col-user">Andrea</td><td class="administration-users-col-status">Activo</td><td class="administration-users-col-role" data-project-field="Rol">Consulta</td><td class="administration-users-col-access">Microsoft</td><td class="administration-users-col-activity">Hoy</td><td class="administration-users-col-actions"></td></tr>';

const injectStyles = (css: string): void => {
    const style = document.createElement("style");
    style.dataset.usersView = "";
    style.textContent = css;
    document.head.append(style);
};

/** jsdom ignores media queries, so the block under test is injected without its wrapper. */
const mediaBlock = (css: string, query: string): string => {
    const start = css.indexOf(query) + query.length;
    let depth = 1;
    let index = start;
    while (depth > 0 && index < css.length) {
        if (css[index] === "{") depth += 1;
        if (css[index] === "}") depth -= 1;
        index += 1;
    }
    return css.slice(start, index - 1);
};

afterEach(() => {
    document.head.querySelectorAll("style[data-users-view]").forEach((style) => {
        style.remove();
    });
    document.body.innerHTML = "";
});

describe("users view presentation", () => {
    it("gives the six Users columns their own tracks over the five-column Projects widths", () => {
        injectStyles(projectsStylesheet + usersStylesheet);
        document.body.innerHTML = `<div class="${ROOT}"><div class="administration-users-datatable-wrap"><table class="dataTable administration-users-datatable">${TABLE_HEAD}<tbody>${TABLE_ROW}</tbody></table></div></div>`;
        const headers = Array.from(document.querySelectorAll("th")).map((header) => getComputedStyle(header).width);

        expect(headers).toEqual(["auto", "120px", "20%", "164px", "140px", "64px"]);
        expect(getComputedStyle(document.querySelector("table") as Element).minWidth).toBe("960px");
    });

    it.each([
        ["active", "var(--color-success-light)", "var(--color-success)"],
        ["pending", "var(--color-warning-light)", "var(--color-warning)"],
        ["blocked", "var(--users-danger-light)", "var(--users-danger)"],
        ["inactive", "var(--color-neutral-100)", "var(--color-neutral-600)"],
    ])("renders the %s status as a Projects pill", (status, background, color) => {
        injectStyles(projectsStylesheet + usersStylesheet);
        document.body.innerHTML = `<div class="${ROOT}"><span class="administration-users-dt-status administration-users-dt-status--${status}"><span></span>Estado</span></div>`;
        const pill = getComputedStyle(document.querySelector(".administration-users-dt-status") as Element);

        expect(pill.background).toBe(background);
        expect(pill.color).toBe(color);
        expect(pill.borderRadius).toBe("var(--radius)");
        expect(pill.fontSize).toBe("12px");
    });

    it("turns each user into a card with name, status and actions on the first line", () => {
        injectStyles(mediaBlock(usersStylesheet, "@media (max-width: 767px) {"));
        document.body.innerHTML = `<div class="${ROOT}"><div class="administration-users-datatable-wrap"><table class="dataTable administration-users-datatable"><tbody>${TABLE_ROW}</tbody></table></div></div>`;
        const row = document.querySelector("tr") as Element;
        const cell = (name: string): CSSStyleDeclaration => getComputedStyle(row.querySelector(`.administration-users-col-${name}`) as Element);

        expect(getComputedStyle(row).gridTemplateColumns).toBe("minmax(0, 1fr) auto auto");
        expect([cell("user").gridColumn, cell("status").gridColumn, cell("actions").gridColumn]).toEqual(["1", "2", "3"]);
        expect(cell("role").gridColumn).toBe("1 / -1");
    });

    it("lets the mobile card fit the viewport and keeps status out of the Projects cell divider", () => {
        const mobile = "@media (max-width: 767px) {";
        injectStyles(mediaBlock(projectsStylesheet, mobile) + usersStylesheet + mediaBlock(usersStylesheet, mobile));
        document.body.innerHTML = `<div class="${ROOT}"><div class="administration-users-datatable-wrap"><table class="dataTable administration-users-datatable"><tbody>${TABLE_ROW}</tbody></table></div></div>`;
        const status = getComputedStyle(document.querySelector(".administration-users-col-status") as Element);

        expect(getComputedStyle(document.querySelector("table") as Element).minWidth).toBe("0px");
        expect([status.borderTopWidth, status.paddingTop]).toEqual(["0px", "0px"]);
    });

    it("keeps refresh and create on one header row on phones", () => {
        injectStyles(mediaBlock(usersStylesheet, "@media (max-width: 720px) {"));
        document.body.innerHTML = `<div class="${ROOT}"><section class="administration-users-page-header"><div class="global-home-page-header__actions"><button class="projects-view-refresh"></button><button class="global-home-page-header__primary"></button></div></section></div>`;

        expect(getComputedStyle(document.querySelector(".global-home-page-header__actions") as Element).flexWrap).toBe("nowrap");
        expect(getComputedStyle(document.querySelector(".global-home-page-header__primary") as Element).width).toBe("auto");
    });

    it("keeps the status dialog without desktop scroll and compacts it on short windows", () => {
        expect(usersStylesheet).toContain("max-height: calc(100dvh - 200px);");
        injectStyles(mediaBlock(usersStylesheet, "@media (min-width: 768px) and (max-height: 820px) {"));
        document.body.innerHTML = '<div class="ant-modal users-view-modal catalog-items-modal--projects"><div class="ant-modal-body"></div></div>';

        expect(getComputedStyle(document.querySelector(".ant-modal-body") as Element).maxHeight).toBe("calc(100dvh - 150px)");
    });
});
