import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { getAppRoute } from "../../src/routes/app-routes";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);

it("uses the formalization artwork in the personalized welcome and keeps order navigation", () => {
    installBrowserApiDoubles();
    render(<FormalizationHomePage currentUser={{ displayName: "Roberto", email: "roberto@example.test" }} />);
    const welcome = screen.getByRole("region", { name: "Bienvenida a Formalización" });
    expect(welcome.querySelector("img")?.getAttribute("src")).toContain("rocca-formalization-generated.png");
    expect(welcome.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(screen.getByText("Hola, Roberto")).toBeTruthy();
    expect(screen.queryByText("Las colas de abajo muestran cuántas órdenes hay en cada etapa.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las órdenes" }));
    expect(screen.getByRole("heading", { name: "Todas las órdenes", level: 1 })).toBeTruthy();
});

it("shows a separate approval strip only with an effective grant and preserves the six-banner grid", () => {
    installBrowserApiDoubles();
    const permission = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    const { container, rerender } = render(<FormalizationHomePage />);
    expect(screen.queryByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeNull();
    expect(screen.getByRole("region", { name: "Bienvenida a Formalización" })).toBeTruthy();
    expect(screen.getByText("Hola")).toBeTruthy();
    expect(container.querySelectorAll(".formalization-home__banners > article")).toHaveLength(6);
    rerender(<FormalizationHomePage effectivePermissions={[permission, { ...permission, effect: "deny" }]} />);
    expect(screen.queryByRole("button", { name: "Ver pendientes de aprobación de Formalización" })).toBeNull();
    rerender(<FormalizationHomePage effectivePermissions={[permission]} />);
    expect(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }).closest(".formalization-home__header")).toBeTruthy();
    expect(container.querySelectorAll(".formalization-home__banners > article")).toHaveLength(6);
    expect(screen.getByLabelText("Órdenes pendientes de aprobación: 0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver pendientes de aprobación de Formalización" }));
    expect(screen.getByRole("heading", { name: "Pendientes de aprobación", level: 1 })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    rerender(<FormalizationHomePage effectivePermissions={[]} />);
    expect(screen.queryByRole("heading", { name: "Pendientes de aprobación", level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
});

it("opens management directly on all orders and returns Home through app navigation", () => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization/orders")?.Page;
    expect(Page).toBeDefined();
    if (!Page) throw new Error("Missing management route");
    const navigate = vi.fn();
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} onNavigate={navigate} />);
    expect(screen.getByRole("heading", { name: "Todas las órdenes", level: 1 })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    expect(navigate).toHaveBeenCalledWith("/home/formalization");
});

it("renders six visual banners with explicit demo totals and no operational actions", () => {
    const Page = getAppRoute("/home/formalization")?.Page;
    expect(Page).toBeDefined();
    if (!Page) return;
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    expect(screen.getAllByRole("article")).toHaveLength(6);
    for (const label of ["Contratos pendientes", "Gestión bancaria", "Pendientes de saldo", "Traspasos pendientes", "Traspaso firmado", "Formalizaciones cerradas este año"]) expect(screen.getByRole("heading", { name: label })).toBeTruthy();
    expect(screen.queryByText(/aún cuenta contratos firmados/)).toBeNull();
    expect(screen.getAllByLabelText(/^Valor:/).map((element) => element.textContent.trim())).toEqual(["1", "1", "1", "1", "1", "3", "0"]);
    expect(screen.queryByLabelText("Dato no disponible")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar contrato" })).toBeNull();
});

it("labels fictional records and filters the local pending queue without operational actions", () => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization")?.Page;
    if (!Page) throw new Error("Missing Formalization Home");
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    expect(screen.queryByText("Datos de ejemplo. No corresponden a operaciones reales.")).toBeNull();
    expect(screen.getByRole("heading", { name: "Pendientes de seguimiento" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Responsable / Tiempo" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Detalle" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Gestión bancaria 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /^Gestión bancaria/ }));
    expect(screen.getByRole("button", { name: "Ver seguimiento de DEMO-OV-103" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver seguimiento de DEMO-OV-101" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /^Todas/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar operación" }), { target: { value: "DEMO-OV-101" } });
    expect(screen.getByRole("button", { name: "Ver seguimiento de DEMO-OV-101" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver seguimiento de DEMO-OV-103" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de DEMO-OV-101" }));
    expect(screen.getByRole("heading", { name: "Orden de venta DEMO-OV-101" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Condición financiera" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar contrato" }).hasAttribute("disabled")).toBe(true);
});

it.each([
    ["Por enviar", "Contratos por enviar", 1],
    ["Pendientes de firma", "Contratos pendientes de firma", 1],
    ["Sin iniciar / En proceso", "Gestión bancaria", 1],
    ["Consulta financiera", "Pendientes de saldo", 1],
    ["Por gestionar", "Traspasos pendientes", 1],
    ["Firma registrada · Llaves pendientes", "Traspaso firmado", 3],
    ["Proceso finalizado", "Formalizaciones cerradas este año", 0],
])("opens the %s banner as a filtered table", (label, title, count) => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization")?.Page;
    if (!Page) throw new Error("Missing Formalization Home");
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: `Abrir ${label}` }));
    expect(screen.getByRole("heading", { name: title, level: 1 })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(count);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    expect(screen.getByRole("heading", { name: "Formalización", level: 1 })).toBeTruthy();
});

it("opens a row as a full order and preserves the list search on return", () => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization")?.Page;
    if (!Page) throw new Error("Missing Formalization Home");
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Firma registrada · Llaves pendientes" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar operación" }), { target: { value: "DEMO-OV-103" } });
    fireEvent.click(screen.getByRole("row", { name: "Abrir orden DEMO-OV-103" }));
    expect(screen.getByRole("heading", { name: "Orden de venta DEMO-OV-103" })).toBeTruthy();
    for (const title of ["Cliente y unidad", "Condiciones de la orden", "Contrato y documentos", "Gestión bancaria", "Condición financiera", "Traspaso y cierre", "Historial de la orden"]) expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Volver a la lista" }));
    expect(screen.getByDisplayValue("DEMO-OV-103")).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(1);
});

it("retains a completed order when returning to the dashboard and closed queue", () => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization")?.Page;
    if (!Page) throw new Error("Missing Formalization Home");
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Por gestionar" }));
    fireEvent.click(screen.getByRole("row", { name: "Abrir orden DEMO-OV-105" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar: Traspaso realizado" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar documento de ejemplo" }));
    const transferForm = screen.getByRole("dialog").querySelector("form");
    if (!transferForm) throw new Error("Missing transfer form");
    fireEvent.submit(transferForm);
    fireEvent.click(screen.getByRole("button", { name: "Continuar: Cerrar Formalización" }));
    fireEvent.change(screen.getByLabelText("Resultado de cierre *"), { target: { value: "closed" } });
    fireEvent.change(screen.getByLabelText("Motivo y observaciones del cierre *"), { target: { value: "Cierre visual" } });
    const closureForm = screen.getByRole("dialog").querySelector("form");
    if (!closureForm) throw new Error("Missing closure form");
    fireEvent.submit(closureForm);
    fireEvent.click(screen.getByRole("button", { name: "Volver a la lista" }));
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    expect(screen.getByRole("button", { name: "Abrir Proceso finalizado" }).textContent).toContain("1");
    fireEvent.click(screen.getByRole("button", { name: "Abrir Proceso finalizado" }));
    fireEvent.click(screen.getByRole("row", { name: "Abrir orden DEMO-OV-105" }));
    expect(screen.getByRole("status").textContent).toContain("Cerrado por Formalizaciones");
    expect(screen.getByRole("button", { name: "Traspaso realizado" }).hasAttribute("disabled")).toBe(true);
});

it("uses the same order from project counts and recent movements", () => {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization")?.Page;
    if (!Page) throw new Error("Missing Formalization Home");
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver Gestión bancaria de AVIVA" }));
    expect(screen.getByRole("heading", { name: "Gestión bancaria · AVIVA", level: 1 })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /^Ver seguimiento de/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver movimiento de DEMO-OV-103" }));
    expect(screen.getByRole("heading", { name: "Orden de venta DEMO-OV-103" })).toBeTruthy();
});
