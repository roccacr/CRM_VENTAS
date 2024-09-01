import { AppLayout } from "../../layout/AppLayout";

import { useLocation } from "react-router-dom";
import { Views_list_leads } from "../../views/leads/views_list/Views_list_leads";

export const LeadsPage = () => {
    //como extraer la url actual y extrar cada http://localhost:5173/Bugs/list ejemplo extraer Bugs y list por separado y hacer un consoel.log de cada uno
    const location = useLocation();
    // este codigo divide la url en partes y muestra la posicion 2 de la url
    const path = location.pathname.split("/");
    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {/** este codigo muestra la pagina de lista de bugs */}
                        {path[1] === "leads" && path[2] === "lista" && <Views_list_leads />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
