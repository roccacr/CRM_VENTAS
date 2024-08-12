import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { GraficoKpi } from "../../components/TableroHome/GraficoKpi";
import { GraficoMensual } from "../../components/TableroHome/GraficoMensual";
import { TableroHome } from "../../components/TableroHome/TableroHome";
import { AppLayout } from "../../layout/AppLayout";
import { selectFilteredLeadsCount, selectFilteredLeadsAttentionCount } from "../../../store/leads/LeadsSlice";
import { useLoadLeads } from "../../../hook/useLoadLeads";
export const AppPage = () => {
    // Usar el hook para cargar los leads si es necesario
    useLoadLeads();

    // Estado local para gestionar los elementos del dashboard
    const [dashboardItems, setDashboardItems] = useState([
        { id: 1, image: "1.svg", icon: "ti ti-user", name: "LEADS NUEVOS", quantity: null, url: "/leads/lista?data=2" },
        { id: 2, image: "2.svg", icon: "ti ti-user-x", name: "LEADS REQUIEREN ATENCIÓN", quantity: null, url: "/leads/lista?data=3" },
        { id: 3, image: "3.svg", icon: "ti ti-calendar", name: "EVENTOS PARA HOY", quantity: 1, url: "/evento/lista?data=1" },
        { id: 4, image: "1.svg", icon: "ti ti-trending-up", name: "OPORTUNIDADES", quantity: 20, url: "/oportunidad/list?data=1&data2=0" },
        { id: 5, image: "2.svg", icon: "ti ti-download", name: "ORDENES DE VENTA", quantity: 5, url: "/orden/lista?data=1" },
        { id: 6, image: "3.svg", icon: "ti ti-download", name: "CONTRATOS FIRMADOS", quantity: 3, url: "/orden/lista?data=2" },
    ]);

    // Obtención de datos filtrados desde el estado global utilizando useSelector
    const filteredLeadsCount = useSelector(selectFilteredLeadsCount);
    const filteredLeadsAttentionCount = useSelector(selectFilteredLeadsAttentionCount);

    // useEffect se ejecuta al montar el componente o cuando cambian las dependencias
    useEffect(() => {
        // Actualización del estado de los elementos del dashboard según los datos obtenidos
        setDashboardItems((prevItems) =>
            prevItems.map((item) => {
                if (item.id === 1) {
                    return { ...item, quantity: filteredLeadsCount };
                }
                if (item.id === 2) {
                    return { ...item, quantity: filteredLeadsAttentionCount };
                }
                return item;
            }),
        );
    }, [filteredLeadsCount, filteredLeadsAttentionCount]);

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {dashboardItems.map((item, index) => (
                            <TableroHome key={index} image={`/assets/panel/${item.image}`} icons={item.icon} nombre={item.name} cantidad={item.quantity} url={item.url} />
                        ))}
                    </div>
                    <div className="row">
                        <GraficoMensual />
                        <GraficoKpi />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

