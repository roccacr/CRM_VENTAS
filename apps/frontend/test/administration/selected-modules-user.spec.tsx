import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CreateSystemUserDrawer } from "../../src/modules/administration/components/CreateSystemUserDrawer";
import type { SystemUserListItem } from "../../src/modules/administration/system-users.model";
import { installBrowserApiDoubles } from "../support/browser";

beforeEach(() => {
    installBrowserApiDoubles();
});
afterEach(cleanup);
const role = { code: "jefe_general", name: "Jefe General", locked: true, users: 0, moduleCodes: ["ventas", "mercadeo"], permissionInheritance: "selected_modules" as const };
const moduleOptions = ["ventas", "mercadeo", "formalizacion", "administration"].map((code) => ({ code, name: code, views: [{ code: "home", name: "Inicio", permissions: [{ code: `${code}.home.read`, name: "Leer", sensitive: false }] }] }));

it("creates a general chief with only explicitly selected modules and direct role codes", async () => {
    const onSubmit = vi.fn();
    render(<CreateSystemUserDrawer open error={null} isSaving={false} roleOptions={[role]} rolePermissions={{ jefe_general: moduleOptions.map((module) => `${module.code}.home.read`) }} moduleOptions={moduleOptions} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Jefe Prueba" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "chief@example.test" } });
    fireEvent.change(screen.getByLabelText("Motivo del alta"), { target: { value: "Alta autorizada" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Roles asignados" }));
    fireEvent.click(await screen.findByText("Jefe General", { selector: ".create-user-drawer__role-option > span" }));
    const modules = await screen.findByRole("combobox", { name: "Módulos asignados" });
    expect(screen.queryByText(/Alcance global|Propietario del sistema/)).toBeNull();
    expect(modules.closest(".ant-select")).not.toHaveTextContent("ventas");
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ roleCodes: ["jefe_general"], orgUnitCodes: [] }));
    });
    onSubmit.mockClear();
    fireEvent.mouseDown(modules);
    expect(screen.queryByText("administration", { selector: ".ant-select-item-option-content" })).toBeNull();
    fireEvent.click(await screen.findByText("mercadeo", { selector: ".ant-select-item-option-content" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ roleCode: "jefe_general", roleCodes: ["jefe_general"], orgUnitCodes: ["mercadeo"] }));
    });
});

it.each([{ orgUnitCodes: [] }, { orgUnitCodes: ["mercadeo"] }, { orgUnitCodes: ["mercadeo", "formalizacion"] }, { orgUnitCodes: ["mercadeo", "administration"] }])("preserves selected modules during edit, including an empty or stale scope: %j", async ({ orgUnitCodes }) => {
    const initialUser: SystemUserListItem = { publicId: "chief", name: "Jefe real", email: "chief@example.test", externalReferences: [], invitedBy: null, lastActivityIso: null, lastActivityLabel: "Sin actividad", mfaStatus: "unknown", orgUnit: "Sin área", orgUnitCodes, profileImageUrl: null, provider: "local", roleChangedAtLabel: "Sin cambios", roleCodes: [role.code], roles: [role.name], status: "active" };
    const onSubmit = vi.fn();
    render(<CreateSystemUserDrawer open mode="edit" canAssignRoles initialUser={initialUser} error={null} isSaving={false} roleOptions={[role]} rolePermissions={{ jefe_general: moduleOptions.map((module) => `${module.code}.home.read`) }} moduleOptions={moduleOptions} onClose={vi.fn()} onSubmit={onSubmit} />);
    await screen.findByRole("combobox", { name: "Módulos asignados" });
    fireEvent.change(screen.getByLabelText("Motivo de la edición"), { target: { value: "Edición autorizada" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ orgUnitCodes, roleCodes: ["jefe_general"] }));
    });
});
