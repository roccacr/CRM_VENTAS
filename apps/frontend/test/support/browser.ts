/**
 * Ant Design consulta APIs del navegador que jsdom no implementa.
 *
 * Estos dobles son solo infraestructura de render: no cambian flujos de UI,
 * rutas ni validaciones de los componentes probados.
 */
const originalGetComputedStyle = window.getComputedStyle.bind(window);
const getComputedStyleWithoutPseudo = (element: Element, pseudoElt?: string | null): CSSStyleDeclaration => originalGetComputedStyle(element, pseudoElt ? undefined : pseudoElt);

export const installBrowserApiDoubles = (): void => {
    Object.defineProperty(window, "getComputedStyle", {
        configurable: true,
        writable: true,
        // Reinstall the same adapter: beforeEach must not stack wrappers around it.
        value: getComputedStyleWithoutPseudo,
    });

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

    if (typeof window.ResizeObserver === "undefined") {
        Object.defineProperty(window, "ResizeObserver", {
            writable: true,
            value: class {
                observe(): void {
                    return undefined;
                }

                unobserve(): void {
                    return undefined;
                }

                disconnect(): void {
                    return undefined;
                }
            },
        });
    }
};
