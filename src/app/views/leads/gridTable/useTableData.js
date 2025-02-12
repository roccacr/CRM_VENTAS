import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getLeadsNew } from "../../../../store/leads/thunksLeads";

/**
 * Custom hook para manejar la obtención y actualización de datos de leads
 * @returns {Array} [data, setData] - Estado de los datos y función para actualizarlos
 */
export const useTableData = () => {
    const dispatch = useDispatch();
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            const result = await dispatch(getLeadsNew());
            setData(result);
        };
        fetchData();
    }, [dispatch]);

    return [data, setData];
}; 