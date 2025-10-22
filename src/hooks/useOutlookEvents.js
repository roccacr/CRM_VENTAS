import { useState, useEffect, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

/**
 * Custom Hook para obtener eventos de Outlook del día actual
 * Filtra eventos mayores a la hora actual en zona horaria de Costa Rica
 * @returns {Object} { eventsCount, isLoading, error }
 */
export const useOutlookEvents = () => {
  const { instance, accounts } = useMsal();
  const [eventsCount, setEventsCount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  // Obtener token de acceso con reintentos
  useEffect(() => {
    const getAccessToken = async () => {
      if (!accounts || accounts.length === 0) {
        // Si no hay cuentas, reintentar después de 2 segundos (puede estar cargando MSAL)
        if (retryCountRef.current < 5) {
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(getAccessToken, 2000);
          return;
        }
        setError('Usuario no autenticado con Microsoft 365');
        setIsLoading(false);
        return;
      }

      try {
        const response = await instance.acquireTokenSilent({
          scopes: ['Calendars.Read'],
          account: accounts[0],
        });
        setAccessToken(response.accessToken);
        setError(null);
        retryCountRef.current = 0; // Reset retry count on success
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          // No intentar popup automáticamente, solo en caso necesario
          try {
            const response = await instance.acquireTokenPopup({
              scopes: ['Calendars.Read'],
              account: accounts[0],
            });
            setAccessToken(response.accessToken);
            setError(null);
            retryCountRef.current = 0;
          } catch (popupErr) {
            console.error('Error en popup de autenticación:', popupErr);
            // Reintentar con silent después de 3 segundos
            if (retryCountRef.current < 3) {
              retryCountRef.current += 1;
              retryTimeoutRef.current = setTimeout(getAccessToken, 3000);
            } else {
              setError('Se requiere permiso para acceder al calendario');
              setIsLoading(false);
            }
          }
        } else {
          console.error('Error obteniendo token:', err);
          // Reintentar después de 3 segundos
          if (retryCountRef.current < 3) {
            retryCountRef.current += 1;
            retryTimeoutRef.current = setTimeout(getAccessToken, 3000);
          } else {
            setError('No se pudo obtener el token de calendario');
            setIsLoading(false);
          }
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
  }, [instance, accounts]);

  // Verificar y refrescar token periódicamente
  useEffect(() => {
    if (!accounts || accounts.length === 0 || !accessToken) return;

    const checkAndRefreshToken = async () => {
      try {
        const response = await instance.acquireTokenSilent({
          scopes: ['Calendars.Read'],
          account: accounts[0],
        });
        setAccessToken(response.accessToken);
        setError(null);
      } catch (err) {
        console.error('Error al refrescar token:', err);
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
        const costaRicaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));

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
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'outlook.timezone="America/Costa_Rica"',
          },
        });

        if (!response.ok) {
          // Si es error 401, el token puede estar vencido
          if (response.status === 401 && fetchRetryCount < MAX_FETCH_RETRIES) {
            fetchRetryCount += 1;
            console.log(`Token expirado, reintentando... (${fetchRetryCount}/${MAX_FETCH_RETRIES})`);
            // Intentar obtener un nuevo token
            try {
              const newTokenResponse = await instance.acquireTokenSilent({
                scopes: ['Calendars.Read'],
                account: accounts[0],
              });
              setAccessToken(newTokenResponse.accessToken);
              // El useEffect se volverá a ejecutar con el nuevo token
              return;
            } catch (tokenErr) {
              console.error('Error al renovar token:', tokenErr);
            }
          }
          throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data && data.value) {
          // Filtrar eventos que sean mayores a la hora actual
          const currentTime = costaRicaTime.getTime();

          const upcomingEvents = data.value.filter(event => {
            const eventStart = new Date(event.start.dateTime);
            return eventStart.getTime() >= currentTime;
          });

          setEventsCount(upcomingEvents.length);
          setError(null);
          fetchRetryCount = 0; // Reset retry count on success
        } else {
          setEventsCount(0);
          setError(null);
        }
      } catch (err) {
        console.error('Error al obtener eventos de Outlook:', err);

        // Reintentar si no hemos alcanzado el máximo de reintentos
        if (fetchRetryCount < MAX_FETCH_RETRIES) {
          fetchRetryCount += 1;
          console.log(`Reintentando obtener eventos... (${fetchRetryCount}/${MAX_FETCH_RETRIES})`);
          setTimeout(fetchTodayEvents, 2000); // Reintentar después de 2 segundos
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
