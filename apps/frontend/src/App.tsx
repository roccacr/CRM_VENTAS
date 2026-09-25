const PRODUCT_LABEL = "CRM TINK";
const STUB_TITLE = "Frontend limpio";

/**
 * Stub raiz del frontend para la fase aprobada actual.
 *
 * Este componente es intencionalmente pequeño. La ley de producto mantiene
 * pantallas comerciales congeladas hasta autorizar UI de identidad, asi que
 * `App` solo prueba que el shell React/Vite renderiza sin introducir rutas,
 * clientes API ni pantallas de leads antes del orden aprobado.
 */
export function App() {
    return (
        <main className="app-shell">
            <section className="blank-state" aria-labelledby="app-title">
                <p>{PRODUCT_LABEL}</p>
                <h1 id="app-title">{STUB_TITLE}</h1>
            </section>
        </main>
    );
}
