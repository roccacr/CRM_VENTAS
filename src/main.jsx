import ReactDOM from 'react-dom/client'
import { App } from './App'
import { BrowserRouter } from 'react-router-dom';
import { Provider } from "react-redux";
import { store } from './store/store';
import { MsalProvider } from "@azure/msal-react";
import { CssBaseline } from '@mui/material';
import { initializeMSAL, msalInstance } from './config/msalConfig';

/**
 * Inicializar MSAL antes de renderizar la aplicación
 * Esto es crítico para que la autenticación con Microsoft funcione correctamente
 */
const initializeApp = async () => {
  try {
    await initializeMSAL();
  } catch (error) {
    console.error('Error al inicializar MSAL:', error);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <Provider store={store}>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter>
          <CssBaseline />
          <App />
        </BrowserRouter>
      </MsalProvider>
    </Provider>
  );
};

// Ejecutar inicialización
initializeApp();
