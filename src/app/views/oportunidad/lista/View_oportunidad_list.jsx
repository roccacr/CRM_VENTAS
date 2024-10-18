
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getOportunidades } from "../../../../store/oportuinidad/thunkOportunidad";

export const View_oportunidad_list = () => {
    const [oportunidad, setOportunidades] = useState([]);
    const [isLoading, setIsLoading] = useState(true); // Controlar el preloader
    const dispatch = useDispatch(); // Instanciar el dispatch para llamar al thunk
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const idLead = 1;
                const startDate = "2024-01-01";
                const endDate = "2024-12-31";
                const isMode = 0;
                const result = await dispatch(getOportunidades(idLead, startDate, endDate, isMode));

                console.log("🚀 ---------------------------------------------------------------------🚀");
                console.log("🚀 ~ file: View_oportunidad_list.jsx:22 ~ fetchData ~ result:", result);
                console.log("🚀 ---------------------------------------------------------------------🚀");
            } catch (error) {
                console.error("Error al cargar los expedientes", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [dispatch]);

    return (
        <>
            <h1>Lista de Oportunidades</h1>
        </>
    );
};
