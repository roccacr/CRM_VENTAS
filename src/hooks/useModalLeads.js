import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getBitacoraLeads } from "../store/leads/thunksLeads";

/**
 * Hook `useModalLeads`
 *
 * Este hook maneja la lógica para un modal que muestra las acciones recientes (bitácora) relacionadas con un lead.
 * Incluye manejo del estado del modal, detección de tamaño de pantalla (responsivo), carga de datos (bitácora),
 * y control de estado de carga.
 *
 * @param {Object} leadData - Datos del lead, incluyendo su identificador único.
 * @param {number} leadData.idinterno_lead - ID interno del lead necesario para cargar la bitácora.
 *
 * @returns {Object} - Estado y funciones relacionadas con el modal.
 * @property {boolean} showModal - Indica si el modal debe estar visible.
 * @property {boolean} isMobile - Indica si la pantalla tiene un ancho menor o igual a 768px.
 * @property {boolean} showPreload - Indica si los datos de la bitácora están en proceso de carga.
 * @property {Array} bitacora - Datos de la bitácora cargados desde la API.
 * @property {Function} setShowModal - Función para establecer el estado de visibilidad del modal.
 */
export const useModalLeads = (leadData) => {
    const dispatch = useDispatch();

    // Estado del modal
    const [showModal, setShowModal] = useState(false);

    // Estado para detectar si la pantalla es móvil (≤768px)
    const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 768px)").matches);

    // Estado de carga
    const [showPreload, setShowPreload] = useState(true);

    // Estado para almacenar la bitácora del lead
    const [bitacora, setBitacora] = useState([]);

    /**
     * Efecto para manejar los cambios en el tamaño de pantalla.
     * Escucha los cambios en el ancho de pantalla y actualiza `isMobile`.
     */
    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 768px)");
        const handleMediaQueryChange = (e) => setIsMobile(e.matches);
        mediaQuery.addEventListener("change", handleMediaQueryChange);
        return () => mediaQuery.removeEventListener("change", handleMediaQueryChange);
    }, []);

    /**
     * Efecto para mostrar el modal después de un breve retraso cuando cambian los datos del lead.
     * Previene que el modal aparezca inmediatamente.
     */
    useEffect(() => {
        const timer = setTimeout(() => setShowModal(true), 100);
        return () => clearTimeout(timer);
    }, [leadData]);

    /**
     * Efecto para cargar la bitácora del lead cuando se recibe `idinterno_lead`.
     * Realiza una llamada a la acción `getBitacoraLeads` de Redux para obtener los datos.
     * Maneja el estado de carga mientras espera la respuesta.
     */
    useEffect(() => {
        const fetchBitacora = async () => {
            try {
                const result = await dispatch(getBitacoraLeads(leadData?.idinterno_lead));
                setBitacora(result); // Almacena los datos en el estado.
                setShowPreload(false); // Indica que la carga ha terminado.
            } catch (error) {
                console.error("Error fetching bitacora:", error);
                setShowPreload(false); // Manejo de errores.
            }
        };

        if (leadData?.idinterno_lead) {
            fetchBitacora();
        }
    }, [dispatch, leadData]);

    // Retorna el estado y las funciones del hook
    return {
        showModal,
        isMobile,
        showPreload,
        bitacora,
        setShowModal,
    };
};
