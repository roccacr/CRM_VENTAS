import ReactDOM from 'react-dom/client'
import { App } from './App'
import { BrowserRouter } from 'react-router-dom';
import { Provider } from "react-redux";
import { store } from './store/store';
import { MsalProvider } from "@azure/msal-react";
import { pca } from './store/auth/authThunksMicrosoft';

ReactDOM.createRoot(document.getElementById("root")).render(
    <Provider store={store}>
      <MsalProvider instance={pca}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MsalProvider>
    </Provider>
);
