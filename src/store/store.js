/********************************************** IMPORTACIÓN DE MÓDULOS ****************************************************/

// 1. Importa la función `configureStore` de Redux Toolkit para configurar el store de Redux.
// Redux Toolkit es una forma simplificada y eficiente de crear un store.
import { configureStore } from "@reduxjs/toolkit";

// 2. Importa los slices de autenticación, home y leads que contienen el estado y los reducers relacionados.
// Estos slices definen cómo se actualiza el estado global de la aplicación según las acciones que se despachen.
import { authSlice } from "./auth/authSlice";
import { HomeSlice } from "./Home/HomeSlice";
import { LeadSlice } from "./leads/leadSlice";
import {calendarSlice} from "./calendar/calendarSlice";

/********************************************** CONFIGURACIÓN DEL STORE ****************************************************/

/**
 * Crea y exporta el store de Redux usando `configureStore` de Redux Toolkit.
 * El store es la única fuente de verdad para el estado global de la aplicación.
 *
 * Cada slice registrado en el reducer define cómo cambiará el estado de esa parte específica de la aplicación.
 * En este caso, estamos combinando los slices de `auth` (para la autenticación), `home` (para la lógica de la página home)
 * y `leads` (para manejar la lógica relacionada con leads).
 */
export const store = configureStore({
    reducer: {
        // `authSlice.reducer` maneja las acciones y el estado relacionado con la autenticación de usuarios.
        auth: authSlice.reducer,

        // `HomeSlice.reducer` maneja las acciones y el estado relacionado con la lógica de la página home.
        home: HomeSlice.reducer,

        // `LeadSlice.reducer` maneja las acciones y el estado relacionado con la lógica de la página de calendario.
        leads: LeadSlice.reducer,

        calendar: calendarSlice.reducer,
    },
});
