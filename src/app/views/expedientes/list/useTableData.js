import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import Swal from "sweetalert2";
import { getFileList } from "../../../../store/expedientes/thunksExpedientes";

/**
 * Custom hook para gestionar la obtención de datos de leads.
 *
 * @param {boolean} MostrarSwal - Indica si mostrar o no el modal de carga.
 * @returns {[Array, Function]} - Retorna el estado de los datos y una función para actualizarlos.
 */
export const useTableData = (MostrarSwal = true) => {
   const dispatch = useDispatch(); // Hook de Redux para despachar acciones
   const [data, setData] = useState([]); // Estado local para almacenar los datos

   /**
    * Efecto que se ejecuta al montar el componente o cuando cambian las dependencias.
    *
    * - Muestra un modal de carga si MostrarSwal es verdadero.
    * - Realiza la solicitud para obtener los datos desde Redux mediante la acción getFileList.
    * - Actualiza el estado local con los datos obtenidos.
    * - Maneja errores en caso de que falle la solicitud.
    */
   useEffect(() => {
      const fetchData = async () => {
         try {
            if (MostrarSwal) {
               Swal.fire({
                  title: "Cargando datos...",
                  html: "Por favor, espera mientras los datos se cargan.",
                  allowOutsideClick: false,
                  didOpen: () => {
                     Swal.showLoading(); // Muestra el indicador de carga
                  },
               });
            }
            // Obtener los datos llamando a la acción Redux
            const result = await dispatch(getFileList());
            setData(result); // Actualizar el estado con los datos obtenidos
         } catch (error) {
            console.error("Error al cargar datos:", error); // Registrar cualquier error en la consola
         } finally {
            if (MostrarSwal) {
               Swal.close(); // Cierra el modal de carga
            }
         }
      };

      fetchData(); // Llama a la función para cargar los datos
   }, [dispatch, MostrarSwal]); // Dependencias correctas para el efecto

   /**
    * @returns {Array} - Estado actual de los datos obtenidos.
    * @returns {Function} - Función para actualizar manualmente los datos.
    */
   return [data, setData];
};
