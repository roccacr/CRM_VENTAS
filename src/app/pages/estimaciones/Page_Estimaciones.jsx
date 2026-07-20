

import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import { BotonVolveR } from "../../components/BotonVolveR";
import { VerEstimacion } from "../../views/estimacion/view/VerEstimacion";
import Lista_Cotizaciones from "../../views/cotizaciones/lista/Lista_Cotizaciones";


export const Page_Estimaciones = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");
    const searchParams = new URLSearchParams(location.search);
    const isPreReserveListRoute = path[1] === "estimaciones" && path[2] === "lista" && searchParams.get("data") === "pre-reserva";

    if (isPreReserveListRoute) {
        return (
            <AppLayout>
                <div className="pc-container">
                    <Lista_Cotizaciones />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <BotonVolveR />
                    <div className="row">{path[1] === "estimaciones" && path[2] === "view" && <VerEstimacion />}</div>
                </div>
            </div>
        </AppLayout>
    );
};
