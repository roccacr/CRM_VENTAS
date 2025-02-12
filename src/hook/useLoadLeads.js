import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getBitacoraLeads } from "../../../store/leads/thunksLeads";

/**
 * Custom hook to manage lead modal logic
 * @param {string} leadId - The ID of the lead
 * @returns {Object} Object containing modal state and handlers
 */
export const useLeadModal = (leadId) => {
    const dispatch = useDispatch();
    const [bitacora, setBitacora] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const fetchBitacora = async () => {
            try {
                const result = await dispatch(getBitacoraLeads(leadId));
                setBitacora(result);
            } catch (error) {
                console.error("Error fetching bitacora:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (leadId) fetchBitacora();
    }, [dispatch, leadId]);

    useEffect(() => {
        const timer = setTimeout(() => setShowModal(true), 100);
        return () => clearTimeout(timer);
    }, [leadId]);

    return { bitacora, isLoading, showModal, setShowModal };
};