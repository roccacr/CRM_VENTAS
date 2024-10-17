
import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";

import { BotonVolveR } from "../../components/BotonVolveR";
import { Crear_Oportunidad } from "../../views/oportunidad/crear/Crear_Oportunidad";

export const Page_oportunidad = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <BotonVolveR />
                    <div className="row">{path[1] === "oportunidad" && path[2] === "crear" && <Crear_Oportunidad />}</div>
                </div>
            </div>
        </AppLayout>
    );
};