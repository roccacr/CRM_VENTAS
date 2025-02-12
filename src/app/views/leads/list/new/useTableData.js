import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getLeadsNew } from "../../../../../store/leads/thunksLeads";
import Swal from "sweetalert2";

/**
 * Custom hook for managing leads data fetching and updates
 * @returns {Array} A tuple containing:
 *   - data: The current leads data state
 *   - setData: Function to update the leads data
 */
export const useTableData = (MostrarSwal = true) => {
    // Initialize Redux dispatch
    const dispatch = useDispatch();

    // Initialize local state for storing leads data
    const [data, setData] = useState([]);

    // Effect to fetch data when component mounts
    useEffect(() => {
        const fetchData = async () => {
            if (MostrarSwal) {
                Swal.fire({
                    title: "Cargando datos...",
                    html: "Por favor, espera mientras los datos se cargan.",
                    allowOutsideClick: false,
                    didOpen: () => {
                      Swal.showLoading();
                    },
                });
            }
            // Dispatch the Redux action to get leads
            const result = await dispatch(getLeadsNew());
            // Update local state with the fetched data
            setData(result);
            if (MostrarSwal) {
                Swal.close();
            }
        };

        fetchData();
    }, [dispatch]); // Re-run effect if dispatch changes

    // Return data state and setter function
    return [data, setData];
};
