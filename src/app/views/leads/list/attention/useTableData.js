import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getLeadsAttention } from "../../../../../store/leads/thunksLeads";
import Swal from "sweetalert2";

/**
 * Configuración del modal de carga
 * @type {Object}
 */
const LOADING_MODAL_CONFIG = {
   title: "Cargando datos...",
   html: "Por favor, espera mientras los datos se cargan.",
   allowOutsideClick: false,
};

/**
 * Muestra un modal de carga usando SweetAlert2.
 * Configura y muestra una interfaz visual para indicar que se está realizando una operación de carga.
 * @returns {void}
 */
const showLoadingModal = () => {
   Swal.fire({
      ...LOADING_MODAL_CONFIG,
      didOpen: () => {
         Swal.showLoading();
      },
   });
};

/**
 * Cierra el modal de carga si está activo
 * @returns {void}
 */
const closeLoadingModal = () => {
   if (Swal.isVisible()) {
      Swal.close();
   }
};

/**
 * Maneja el error ocurrido durante la carga de datos.
 * Registra el error en la consola y potencialmente podría mostrar una notificación al usuario.
 * @param {Error} error - El error ocurrido durante la operación
 * @returns {void}
 */
const handleFetchError = (error) => {
   console.error("Error al cargar datos:", error);
   // Aquí podrías agregar lógica adicional para manejar el error, como mostrar una notificación al usuario
};

/**
 * Obtiene los datos de los leads desde la API.
 * Realiza la petición a través de Redux para obtener los datos según los filtros especificados.
 *
 * @param {Function} dispatch - Función de Redux para despachar acciones
 * @param {Object} filters - Objeto con los filtros a aplicar
 * @param {string} filters.startDate - Fecha inicial del filtro
 * @param {string} filters.endDate - Fecha final del filtro
 * @param {number} filters.filterOption - Opción de filtro (1: creación, 2: última acción)
 * @returns {Promise<Array>} - Promesa que resuelve con los datos obtenidos
 * @throws {Error} Si hay un error en la petición
 */
const fetchLeadsData = async (dispatch, { startDate, endDate, filterOption }) => {
   return await dispatch(getLeadsAttention(startDate, endDate, filterOption));
};

/**
 * Custom hook para gestionar la obtención y estado de datos de leads.
 * Maneja la lógica de carga, actualización y gestión de errores para los datos de leads.
 *
 * @param {Object} options - Opciones de configuración del hook
 * @param {boolean} [options.showLoadingModal=true] - Indica si mostrar o no el modal de carga
 * @param {string} options.startDate - Fecha inicial del filtro
 * @param {string} options.endDate - Fecha final del filtro
 * @param {number} options.filterOption - Opción de filtro (1: creación, 2: última acción)
 * @returns {[Array, Function]} - Tupla con el estado de datos y su función actualizadora
 *
 * @example
 * const [leadsData, setLeadsData] = useTableData({
 *   showLoadingModal: true,
 *   startDate: '2024-01-01',
 *   endDate: '2024-12-31',
 *   filterOption: 1
 * });
 */
export const useTableData = ({ showLoadingModal: shouldShowModal = true, startDate, endDate, filterOption }) => {
   const dispatch = useDispatch();
   const [data, setData] = useState([]);

   console.log(startDate, endDate, filterOption);

   useEffect(() => {
      const loadData = async () => {
         try {
            if (shouldShowModal) {
               showLoadingModal();
            }

            const result = await fetchLeadsData(dispatch, {
               startDate,
               endDate,
               filterOption,
            });

            setData(result);
         } catch (error) {
            handleFetchError(error);
         } finally {
            if (shouldShowModal) {
               closeLoadingModal();
            }
         }
      };

      loadData();
   }, [dispatch, startDate, endDate, filterOption, shouldShowModal]);

   return [data, setData];
};
