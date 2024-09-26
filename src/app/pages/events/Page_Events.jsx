

import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import { View_events } from "../../views/events/crear/View_events";
import { View_crear_event_lead } from "../../views/events/crearLead/View_crear_event_lead";
import { View_edit_event } from "../../views/events/editEvent/View_edit_event";


export const Page_Events = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {/* Mostrar la página de lista de leads si path coincide y data === "2" */}
                        {path[1] === "events" && path[2] === "lead" && <View_crear_event_lead />}
                        {path[1] === "events" && path[2] === "edit" && <View_edit_event />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
