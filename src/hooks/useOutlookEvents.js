import { useState, useEffect, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

/**
 * Custom Hook para obtener eventos de Outlook del día actual
 * Filtra eventos mayores a la hora actual en zona horaria de Costa Rica
 * @returns {Object} { eventsCount, isLoading, error }
 *
 * NOTA: Requiere que MSAL esté inicializado en main.jsx
 */
export const useOutlookEvents = () => {
  const { instance, accounts, inProgress } = useMsal();
  const [eventsCount, setEventsCount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  // Obtener token de acceso con reintentos
  useEffect(() => {
    const getAccessToken = async () => {
      // Esperar a que MSAL esté listo
      if (inProgress === "startup") {
        if (retryCountRef.current < 10) {
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(getAccessToken, 500);
          return;
        }
      }

      // Validar que MSAL esté inicializado
      if (!instance) {
        if (retryCountRef.current < 5) {
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(getAccessToken, 1000);
          return;
        }
        setError(null); // Sin error, solo no mostrar eventos
        setIsLoading(false);
        return;
      }

      if (!accounts || accounts.length === 0) {
        if (retryCountRef.current < 5) {
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(getAccessToken, 2000);
          return;
        }
        // Usuario no autenticado, no mostrar error
        setError(null);
        setEventsCount(0);
        setIsLoading(false);
        return;
      }

      try {
        if (!instance.acquireTokenSilent) {
          throw new Error("instance.acquireTokenSilent no está disponible");
        }

        const response = await instance.acquireTokenSilent({
          scopes: ["Calendars.Read"],
          account: accounts[0],
        });
        setAccessToken(response.accessToken);
        setError(null);
        retryCountRef.current = 0;
        console.log("✓ Token de Outlook obtenido correctamente");
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          try {
            const response = await instance.acquireTokenPopup({
              scopes: ["Calendars.Read"],
              account: accounts[0],
            });
            setAccessToken(response.accessToken);
            setError(null);
            retryCountRef.current = 0;
            console.log("✓ Token de Outlook obtenido via popup");
          } catch (popupErr) {
            // Falta de permisos - no reintentar
            console.warn("⚠️ Se requiere dar permisos de calendario en Microsoft");
            setError(null); // No mostrar error al usuario
            setEventsCount(0);
            setIsLoading(false);
            retryCountRef.current = 999; // Evitar reintentos
          }
        } else {
          // Error desconocido - no reintentar continuamente
          console.warn("⚠️ No se pudo obtener eventos de Outlook (sin permisos)");
          setError(null); // No mostrar error al usuario
          setEventsCount(0);
          setIsLoading(false);
          retryCountRef.current = 999; // Evitar reintentos
        }
      }
    };

    getAccessToken();

    // Cleanup: limpiar timeout al desmontar
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [instance, accounts, inProgress]);

  // Verificar y refrescar token periódicamente
  useEffect(() => {
    if (!accounts || accounts.length === 0 || !accessToken) return;

    const checkAndRefreshToken = async () => {
      try {
        const response = await instance.acquireTokenSilent({
          scopes: ["Calendars.Read"],
          account: accounts[0],
        });
        setAccessToken(response.accessToken);
        setError(null);
      } catch (err) {
        console.error("Error al refrescar token:", err);
        // No establecer error aquí, dejar que el token actual siga funcionando
      }
    };

    // Verificar el token cada 5 minutos
    const intervalId = setInterval(checkAndRefreshToken, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [instance, accounts, accessToken]);

  // Obtener eventos del día actual
  useEffect(() => {
    if (!accessToken) return;

    let fetchRetryCount = 0;
    const MAX_FETCH_RETRIES = 3;

    const fetchTodayEvents = async () => {
      setIsLoading(true);
      try {
        // Obtener fecha actual en Costa Rica
        const now = new Date();
        const costaRicaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));

        // Inicio del día (00:00:00)
        const startOfDay = new Date(costaRicaTime);
        startOfDay.setHours(0, 0, 0, 0);

        // Fin del día (23:59:59)
        const endOfDay = new Date(costaRicaTime);
        endOfDay.setHours(23, 59, 59, 999);

        const startDateTime = startOfDay.toISOString();
        const endDateTime = endOfDay.toISOString();

        const url = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$orderby=start/dateTime&$top=100`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: 'outlook.timezone="America/Costa_Rica"',
          },
        });

        if (!response.ok) {
          // Si es error 401, el token puede estar vencido
          if (response.status === 401 && fetchRetryCount < MAX_FETCH_RETRIES) {
            fetchRetryCount += 1;
            console.log(`⏳ Token expirado, reintentando... (${fetchRetryCount}/${MAX_FETCH_RETRIES})`);
            // Intentar obtener un nuevo token
            try {
              const newTokenResponse = await instance.acquireTokenSilent({
                scopes: ["Calendars.Read"],
                account: accounts[0],
              });
              setAccessToken(newTokenResponse.accessToken);
              // El useEffect se volverá a ejecutar con el nuevo token
              return;
            } catch (tokenErr) {
              console.error("Error al renovar token:", tokenErr);
            }
          }
          throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data && data.value) {
          // Filtrar eventos que sean mayores a la hora actual
          const currentTime = costaRicaTime.getTime();

          const upcomingEvents = data.value.filter((event) => {
            const eventStart = new Date(event.start.dateTime);
            return eventStart.getTime() >= currentTime;
          });

          setEventsCount(upcomingEvents.length);
          setError(null);
          fetchRetryCount = 0;
          console.log(`✓ ${upcomingEvents.length} eventos próximos encontrados`);
        } else {
          setEventsCount(0);
          setError(null);
        }
      } catch (err) {
        console.error("Error al obtener eventos de Outlook:", err);

        // Reintentar si no hemos alcanzado el máximo de reintentos
        if (fetchRetryCount < MAX_FETCH_RETRIES) {
          fetchRetryCount += 1;
          console.log(`⏳ Reintentando obtener eventos... (${fetchRetryCount}/${MAX_FETCH_RETRIES})`);
          setTimeout(fetchTodayEvents, 2000);
          return;
        }

        setError(`Error: ${err.message}`);
        setEventsCount(0);
      } finally {
        // Solo establecer isLoading a false si no vamos a reintentar
        if (fetchRetryCount === 0 || fetchRetryCount >= MAX_FETCH_RETRIES) {
          setIsLoading(false);
        }
      }
    };

    // Ejecutar inmediatamente
    fetchTodayEvents();

    // Actualizar cada 5 minutos para mantener los datos actualizados
    const intervalId = setInterval(() => {
      fetchRetryCount = 0; // Reset retry count for periodic updates
      fetchTodayEvents();
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [accessToken, instance, accounts]);

  return { eventsCount, isLoading, error };
};
