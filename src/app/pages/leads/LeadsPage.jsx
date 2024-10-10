
import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import View_list_leads_new from "../../views/leads/list/new/View_list_leads_new";
import View_list_leads_attention from "../../views/leads/list/attention/View_list_leads_attention";
import View_list_leads_complete from "../../views/leads/list/complete/View_list_leads_complete";
import { View_note } from "../../views/leads/note/View_note";
import View_list_leads_Stragglers from "../../views/leads/list/Stragglers/View_list_leads_Stragglers";
import { View_loss_lead } from "../../views/leads/loss/View_loss_lead";
import { View_follow_up } from "../../views/leads/follow-up/View_follow_up";
import View_total_leads from "../../views/leads/list/total/View_total_leads";
import { View_Consultar_lead } from "../../views/leads/consultar/View_Consultar_lead";
import { View_crear_lead } from "../../views/leads/add/View_crear_lead";

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
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "3" && <View_list_leads_attention />}
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "4" && <View_list_leads_Stragglers />}
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "1" && <View_list_leads_complete />}
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "5" && <View_total_leads />}
                        {path[1] === "leads" && path[2] === "note" && <View_note />}
                        {path[1] === "leads" && path[2] === "loss" && <View_loss_lead />}
                        {path[1] === "leads" && path[2] === "follow_up" && <View_follow_up />}

                        {path[1] === "leads" && path[2] === "consultar" && <View_Consultar_lead />}
                        {path[1] === "leads" && path[2] === "crear" && <View_crear_lead />}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
