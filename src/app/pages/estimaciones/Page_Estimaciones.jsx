

import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import { BotonVolveR } from "../../components/BotonVolveR";
import { VerEstimacion } from "../../views/estimacion/view/VerEstimacion";


export const Page_Estimaciones = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

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
