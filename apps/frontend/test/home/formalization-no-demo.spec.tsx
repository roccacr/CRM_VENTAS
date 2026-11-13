import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { installBrowserApiDoubles } from "../support/browser";

beforeAll(installBrowserApiDoubles);
afterEach(cleanup);

it("keeps home and follow-up free of sample orders and movements", () => {
    const { rerender } = render(<FormalizationHomePage />);
    expect(screen.queryAllByText(/DEMO-OV-/)).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /Ver movimiento de|Ver seguimiento de/ })).toHaveLength(0);
    expect(screen.getByText("El seguimiento de órdenes aún no está disponible.")).toBeInTheDocument();
    expect(screen.queryByText("Los movimientos recientes aún no están disponibles.")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Amara" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver todas las órdenes" })).not.toBeInTheDocument();
    rerender(<FormalizationHomePage key="orders" initialView="orders" />);
    expect(screen.queryAllByText(/DEMO-OV-/)).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Todas las órdenes", level: 1 })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /Ver seguimiento de/ })).toHaveLength(0);
});
