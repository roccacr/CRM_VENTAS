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
import { View_edit_lead } from "../../views/leads/edit/View_edit_lead";
import { BotonVolveR } from "../../components/BotonVolveR";
import { PerfilUsuario } from "../../views/leads/perfil/PerfilUsuario";


export const LeadsPage = () => {
    const location = useLocation();
    const path = location.pathname.split("/");
    const searchParams = new URLSearchParams(location.search);
    const dataValue = searchParams.get("data");

    // Determinar si se debe mostrar el contenedor pc-content
    const shouldShowPcContent = !(path[1] === "leads" && path[2] === "lista" && 
        (dataValue === "2" || dataValue === "3" || dataValue === "4" || 
         dataValue === "1" || dataValue === "5"));

    return (
        <AppLayout>
            <div className="pc-container">
                {shouldShowPcContent ? (
                    <div className="pc-content">
                        <BotonVolveR />
                        {path[1] === "leads" && path[2] === "note" && <View_note />}
                        {path[1] === "leads" && path[2] === "loss" && <View_loss_lead />}
                        {path[1] === "leads" && path[2] === "follow_up" && <View_follow_up />}
                        {path[1] === "leads" && path[2] === "consultar" && <View_Consultar_lead />}
                        {path[1] === "leads" && path[2] === "crear" && <View_crear_lead />}
                        {path[1] === "leads" && path[2] === "edit" && <View_edit_lead />}
                        {path[1] === "leads" && path[2] === "perfil" && <PerfilUsuario />}
                    </div>
                ) : (
                    <>
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "2" && <View_list_leads_new />}
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "3" && <View_list_leads_attention />}
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "4" && <View_list_leads_Stragglers />}
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "1" && <View_list_leads_complete />}
                        {path[1] === "leads" && path[2] === "lista" && dataValue === "5" && <View_total_leads />}
                    </>
                )}
            </div>
        </AppLayout>
    );
};
