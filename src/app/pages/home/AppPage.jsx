import { TableroHome } from "../../components/TableroHome/TableroHome";
import { AppLayout } from "../../layout/AppLayout";

// Define an array of dashboard items
const dashboardItems = [
    { image: "1.svg", icon: "ti ti-user", name: "LEADS NUEVOS", quantity: 50 },
    { image: "2.svg", icon: "ti ti-user-x", name: "LEADS REQUIEREN ATENCIÓN", quantity: 250 },
    { image: "3.svg", icon: "ti ti-calendar", name: "EVENTOS PARA HOY", quantity: 1 },
    { image: "1.svg", icon: "ti ti-trending-up", name: "OPORTUNIDADES", quantity: 20 },
    { image: "2.svg", icon: "ti ti-download", name: "ORDENES DE VENTA", quantity: 5 },
    { image: "3.svg", icon: "ti ti-download", name: "CONTRATO FIRMADO", quantity: 3 },
];

export const AppPage = () => {
    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        {/* Map through dashboardItems to render TableroHome components */}
                        {dashboardItems.map((item, index) => (
                            <TableroHome key={index} image={`/assets/panel/${item.image}`} icons={item.icon} nombre={item.name} cantidad={item.quantity} />
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
