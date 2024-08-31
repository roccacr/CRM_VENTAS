import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { GraficoKpi } from "../../components/TableroHome/GraficoKpi";
import { GraficoMensual } from "../../components/TableroHome/GraficoMensual";
import { TableroHome } from "../../components/TableroHome/TableroHome";
import { AppLayout } from "../../layout/AppLayout";
import { selectFilteredLeadsCount, selectFilteredLeadsAttentionCount, selectFilteredEventsCount, selectFilteredOpportunityCount } from "../../../store/Home/HomeSlice";
import { startLoadingAllLeads } from "../../../store/Home/thunksHome";
import { EventosPendientes } from "../../components/TableroHome/EventosPendientes";

export const AppPage = () => {
    const [dashboardItems, setDashboardItems] = useState([
        { id: 1, image: "1.svg", icon: "ti ti-user", name: "LEADS NUEVOS", quantity: null, url: "/leads/lista?data=2" },
        { id: 2, image: "2.svg", icon: "ti ti-user-x", name: "LEADS REQUIEREN ATENCIÓN", quantity: null, url: "/leads/lista?data=3" },
        { id: 3, image: "3.svg", icon: "ti ti-calendar", name: "EVENTOS PARA HOY", quantity: null, url: "/evento/lista?data=1" },
        { id: 4, image: "1.svg", icon: "ti ti-trending-up", name: "OPORTUNIDADES", quantity: null, url: "/oportunidad/list?data=1&data2=0" },
        { id: 5, image: "2.svg", icon: "ti ti-download", name: "ORDENES DE VENTA", quantity: null, url: "/orden/lista?data=1" },
        { id: 6, image: "3.svg", icon: "ti ti-download", name: "CONTRATOS FIRMADOS", quantity: null, url: "/orden/lista?data=2" },
    ]);

    const dispatch = useDispatch();
    const filteredLeadsCount = useSelector(selectFilteredLeadsCount);
    const filteredLeadsAttentionCount = useSelector(selectFilteredLeadsAttentionCount);
    const filteredEventsCount = useSelector(selectFilteredEventsCount);
    const filteredOpportunity = useSelector(selectFilteredOpportunityCount);


    // Cargar leads al montar el componente
    useEffect(() => {
        // Despachar ambas acciones al mismo tiempo
        dispatch(startLoadingAllLeads());
    }, [dispatch]);


      useEffect(() => {
          const quantities = {
              1: filteredLeadsCount,
              2: filteredLeadsAttentionCount,
              3: filteredEventsCount,
              4: filteredOpportunity,
          };

          setDashboardItems((prevItems) =>
              prevItems.map((item) => ({
                  ...item,
                  quantity: quantities[item.id] !== undefined ? quantities[item.id] : item.quantity,
              })),
          );
      }, [filteredLeadsCount, filteredLeadsAttentionCount, filteredEventsCount, filteredOpportunity]);
    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {dashboardItems.map((item) => (
                            <TableroHome key={item.id} image={`/assets/panel/${item.image}`} icons={item.icon} nombre={item.name} cantidad={item.quantity} url={item.url} />
                        ))}
                        <EventosPendientes />
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
