const AUTH_SESSION_KEY = "crmVentasAuthSession";
const AUTH_REDIRECT_KEY = "crmVentasAuthRedirectPath";


const canUseStorage = (storageName) => typeof window !== "undefined" && !!window[storageName];


const getStorage = (storageName) => {
   if (!canUseStorage(storageName)) {
      return null;
   }

   return window[storageName];
};


const getPreferredStorage = () => getStorage("localStorage");


const getLegacyStorage = () => getStorage("sessionStorage");


/**
 * Persiste sesión auth para reutilizarla entre tabs del mismo navegador.
 * @param {Object} authPayload
 * @returns {void}
 */
export const persistAuthSession = (authPayload) => {
   const storage = getPreferredStorage();

   if (!storage || !authPayload?.token_admin) {
      console.log("[auth-storage] skip persistAuthSession", {
         hasStorage: !!storage,
         hasToken: !!authPayload?.token_admin,
      });
      return;
   }

   console.log("[auth-storage] persistAuthSession", {
      email_admin: authPayload?.email_admin,
      status_admin: authPayload?.status_admin,
   });
   storage.setItem(AUTH_SESSION_KEY, JSON.stringify(authPayload));
};


/**
 * Lee sesión auth persistida. Migra sessionStorage viejo a localStorage.
 * @returns {Object|null}
 */
export const readAuthSession = () => {
   const storage = getPreferredStorage();
   const legacyStorage = getLegacyStorage();
   const rawSession = storage?.getItem(AUTH_SESSION_KEY) || legacyStorage?.getItem(AUTH_SESSION_KEY);

   if (!rawSession) {
      console.log("[auth-storage] readAuthSession empty");
      return null;
   }

   try {
      const parsedSession = JSON.parse(rawSession);

      console.log("[auth-storage] readAuthSession hit", {
         email_admin: parsedSession?.email_admin,
         hasLocal: !!storage?.getItem(AUTH_SESSION_KEY),
         hasLegacy: !!legacyStorage?.getItem(AUTH_SESSION_KEY),
      });

      if (storage && legacyStorage?.getItem(AUTH_SESSION_KEY)) {
         console.log("[auth-storage] migrating legacy sessionStorage -> localStorage");
         storage.setItem(AUTH_SESSION_KEY, rawSession);
         legacyStorage.removeItem(AUTH_SESSION_KEY);
      }

      return parsedSession;
   } catch {
      storage?.removeItem(AUTH_SESSION_KEY);
      legacyStorage?.removeItem(AUTH_SESSION_KEY);
      return null;
   }
};


/**
 * Limpia sesión auth persistida.
 * @returns {void}
 */
export const clearAuthSession = () => {
   console.log("[auth-storage] clearAuthSession");
   getPreferredStorage()?.removeItem(AUTH_SESSION_KEY);
   getLegacyStorage()?.removeItem(AUTH_SESSION_KEY);
};


/**
 * Guarda ruta objetivo antes de redirigir a login.
 * @param {string} redirectPath
 * @returns {void}
 */
export const persistAuthRedirectPath = (redirectPath) => {
   const storage = getPreferredStorage();

   if (!storage || !redirectPath || redirectPath.startsWith("/auth")) {
      console.log("[auth-storage] skip persistAuthRedirectPath", {
         hasStorage: !!storage,
         redirectPath,
      });
      return;
   }

    console.log("[auth-storage] persistAuthRedirectPath", { redirectPath });
   storage.setItem(AUTH_REDIRECT_KEY, redirectPath);
};


/**
 * Consume ruta objetivo guardada y la limpia.
 * @returns {string|null}
 */
export const consumeAuthRedirectPath = () => {
   const storage = getPreferredStorage();

   if (!storage) {
      console.log("[auth-storage] consumeAuthRedirectPath no storage");
      return null;
   }

   const redirectPath = storage.getItem(AUTH_REDIRECT_KEY);

   if (!redirectPath) {
      console.log("[auth-storage] consumeAuthRedirectPath empty");
      return null;
   }

   console.log("[auth-storage] consumeAuthRedirectPath", { redirectPath });
   storage.removeItem(AUTH_REDIRECT_KEY);
   return redirectPath;
};


/**
 * Lee ruta objetivo guardada sin limpiarla.
 * @returns {string|null}
 */
export const readAuthRedirectPath = () => {
   return getPreferredStorage()?.getItem(AUTH_REDIRECT_KEY) || null;
};


/**
 * Limpia ruta objetivo guardada.
 * @returns {void}
 */
export const clearAuthRedirectPath = () => {
   getPreferredStorage()?.removeItem(AUTH_REDIRECT_KEY);
};
