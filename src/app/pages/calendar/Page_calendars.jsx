import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import { View_calendars } from "../../views/calendars/View_calendars";
import { BotonVolveR } from "../../components/BotonVolveR";
import { View_calendario_outlook } from "../../views/calendars/outlook/View_calendario_outlook";


export const Page_calendars = () => {
    const location = useLocation();
    const path = location.pathname.split("/");

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <BotonVolveR />
                    <div className="row">
                        {path[1] === "calendar" && !path[2] && <View_calendars />}
                        {path[1] === "calendar" && path[2] === "outlook" && <View_calendario_outlook />}
                        {path[1] === "outlook" && <View_calendario_outlook />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
