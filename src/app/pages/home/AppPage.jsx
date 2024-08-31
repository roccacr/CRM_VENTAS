import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { GraficoKpi } from "../../components/TableroHome/GraficoKpi";
import { GraficoMensual } from "../../components/TableroHome/GraficoMensual";
import { TableroHome } from "../../components/TableroHome/TableroHome";
import { AppLayout } from "../../layout/AppLayout";
import { selectFilteredLeadsCount, selectFilteredLeadsAttentionCount, selectFilteredEventsCount, selectFilteredOpportunityCount, selectFilteredOrderSaleCount, selectLeadOrderSale_pendingCount } from "../../../store/Home/HomeSlice";
import { startLoadingAllLeads } from "../../../store/Home/thunksHome";
import { EventosPendientes } from "../../components/TableroHome/EventosPendientes";

// Componente principal de la página del tablero
export const AppPage = () => {
    // Estado local para almacenar los elementos del tablero
    const [dashboardItems, setDashboardItems] = useState([
        // Cada objeto en este array representa un ítem del tablero, con su ícono, nombre y cantidad
        { id: 1, image: "1.svg", icon: "ti ti-user", name: "LEADS NUEVOS", quantity: null, url: "/leads/lista?data=2" },
        { id: 2, image: "2.svg", icon: "ti ti-user-x", name: "LEADS REQUIEREN ATENCIÓN", quantity: null, url: "/leads/lista?data=3" },
        { id: 3, image: "3.svg", icon: "ti ti-calendar", name: "EVENTOS PARA HOY", quantity: null, url: "/evento/lista?data=1" },
        { id: 4, image: "1.svg", icon: "ti ti-trending-up", name: "OPORTUNIDADES", quantity: null, url: "/oportunidad/list?data=1&data2=0" },
        { id: 5, image: "2.svg", icon: "ti ti-download", name: "ORDENES DE VENTA", quantity: null, url: "/orden/lista?data=1" },
        { id: 6, image: "3.svg", icon: "ti ti-download", name: "CONTRATOS FIRMADOS", quantity: null, url: "/orden/lista?data=2" },
    ]);

    // useDispatch es un hook de Redux para despachar acciones
    const dispatch = useDispatch();

    // useSelector es un hook de Redux para seleccionar partes del estado global
    // Aquí estamos seleccionando diferentes contadores desde el slice 'HomeSlice'
    const filteredLeadsCount = useSelector(selectFilteredLeadsCount);
    const filteredLeadsAttentionCount = useSelector(selectFilteredLeadsAttentionCount);
    const filteredEventsCount = useSelector(selectFilteredEventsCount);
    const filteredOpportunity = useSelector(selectFilteredOpportunityCount);
    const filteredOorderSale = useSelector(selectFilteredOrderSaleCount);
    const filteredOorderSale_pending = useSelector(selectLeadOrderSale_pendingCount);

    // useEffect para cargar los leads cuando el componente se monta por primera vez
    useEffect(() => {
        // Despachar la acción que carga todos los leads desde el thunk 'startLoadingAllLeads'
        dispatch(startLoadingAllLeads());
    }, [dispatch]); // El array de dependencias contiene 'dispatch' para evitar advertencias de dependencias faltantes

    // useEffect para actualizar los elementos del tablero cuando cambian los contadores
    useEffect(() => {
        // Crear un objeto que mapea el id del ítem del tablero con la cantidad correspondiente
        const quantities = {
            1: filteredLeadsCount,
            2: filteredLeadsAttentionCount,
            3: filteredEventsCount,
            4: filteredOpportunity,
            5: filteredOorderSale,
            6: filteredOorderSale_pending,
        };

        // Actualizar los elementos del tablero con las nuevas cantidades
        setDashboardItems((prevItems) =>
            prevItems.map((item) => ({
                ...item, // Mantener las propiedades actuales
                quantity: quantities[item.id] !== undefined ? quantities[item.id] : item.quantity, // Actualizar la cantidad si existe, de lo contrario, mantener la anterior
            })),
        );
    }, [filteredLeadsCount, filteredLeadsAttentionCount, filteredEventsCount, filteredOpportunity, filteredOorderSale, filteredOorderSale_pending]); // Array de dependencias asegura que el efecto se ejecute cuando cambie cualquier contador

    // Renderizado del layout de la aplicación y los elementos del tablero
    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {dashboardItems.map((item) => (
                            // Renderizar cada elemento del tablero utilizando el componente TableroHome
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
