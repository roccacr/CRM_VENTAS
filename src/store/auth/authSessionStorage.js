const AUTH_SESSION_KEY = "crmVentasAuthSession";


const canUseSessionStorage = () => typeof window !== "undefined" && !!window.sessionStorage;


export const persistAuthSession = (authPayload) => {
   if (!canUseSessionStorage() || !authPayload?.token_admin) {
      return;
   }

   window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authPayload));
};


export const readAuthSession = () => {
   if (!canUseSessionStorage()) {
      return null;
   }

   const rawSession = window.sessionStorage.getItem(AUTH_SESSION_KEY);

   if (!rawSession) {
      return null;
   }

   try {
      return JSON.parse(rawSession);
   } catch {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
      return null;
   }
};


export const clearAuthSession = () => {
   if (!canUseSessionStorage()) {
      return;
   }

   window.sessionStorage.removeItem(AUTH_SESSION_KEY);
};
