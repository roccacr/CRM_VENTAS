import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateSystemUserDrawer } from "../../src/modules/administration/components/CreateSystemUserDrawer";
import { buildCreateUserPayload, buildUpdateUserPayload, createInitialUserFormValues } from "../../src/modules/administration/create-system-user.model";
import { installBrowserApiDoubles } from "../support/browser";

beforeEach(() => {
    installBrowserApiDoubles();
    vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("create-only assigned password", () => {
    const values = { ...createInitialUserFormValues(), password: "Initial secret 123" };
    it("includes a password only for authorized local creation and never for updates", () => {
        expect(buildCreateUserPayload(values, [], true)).toHaveProperty("password", values.password);
        expect(buildCreateUserPayload(values, [])).not.toHaveProperty("password");
        expect(buildCreateUserPayload({ ...values, accessMethods: ["microsoft"] }, [], true)).not.toHaveProperty("password");
        expect(buildUpdateUserPayload(values, [])).not.toHaveProperty("password");
    });
    const props = { open: true, error: null, isSaving: false, moduleOptions: [], roleOptions: [{ code: "owner", name: "Owner", locked: true, users: 0 }], rolePermissions: {}, onClose: vi.fn(), onSubmit: vi.fn() };
    it("rejects whitespace-only passwords without trimming valid surrounding spaces", async () => {
        render(<CreateSystemUserDrawer {...props} canAssignPassword />);
        const input = await screen.findByLabelText("Contraseña inicial");
        fireEvent.change(input, { target: { value: "            " } });
        expect(await screen.findByText("La contraseña no puede contener solo espacios.")).toBeInTheDocument();
        const password = " Valid secret 123 ";
        fireEvent.change(input, { target: { value: password } });
        await waitFor(() => expect(screen.queryByText("La contraseña no puede contener solo espacios.")).not.toBeInTheDocument());
        expect(buildCreateUserPayload({ ...values, password }, [], true).password).toBe(password);
    });
    it("hides passwords without assignment permission and in edit mode", () => {
        const view = render(<CreateSystemUserDrawer {...props} canAssignPassword={false} />);
        expect(screen.queryByLabelText("Contraseña inicial")).not.toBeInTheDocument();
        view.rerender(<CreateSystemUserDrawer {...props} canAssignPassword mode="edit" />);
        expect(screen.queryByLabelText("Contraseña inicial")).not.toBeInTheDocument();
    });
    it("discards the secret when local access, privilege or the open drawer is removed", async () => {
        const view = render(<CreateSystemUserDrawer {...props} canAssignPassword />);
        fireEvent.change(await screen.findByLabelText("Contraseña inicial"), { target: { value: values.password } });
        fireEvent.click(screen.getByRole("checkbox", { name: "Contraseña local" }));
        await waitFor(() => expect(screen.queryByLabelText("Contraseña inicial")).not.toBeInTheDocument());
        fireEvent.click(screen.getByRole("checkbox", { name: "Contraseña local" }));
        expect(await screen.findByLabelText("Contraseña inicial")).toHaveValue("");
        fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: values.password } });
        view.rerender(<CreateSystemUserDrawer {...props} canAssignPassword={false} />);
        view.rerender(<CreateSystemUserDrawer {...props} canAssignPassword />);
        expect(await screen.findByLabelText("Contraseña inicial")).toHaveValue("");
        fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: values.password } });
        view.rerender(<CreateSystemUserDrawer {...props} canAssignPassword open={false} />);
        view.rerender(<CreateSystemUserDrawer {...props} canAssignPassword />);
        expect(await screen.findByLabelText("Contraseña inicial")).toHaveValue("");
    });
});
