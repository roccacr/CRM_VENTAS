// Import necessary components for the dashboard
import { GraficoKpi } from "../../components/TableroHome/GraficoKpi";
import { GraficoMensual } from "../../components/TableroHome/GraficoMensual";
import { TableroHome } from "../../components/TableroHome/TableroHome";
import { AppLayout } from "../../layout/AppLayout";

// Define an array of dashboard items
// Each item represents a card on the dashboard with specific properties
const dashboardItems = [
    { image: "1.svg", icon: "ti ti-user", name: "LEADS NUEVOS", quantity: 50, url: "/leads/lista?data=2" },
    { image: "2.svg", icon: "ti ti-user-x", name: "LEADS QUE REQUIEREN ATENCIÓN", quantity: 250, url: "/leads/lista?data=3" },
    { image: "3.svg", icon: "ti ti-calendar", name: "EVENTOS PARA HOY", quantity: 1, url: "/evento/lista?data=1" },
    { image: "1.svg", icon: "ti ti-trending-up", name: "OPORTUNIDADES", quantity: 20, url: "/oportunidad/list?data=1&data2=0" },
    { image: "2.svg", icon: "ti ti-download", name: "ORDENES DE VENTA", quantity: 5, url: "/orden/lista?data=1" },
    { image: "3.svg", icon: "ti ti-download", name: "CONTRATOS FIRMADOS", quantity: 3, url: "/orden/lista?data=2" },
];

// Define the main AppPage component
export const AppPage = () => {
    return (
        // Wrap the entire dashboard in the AppLayout component
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    {/* First row: Dashboard item cards */}
                    <div className="row">
                        {/* Map through dashboardItems to render TableroHome components */}
                        {dashboardItems.map((item, index) => (
                            <TableroHome key={index} image={`/assets/panel/${item.image}`} icons={item.icon} nombre={item.name} cantidad={item.quantity} url={item.url} />
                        ))}
                    </div>
                    {/* Second row: Charts */}
                    <div className="row">
                        {/* Render the monthly chart component */}
                        <GraficoMensual />
                        {/* Render the KPI chart component */}
                        <GraficoKpi />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
