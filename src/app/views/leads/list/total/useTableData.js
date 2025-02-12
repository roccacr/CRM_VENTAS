import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getLeadsTotal } from "../../../../../store/leads/thunksLeads";
import Swal from "sweetalert2";

/**
 * Custom hook para gestionar la obtención de datos de leads.
 *
 * @param {boolean} MostrarSwal - Indica si mostrar o no el modal de carga.
 * @param {string} startDate - Fecha inicial del filtro.
 * @param {string} endDate - Fecha final del filtro.
 * @param {number} filterOption - Opción de filtro (1: creación, 2: última acción).
 * @returns {[Array, Function]} - El estado de datos y su función actualizadora.
 */
export const useTableData = (MostrarSwal = true, startDate, endDate, filterOption) => {
   const dispatch = useDispatch(); // Hook de Redux para despachar acciones
   const [data, setData] = useState([]); // Estado local para almacenar los datos
   useEffect(() => {
      const fetchData = async () => {
         try {
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
            // Obtener los datos llamando a la acción Redux
            const result = await dispatch(getLeadsTotal(startDate, endDate, filterOption));
            setData(result);
         } catch (error) {
            console.error("Error al cargar datos:", error);
         } finally {
            if (MostrarSwal) {
               Swal.close();
            }
         }
      };
      fetchData();
   }, [dispatch, startDate, endDate, filterOption, MostrarSwal]); // Dependencias correctas

   return [data, setData];
};
