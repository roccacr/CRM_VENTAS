
import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import View_list_leads_new from "../../views/leads/list/new/View_list_leads_new";

export const LeadsPage = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

    // Extraer el valor de "data" del query string
    const searchParams = new URLSearchParams(location.search);
    const dataValue = searchParams.get("data"); // Extrae el valor de "data"

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {/* Mostrar la página de lista de leads si path coincide y data === "2" */}
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "2" && <View_list_leads_new />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
