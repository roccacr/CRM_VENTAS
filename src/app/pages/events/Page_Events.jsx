

import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import { View_events_Actions } from "../../views/events/actions/View_events_Actions";


export const Page_Events = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {path[1] === "events" && path[2] === "actions" && <View_events_Actions />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
