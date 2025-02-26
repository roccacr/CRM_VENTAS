import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getLeadsAttention } from "../../../../../store/leads/thunksLeads";
import Swal from "sweetalert2";

/**
 * Muestra un modal de carga usando SweetAlert2
 * @returns {void}
 */
const showLoadingModal = () => {
   Swal.fire({
      title: "Cargando datos...",
      html: "Por favor, espera mientras los datos se cargan.",
      allowOutsideClick: false,
      didOpen: () => {
         Swal.showLoading();
      },
   });
};

/**
 * Maneja el error ocurrido durante la carga de datos
 * @param {Error} error - El error ocurrido
 * @returns {void}
 */
const handleFetchError = (error) => {
   console.error("Error al cargar datos:", error);
};

/**
 * Obtiene los datos de los leads desde la API
 * @param {Function} dispatch - Función de Redux para despachar acciones
 * @param {string} startDate - Fecha inicial del filtro
 * @param {string} endDate - Fecha final del filtro
 * @param {number} filterOption - Opción de filtro
 * @returns {Promise<Array>} - Promesa que resuelve con los datos obtenidos
 */
const fetchLeadsData = async (dispatch, startDate, endDate, filterOption) => {
   return await dispatch(getLeadsAttention(startDate, endDate, filterOption));
};

/**
 * Custom hook para gestionar la obtención de datos de leads.
 *
 * @param {boolean} [MostrarSwal=true] - Indica si mostrar o no el modal de carga
 * @param {string} startDate - Fecha inicial del filtro
 * @param {string} endDate - Fecha final del filtro
 * @param {number} filterOption - Opción de filtro (1: creación, 2: última acción)
 * @returns {[Array, Function]} - El estado de datos y su función actualizadora
 */
export const useTableData = (MostrarSwal = true, startDate, endDate, filterOption) => {
   const dispatch = useDispatch();
   const [data, setData] = useState([]);

   useEffect(() => {
      const fetchData = async () => {
         try {
            if (MostrarSwal) {
               showLoadingModal();
            }

            const result = await fetchLeadsData(dispatch, startDate, endDate, filterOption);
            setData(result);
         } catch (error) {
            handleFetchError(error);
         } finally {
            if (MostrarSwal) {
               Swal.close();
            }
         }
      };

      fetchData();
   }, [dispatch, startDate, endDate, filterOption, MostrarSwal]);

   return [data, setData];
};
