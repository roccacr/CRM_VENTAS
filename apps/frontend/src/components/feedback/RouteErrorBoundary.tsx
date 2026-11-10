import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Button from "antd/es/button";
import Result from "antd/es/result";
import { Component, type ReactNode } from "react";

interface RouteErrorBoundaryProps {
    readonly children: ReactNode;
    readonly onRetry?: () => void;
    readonly resetKey?: string;
}

/**
 * Contiene un fallo de render o de carga del módulo sin mostrar el error interno ni recargar la página.
 * Recuperar exige el botón. Un fallo que se repite no dispara un ciclo de recargas.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, { readonly failed: boolean }> {
    state = { failed: false };

    /** Guarda solo que falló. El mensaje, el stack y la URL del módulo no entran al estado ni a la pantalla. */
    static getDerivedStateFromError(): { readonly failed: boolean } {
        return { failed: true };
    }

    /** Cambiar `resetKey` limpia el fallo de esta vista. El shell sano no se vuelve a montar. */
    componentDidUpdate(previous: RouteErrorBoundaryProps): void {
        if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
    }

    /** Reintentar avisa al padre, si lo pidió, y vuelve a mostrar los hijos. No llama a recargar el navegador. */
    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <section className="global-home-dashboard" role="alert">
                <Result
                    status="error"
                    title="No se pudo mostrar esta vista"
                    subTitle="Puedes reintentar. Si el problema continúa, vuelve a abrir Habita más tarde."
                    extra={
                        <Button
                            icon={<ReloadOutlined aria-hidden="true" />}
                            onClick={() => {
                                this.props.onRetry?.();
                                this.setState({ failed: false });
                            }}
                        >
                            Reintentar
                        </Button>
                    }
                />
            </section>
        );
    }
}
