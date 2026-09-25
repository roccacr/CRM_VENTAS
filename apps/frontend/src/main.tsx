import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const ROOT_ELEMENT_ID = "root";

/**
 * Retorna el elemento de montaje React configurado o falla durante arranque.
 *
 * Si falta el root element, el shell HTML esta roto; continuar ocultaria el
 * problema real detras de errores runtime de React.
 */
function getRootElement(): HTMLElement {
    const rootElement = document.getElementById(ROOT_ELEMENT_ID);

    if (!rootElement) {
        throw new Error(`Falta el elemento #${ROOT_ELEMENT_ID} para iniciar el frontend CRM TINK.`);
    }

    return rootElement;
}

/**
 * Entrypoint React del stub frontend congelado.
 *
 * Mantener este archivo limitado al bootstrap de React. UI de producto, rutas,
 * carga de sesion y clientes API deben entrar por modulos aprobados cuando la
 * ley frontend autorice el siguiente corte.
 */
createRoot(getRootElement()).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
