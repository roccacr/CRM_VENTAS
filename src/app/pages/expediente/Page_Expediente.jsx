



import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import View_list_expedientes from "../../views/expedientes/list/View_list_expedientes";
import { BotonVolveR } from "../../components/BotonVolveR";



export const Page_Expediente = () => {
    const location = useLocation();

    // Este código divide la URL en partes (los segmentos de la ruta)
    const path = location.pathname.split("/");

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <BotonVolveR />
                    <div className="row">{path[1] === "expedientes" && path[2] === "list" && <View_list_expedientes />}</div>
                </div>
            </div>
        </AppLayout>
    );
};