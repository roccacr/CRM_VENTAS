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
      return;
   }
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
      return null;
   }

   try {
      const parsedSession = JSON.parse(rawSession);

      if (storage && legacyStorage?.getItem(AUTH_SESSION_KEY)) {
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
      return;
   }

   storage.setItem(AUTH_REDIRECT_KEY, redirectPath);
};


/**
 * Consume ruta objetivo guardada y la limpia.
 * @returns {string|null}
 */
export const consumeAuthRedirectPath = () => {
   const storage = getPreferredStorage();

   if (!storage) {
      return null;
   }

   const redirectPath = storage.getItem(AUTH_REDIRECT_KEY);

   if (!redirectPath) {
      return null;
   }

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
