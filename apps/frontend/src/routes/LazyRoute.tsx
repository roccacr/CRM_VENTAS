import { lazy, type ReactNode, Suspense, useState } from "react";

import { RouteErrorBoundary } from "../components/feedback/RouteErrorBoundary";

/** Un `React.lazy` rechazado guarda su error. Un reintento explícito tiene que crear una instancia nueva. */
export function createLazyRoute<Props extends object>(load: () => Promise<{ default: (props: Props) => ReactNode }>) {
    const initialPage = lazy(load);
    return function LazyRoute(props: Props) {
        const [Page, setPage] = useState(() => initialPage);
        return (
            <RouteErrorBoundary
                onRetry={() => {
                    setPage(() => lazy(load));
                }}
            >
                <Suspense
                    fallback={
                        <section className="global-home-dashboard" role="status" aria-label="Cargando vista" aria-live="polite" aria-busy="true">
                            Cargando vista…
                        </section>
                    }
                >
                    <Page {...props} />
                </Suspense>
            </RouteErrorBoundary>
        );
    };
}
