import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import View_list_leads_new from "../../views/leads/list/new/View_list_leads_new";
import { View_calendars } from "../../views/calendars/View_calendars";


export const Page_calendars = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {/* Mostrar la página de lista de leads si path coincide y data === "2" */}
                        {path[1] === "calendar" && <View_calendars />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
