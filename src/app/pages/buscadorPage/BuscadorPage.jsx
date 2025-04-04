import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import View_buscador from "../../views/leads/list/buscador/View_buscador";




export const BuscadorPage = () => {               
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {/* Mostrar la página de lista de leads si path coincide y data === "2" */}
                        {path[1] === "buscador" && <View_buscador />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
