/**
 * Ant Design consulta APIs del navegador que jsdom no implementa.
 *
 * Estos dobles son solo infraestructura de render: no cambian flujos de UI,
 * rutas ni validaciones de los componentes probados.
 */
export const installBrowserApiDoubles = (): void => {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
        }),
    });
};
