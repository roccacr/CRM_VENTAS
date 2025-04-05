import { PublicClientApplication } from "@azure/msal-browser";
import { MSAL_CLIENT_ID, MSAL_AUTHORITY, MSAL_REDIRECT_URI } from "../api/api";

export const msalConfig = {
  auth: {
    clientId: MSAL_CLIENT_ID,
    authority: MSAL_AUTHORITY,
    redirectUri: MSAL_REDIRECT_URI,
    postLogoutRedirectUri: MSAL_REDIRECT_URI,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "User.Read"],
};

// Create a MSAL instance that can be used throughout the application
export const msalInstance = new PublicClientApplication(msalConfig);

export const initializeMSAL = async () => {
  if (!msalInstance) {
    throw new Error("MSAL instance not initialized");
  }
  await msalInstance.initialize();
}; 