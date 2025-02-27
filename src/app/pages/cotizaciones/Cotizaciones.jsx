import { AppLayout } from "../../layout/AppLayout";
import { useLocation } from "react-router-dom";
import { BotonVolveR } from "../../components/BotonVolveR";
import Lista_Cotizaciones from "../../views/cotizaciones/lista/Lista_Cotizaciones";




export const Cotizaciones = () => {
    const location = useLocation();
    const path = location.pathname.split("/");
    const searchParams = new URLSearchParams(location.search);
    const dataValue = searchParams.get("data");

    // Determinar si se debe mostrar el contenedor pc-content
    const shouldShowPcContent = !(path[1] === "orden" && path[2] === "lista" && 
        (dataValue === "1" || dataValue === "2" || dataValue === "3" || dataValue==="4" ));

    return (
        <AppLayout>
            <div className="pc-container">
                {shouldShowPcContent ? (
                    <div className="pc-content">
                        <BotonVolveR />
                        <h1>asas</h1>
                        {/* {path[1] === "orden" && path[2] === "note" && <View_note />} */}
                    </div>
                ) : (
                    <>
                        {path[1] === "orden" && path[2] === "lista" && (dataValue === "1" || dataValue === "2" || dataValue==="3"|| dataValue==="4") && <Lista_Cotizaciones />}
                    </>
                )}
            </div>
        </AppLayout>
    );
};
