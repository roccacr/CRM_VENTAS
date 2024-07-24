/********************************************** IMPORTACIÓN DE MÓDULOS ****************************************************/

// 1. Importa configureStore de @reduxjs/toolkit, una función para configurar el store de Redux.
import { configureStore } from "@reduxjs/toolkit"; // Importa configureStore de @reduxjs/toolkit.
import { authSlice } from "./auth/authSlice"; // Importa authSlice desde el archivo auth, que contiene el slice para la autenticación.
// import { bugsSlice } from "./bugs/bugsSlice"; // Importa bugsSlice desde el archivo bugs, que contiene el slice para los bugs.
// import { movieSlice } from "./movie/movieSlice"; // Importa movieSlice desde el archivo movie, que contiene el slice para las películas.

// 2. Importa authSlice desde el archivo auth, que contiene el slice para la autenticación.

/********************************************** CONFIGURACIÓN DEL STORE ****************************************************/

/**
 * Crea y exporta el store de Redux usando configureStore.
 * El store es un objeto que contiene el estado global de la aplicación y los reducers,
 * que son funciones que determinan cómo cambia el estado en respuesta a las acciones.
 */
export const store = configureStore({
  reducer: {
    // // El estado de autenticación se gestionará usando este reducer.
    auth: authSlice.reducer,
    // // El estado de los bugs se gestionará usando este reducer.
    // bugs: bugsSlice.reducer,
    // // El estado de las películas se gestionará usando este reducer.
    // movie: movieSlice.reducer,
  },
});
