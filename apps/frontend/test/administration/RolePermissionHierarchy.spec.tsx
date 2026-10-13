import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { RolePermissionHierarchy } from "../../src/modules/administration/pages/RolePermissionHierarchy";

afterEach(cleanup);
const modules = [
    { code: "user", name: "Usuarios", views: [{ code: "user", name: "Usuarios", permissions: [{ code: "user.view_list", name: "Ver usuarios", description: "" }] }] },
    { code: "role", name: "Roles y seguridad", views: [{ code: "role", name: "Roles", permissions: [{ code: "role.assign", name: "Asignar roles", description: "" }] }] },
    {
        code: "administration",
        name: "Administracion",
        views: [
            {
                code: "catalog_project",
                name: "Proyectos",
                permissions: [
                    { code: "administration.catalog_project.read", name: "Ver proyectos", description: "" },
                    { code: "administration.catalog_project.create", name: "Crear proyecto", description: "" },
                ],
            },
        ],
    },
];
it("groups administration sections and catalogs without inventing delete permissions; protects Owner", () => {
    render(<RolePermissionHierarchy modules={modules} granted={{}} locked busy={false} onToggle={vi.fn()} onSetSection={vi.fn()} />);
    const administration = screen.getByRole("group", { name: "Administración" });
    for (const name of ["Usuarios", "Roles y seguridad", "Auditoría", "Catálogos"]) expect(within(administration).getByRole("group", { name })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Todos los permisos de Usuarios" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Ver proyectos" })).toBeChecked();
    expect(screen.queryByText("Eliminar")).not.toBeInTheDocument();
    expect(screen.getByText("Comparte el permiso de Roles y seguridad")).toBeInTheDocument();
});
it("sets only the selected section's real API codes and preserves mixed state", () => {
    const onSetSection = vi.fn();
    const onToggle = vi.fn();
    render(<RolePermissionHierarchy modules={modules} granted={{ administration: ["administration.catalog_project.read"] }} locked={false} busy={false} onToggle={onToggle} onSetSection={onSetSection} />);
    const master = screen.getByRole("checkbox", { name: "Todos los permisos de Catálogos" });
    expect(master).toBePartiallyChecked();
    fireEvent.click(master);
    expect(onSetSection).toHaveBeenCalledWith(
        [
            { moduleCode: "administration", code: "administration.catalog_project.read" },
            { moduleCode: "administration", code: "administration.catalog_project.create" },
        ],
        true,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Crear proyecto" }));
    expect(onToggle).toHaveBeenCalledWith("administration.catalog_project.create", "administration");
});
it("does not report view access from a create permission alone", () => {
    render(<RolePermissionHierarchy modules={modules} granted={{ administration: ["administration.catalog_project.create"] }} locked={false} busy={false} onToggle={vi.fn()} onSetSection={vi.fn()} />);
    expect(within(screen.getByRole("group", { name: "Catálogos" })).getByText("Sin acceso")).toBeInTheDocument();
});
