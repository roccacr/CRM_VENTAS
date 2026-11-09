import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Button from "antd/es/button";
import Result from "antd/es/result";
import { Component, type ReactNode } from "react";

interface RouteErrorBoundaryProps {
    readonly children: ReactNode;
    readonly onRetry?: () => void;
    readonly resetKey?: string;
}

/** Contains render/chunk failures without exposing internal errors or reloading automatically. */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, { readonly failed: boolean }> {
    state = { failed: false };

    /** Stores only the failure flag, never sensitive error contents. */
    static getDerivedStateFromError(): { readonly failed: boolean } {
        return { failed: true };
    }

    /** Navigation can recover from a failed view without remounting a healthy shell. */
    componentDidUpdate(previous: RouteErrorBoundaryProps): void {
        if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
    }

    /** Keeps recovery explicit so persistent failures cannot trigger reload loops. */
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
