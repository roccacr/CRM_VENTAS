import { AppLayout } from "../../layout/AppLayout";
import { Navigate, useLocation } from "react-router-dom";
import { BotonVolveR } from "../../components/BotonVolveR";
import Lista_Cotizaciones from "../../views/cotizaciones/lista/Lista_Cotizaciones";
import Lista_Clientes_Cierre_Firmado from "../../views/cotizaciones/cierre-firmado/Lista_Clientes_Cierre_Firmado";
import { VistaOrdenVenta } from "../../views/cotizaciones/view/VistaOrdenVenta";




export const Cotizaciones = () => {
    const location = useLocation();
    const path = location.pathname.split("/");
    const searchParams = new URLSearchParams(location.search);
    const dataValue = searchParams.get("data");
    const allowedListParams = new Set(["1", "2", "3", "4", "pre-reserva", "reserva"]);

    if (path[1] === "orden" && path[2] === "lista" && dataValue === "pre-reserva") {
        return <Navigate to="/estimaciones/lista?data=pre-reserva" replace />;
    }

    // Determinar si se debe mostrar el contenedor pc-content
    const isCotizacionesListRoute = path[1] === "orden" && path[2] === "lista" &&
        allowedListParams.has(dataValue);
    const isSignedClosingRoute = path[1] === "orden" && path[2] === "cierre-firmado";
    const shouldShowPcContent = !(isCotizacionesListRoute || isSignedClosingRoute);

    return (
        <AppLayout>
            <div className="pc-container">
                {shouldShowPcContent ? (
                    <div className="pc-content">
                        <BotonVolveR />
                        {path[1] === "orden" && path[2] === "view" && <VistaOrdenVenta />}
                    </div>
                ) : (
                    <>
                        {isCotizacionesListRoute && <Lista_Cotizaciones />}
                        {isSignedClosingRoute && <Lista_Clientes_Cierre_Firmado />}
                    </>
                )}
            </div>
        </AppLayout>
    );
};
