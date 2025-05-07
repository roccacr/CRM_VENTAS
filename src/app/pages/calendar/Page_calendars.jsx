import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import { View_calendars } from "../../views/calendars/View_calendars";
import { BotonVolveR } from "../../components/BotonVolveR";
import View_outlook from "../../views/calendars/View_outlook";


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
                        {path[1] === "outlook" && <View_outlook />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
