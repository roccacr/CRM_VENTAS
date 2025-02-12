import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getLeadsNew } from "../../../../../store/leads/thunksLeads";

/**
 * Custom hook for managing leads data fetching and updates
 * @returns {Array} A tuple containing:
 *   - data: The current leads data state
 *   - setData: Function to update the leads data
 */
export const useTableData = () => {
    // Initialize Redux dispatch
    const dispatch = useDispatch();
    
    // Initialize local state for storing leads data
    const [data, setData] = useState([]);

    // Effect to fetch data when component mounts
    useEffect(() => {
        const fetchData = async () => {
            // Dispatch the Redux action to get leads
            const result = await dispatch(getLeadsNew()); 
            // Update local state with the fetched data
            setData(result);
        };
        
        fetchData();
    }, [dispatch]); // Re-run effect if dispatch changes

    // Return data state and setter function
    return [data, setData];
};