import "./styles.css";
import "antd/dist/reset.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { getCanonicalLocalDevelopmentUrl } from "./config/frontend-env";

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
 * Entrypoint React.
 *
 * Este archivo solo monta la raíz. La sesión, las rutas y el cliente del BFF
 * viven en `App` y en los servicios; aquí no se leen cookies ni tokens.
 */
const canonicalLocalDevelopmentUrl = getCanonicalLocalDevelopmentUrl(window.location.href);

if (canonicalLocalDevelopmentUrl) {
    window.location.replace(canonicalLocalDevelopmentUrl);
} else {
    createRoot(getRootElement()).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
