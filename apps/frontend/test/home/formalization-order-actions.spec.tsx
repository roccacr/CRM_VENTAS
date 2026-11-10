import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { FORMALIZATION_EXAMPLES } from "../../src/modules/home/formalization-preview.model";
import { FormalizationOrderPreview } from "../../src/modules/home/FormalizationOrderPreview";
import { FormalizationTimingPreview } from "../../src/modules/home/FormalizationTimingPreview";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);

function submitDialog() {
    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) throw new Error("Missing scenario form");
    fireEvent.submit(form);
}

it.each([
    ["DEMO-OV-101", "Adjuntar contrato", false],
    ["DEMO-OV-101", "Enviar contrato", true],
    ["DEMO-OV-101", "Contrato firmado", true],
    ["DEMO-OV-102", "Contrato firmado", false],
    ["DEMO-OV-103", "Marcar crédito como formalizado", false],
    ["DEMO-OV-104", "Iniciar gestión bancaria", true],
    ["DEMO-OV-105", "Traspaso realizado", false],
    ["DEMO-OV-103", "Traspaso realizado", true],
    ["DEMO-OV-105", "Cerrar Formalización", false],
])("shows %s action %s with its preview prerequisite", (id, label, disabled) => {
    installBrowserApiDoubles();
    const order = FORMALIZATION_EXAMPLES.find((item) => item.id === id);
    if (!order) throw new Error("Missing demo order");
    render(<FormalizationOrderPreview order={order} onBack={() => undefined} />);
    expect(screen.getByRole("button", { name: label }).hasAttribute("disabled")).toBe(disabled);
});

it("walks through attachment, email and signature with dates and a discardable history", () => {
    installBrowserApiDoubles();
    const order = FORMALIZATION_EXAMPLES.find((item) => item.id === "DEMO-OV-101");
    if (!order) throw new Error("Missing example");
    render(<FormalizationOrderPreview order={order} onBack={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Adjuntar contrato" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar documento de ejemplo" }));
    submitDialog();
    expect(screen.getByRole("button", { name: "Enviar contrato" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Enviar contrato" }));
    expect(screen.getByLabelText("Destinatario *")).toHaveProperty("value", "demo-ov-101@example.invalid");
    expect(screen.getByText("Adjunto: contrato-DEMO-OV-101.pdf")).toBeInTheDocument();
    submitDialog();
    fireEvent.click(screen.getByRole("button", { name: "Contrato firmado" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar documento de ejemplo" }));
    submitDialog();
    expect(screen.getByRole("status").textContent).toContain("Crédito sin iniciar");
    expect(screen.getByRole("region", { name: "Contrato y documentos" }).textContent).toContain("Firmado");
    const history = screen.getByRole("region", { name: "Historial de la orden" });
    expect(within(history).getAllByText(/Simulación/)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Restablecer ejemplo" }));
    expect(screen.getByRole("button", { name: "Enviar contrato" }).hasAttribute("disabled")).toBe(true);
});

it("keeps invalid closure open and explains that approvals are only proposals", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderPreview order={FORMALIZATION_EXAMPLES[3]} onBack={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar Formalización" }));
    expect(screen.queryByText(/Los resultados de autorización y cierre son ficticios/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Resultado de cierre *"), { target: { value: "closed" } });
    fireEvent.change(screen.getByLabelText("Motivo y observaciones del cierre *"), { target: { value: "Ejemplo" } });
    submitDialog();
    expect(screen.getByRole("alert").textContent).toContain("requiere traspaso");
});

it("presents other advisor data and records it only in the local example history", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderPreview order={FORMALIZATION_EXAMPLES[0]} onBack={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Otro asesor" }));
    fireEvent.change(screen.getByLabelText("Nombre del otro asesor *"), { target: { value: "Asesor ficticio C" } });
    fireEvent.change(screen.getByLabelText("Correo del asesor *"), { target: { value: "asesor-c@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Teléfono del asesor · Opcional"), { target: { value: "00000000" } });
    submitDialog();
    expect(screen.getByRole("status").textContent).toContain("Crédito en proceso");
    expect(screen.getByText(/Teléfono: 00000000/)).toBeInTheDocument();
});

it("shows both proposed exception and closure outcomes without granting real authorization", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderPreview order={FORMALIZATION_EXAMPLES[3]} onBack={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar excepción de traspaso" }));
    fireEvent.change(screen.getByLabelText("Resultado de excepción *"), { target: { value: "authorized" } });
    fireEvent.change(screen.getByLabelText("Motivo de la excepción *"), { target: { value: "Prueba visual" } });
    fireEvent.change(screen.getByLabelText("Responsable autorizante *"), { target: { value: "Revisor ficticio" } });
    fireEvent.click(screen.getByRole("button", { name: "Usar documento de ejemplo" }));
    submitDialog();
    expect(screen.getByRole("status").textContent).toContain("autorizado · Ficticio");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar Formalización" }));
    fireEvent.change(screen.getByLabelText("Resultado de cierre *"), { target: { value: "closed" } });
    fireEvent.change(screen.getByLabelText("Motivo y observaciones del cierre *"), { target: { value: "Cierre ficticio" } });
    submitDialog();
    expect(screen.getByRole("status").textContent).toContain("Cerrado por Formalizaciones");
});

it("explains fixed banking durations and opens the same order from the indicator", () => {
    let selected = "";
    render(
        <FormalizationTimingPreview
            onOpenOrder={(order) => {
                selected = order.id;
            }}
        />,
    );
    expect(screen.getByText("18 días transcurridos")).toBeInTheDocument();
    expect(screen.getByText("5 días finalizada")).toBeInTheDocument();
    expect(screen.getByText("7 días")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "DEMO-OV-103" }));
    expect(selected).toBe("DEMO-OV-103");
});

it("opens an explicit preview without changing the order or offering real submission", () => {
    installBrowserApiDoubles();
    const order = FORMALIZATION_EXAMPLES[1];
    render(<FormalizationOrderPreview order={order} onBack={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Contrato firmado" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Simulación visual. No se envían correos ni archivos, ni se modifica ningún registro real.")).toBeNull();
    expect(order.contract).toBe("Enviado · Pendiente de firma");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
});
