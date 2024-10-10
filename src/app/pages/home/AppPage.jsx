import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { TableroHome } from "../../components/TableroHome/TableroHome";
import { AppLayout } from "../../layout/AppLayout";
import { startLoadingAllLeads } from "../../../store/Home/thunksHome";
import { EventosPendientes } from "../../components/TableroHome/EventosPendientes";

// Importar los selectores memoizados
import { selectListNew, selectListAttention, selectListEvents, selectListOportunity, selectListOrderSale, selectListOrderSalePending } from "../../../store/Home/selectorsHome";
import { GraficoKpi } from "../../components/TableroHome/GraficoKpi";
import { GraficoMensual } from "../../components/TableroHome/GraficoMensual";

// Constante para los elementos del tablero (no es necesario que estén en el estado)
const initialDashboardItems = [
    { id: 1, image: "1.svg", icon: "ti ti-user", name: "LEADS NUEVOS", url: "/leads/lista?data=2" },
    { id: 2, image: "2.svg", icon: "ti ti-user-x", name: "LEADS REQUIEREN ATENCIÓN", url: "/leads/lista?data=3" },
    { id: 3, image: "3.svg", icon: "ti ti-calendar", name: "EVENTOS PARA HOY", url: "/events/list?data=1" },
    { id: 4, image: "1.svg", icon: "ti ti-trending-up", name: "OPORTUNIDADES", url: "/oportunidad/list?data=1&data2=0" },
    { id: 5, image: "2.svg", icon: "ti ti-download", name: "ORDENES DE VENTA", url: "/orden/lista?data=1" },
    { id: 6, image: "3.svg", icon: "ti ti-download", name: "CONTRATOS FIRMADOS", url: "/orden/lista?data=2" },
];

// Componente principal de la página del tablero
export const AppPage = () => {
    const [dashboardItems, setDashboardItems] = useState(initialDashboardItems);

    const dispatch = useDispatch();



    // Usar los selectores memoizados en lugar de acceder al estado directamente
    const listNew = useSelector(selectListNew);
    const listAttention = useSelector(selectListAttention);
    const listEvents = useSelector(selectListEvents);
    const listOportunity = useSelector(selectListOportunity);
    const listOrderSale = useSelector(selectListOrderSale);
    const listOrderSalePending = useSelector(selectListOrderSalePending);

    // Cargar leads al montar el componente
    useEffect(() => {
        dispatch(startLoadingAllLeads());
    }, [dispatch]);

    // Actualizar los elementos del tablero cuando cambien los valores de los leads
    useEffect(() => {
        const updatedItems = initialDashboardItems.map((item) => {
            const quantities = {
                1: listNew,
                2: listAttention,
                3: listEvents,
                4: listOportunity,
                5: listOrderSale,
                6: listOrderSalePending,
            };
            return {
                ...item,
                quantity: quantities[item.id] ?? item.quantity, // Si no hay cantidad, mantener la anterior
            };
        });
        setDashboardItems(updatedItems);
    }, [listNew, listAttention, listEvents, listOportunity, listOrderSale, listOrderSalePending]);

    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {dashboardItems.map((item) => (
                            <TableroHome key={item.id} image={`/assets/panel/${item.image}`} icons={item.icon} nombre={item.name} cantidad={item.quantity} url={item.url} />
                        ))}
                        <EventosPendientes /> {/* Componente adicional que muestra eventos pendientes */}
                    </div>
                    <div className="row">
                        <GraficoMensual /> {/* Componente que muestra un gráfico mensual */}
                        <GraficoKpi /> {/* Componente que muestra un gráfico KPI */}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
