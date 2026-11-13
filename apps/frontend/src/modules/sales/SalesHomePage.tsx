import { Alert, Result, Spin } from "antd";
import { useEffect, useState } from "react";

import { apiRequest } from "../../services/api/api-client";

/** Rechaza una respuesta ajena al contrato vacío de Inicio. */
function assertSalesHome(value: unknown): void {
    if (!value || typeof value !== "object" || !("module" in value) || !("sections" in value)) throw new Error("Respuesta de Inicio inválida.");
    if (value.module !== "ventas") throw new Error("Respuesta de Inicio inválida.");
    assertSalesSections(value.sections);
}

/** Inicio es la única sección admitida en esta primera etapa. */
function assertSalesSections(sections: unknown): void {
    if (!Array.isArray(sections) || sections.length !== 1 || sections[0] !== "home") throw new Error("Respuesta de Inicio inválida.");
}

/** La entrada se confirma en el API, sin datos comerciales ni secciones futuras. */
export function SalesHomePage() {
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    useEffect(() => {
        const controller = new AbortController();
        void apiRequest<unknown>("/sales/home", { signal: controller.signal })
            .then((value) => {
                if (controller.signal.aborted) return;
                assertSalesHome(value);
                setStatus("ready");
            })
            .catch(() => {
                if (!controller.signal.aborted) setStatus("error");
            });
        return () => {
            controller.abort();
        };
    }, []);
    if (status === "loading")
        return (
            <Spin description="Comprobando acceso a Ventas">
                <div />
            </Spin>
        );
    if (status === "error") return <Alert type="error" title="No se pudo autorizar el acceso a Ventas." />;
    return <Result title="Inicio" subTitle="Ventas" />;
}
