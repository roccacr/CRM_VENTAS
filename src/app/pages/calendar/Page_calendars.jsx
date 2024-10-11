import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import { View_calendars } from "../../views/calendars/View_calendars";
import { BotonVolveR } from "../../components/BotonVolveR";


export const Page_calendars = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <BotonVolveR />
                    <div className="row">
                        {/* Mostrar la página de lista de leads si path coincide y data === "2" */}
                        {path[1] === "calendar" && <View_calendars />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
