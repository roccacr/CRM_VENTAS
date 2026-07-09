import { AppLayout } from "../../layout/AppLayout";
import { View_reporte_comisiones } from "../../views/reportes/comisiones/View_reporte_comisiones";

export const ReportesPage = () => {
    return (
        <AppLayout>
            <div className="pc-container">
                <div className="pc-content">
                    <div className="row">
                        <View_reporte_comisiones />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
