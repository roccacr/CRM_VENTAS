import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { LoginPage } from "../../src/modules/auth/LoginPage";
import { installBrowserApiDoubles } from "../support/browser";

beforeAll(() => {
    installBrowserApiDoubles();
});

afterEach(() => {
    cleanup();
});

describe("LoginPage", () => {
    it("no expone version publica en la pantalla de acceso", () => {
        render(<LoginPage />);

        expect(screen.queryByText(/^v\d+\.\d+\.\d+$/u)).not.toBeInTheDocument();
    });

    it("mantiene atributos nativos para teclado movil y autofill sin controles locales no funcionales", () => {
        render(<LoginPage />);

        const email = screen.getByLabelText("Correo administrativo", { selector: "input" });
        const password = screen.getByLabelText("Contraseña", { selector: "input" });

        expect(email).toHaveAttribute("type", "email");
        expect(email).toHaveAttribute("inputmode", "email");
        expect(email).toHaveAttribute("autocomplete", "username");
        expect(email).toHaveAttribute("autocapitalize", "off");
        expect(password).toHaveAttribute("autocomplete", "current-password");
        expect(screen.queryByRole("checkbox", { name: "Recordarme" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "¿Olvidaste tu contraseña?" })).not.toBeInTheDocument();
    });

    it("muestra errores alineados al flujo cuando se envia vacio", async () => {
        const user = userEvent.setup();
        render(<LoginPage />);

        await user.click(screen.getByRole("button", { name: "Ingresar" }));

        const email = screen.getByLabelText("Correo administrativo", { selector: "input" });
        const password = screen.getByLabelText("Contraseña", { selector: "input" });

        expect(screen.getByText("Ingresa tu correo.")).toBeInTheDocument();
        expect(screen.getByText("Ingresa tu contraseña.")).toBeInTheDocument();
        expect(email).toHaveAttribute("aria-invalid", "true");
        expect(password).toHaveAttribute("aria-invalid", "true");
        expect(email).toHaveAccessibleDescription("Ingresa tu correo.");
        expect(password).toHaveAccessibleDescription("Ingresa tu contraseña.");
    });

    it("muestra error al perder foco y lo limpia mientras el usuario corrige", async () => {
        const user = userEvent.setup();
        render(<LoginPage />);

        const email = screen.getByLabelText("Correo administrativo", { selector: "input" });
        const password = screen.getByLabelText("Contraseña", { selector: "input" });

        await user.type(email, "correo-invalido");
        await user.click(password);

        expect(screen.getByText("El correo no es válido.")).toBeInTheDocument();
        expect(email).toHaveAttribute("aria-invalid", "true");

        await user.clear(email);
        await user.type(email, "usuario@roccacr.com");

        await waitFor(() => {
            expect(screen.queryByText("El correo no es válido.")).not.toBeInTheDocument();
        });
        expect(email).toHaveAttribute("aria-invalid", "false");
    });

    it("muestra el estado de verificacion local como informacion neutra", async () => {
        const user = userEvent.setup();
        const onLocalLogin = vi.fn(() => new Promise<void>(() => undefined));
        render(<LoginPage onLocalLogin={onLocalLogin} />);

        await user.type(screen.getByLabelText("Correo administrativo", { selector: "input" }), "rzuniga@roccacr.com");
        await user.type(screen.getByLabelText("Contraseña", { selector: "input" }), "Rocca-Temporal123!");
        await user.click(screen.getByRole("button", { name: "Ingresar" }));

        const status = screen.getByRole("status");

        expect(status).toHaveTextContent("Verificando credenciales...");
        expect(status).toHaveClass("login-status-message--info");
        expect(status).not.toHaveClass("login-status-message--error");
        expect(onLocalLogin).toHaveBeenCalledWith({
            email: "rzuniga@roccacr.com",
            password: "Rocca-Temporal123!",
        });
    });
});
