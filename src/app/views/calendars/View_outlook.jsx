import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useMsal } from '@azure/msal-react';

const View_outlook = () => {
  const { microsoftUser } = useSelector((state) => state.auth);
  const [events, setEvents] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [error, setError] = useState(null);
  const { instance, accounts } = useMsal();

  useEffect(() => {
    const getAccessToken = async () => {
      if (!accounts || accounts.length === 0) {
        setError('Usuario no autenticado.');
        return;
      }

      try {
        const response = await instance.acquireTokenSilent({
          scopes: ['Calendars.Read'],
          account: accounts[0],
        });

        setAccessToken(response.accessToken);
        setError(null);
      } catch (err) {
        console.error('Error al obtener token con Calendars.Read:', err);
        setError('No se pudo obtener el token con permisos de calendario. Intenta iniciar sesión nuevamente.');
      }
    };

    getAccessToken();
  }, [instance, accounts]);

  useEffect(() => {
    if (!accessToken) return;

    const fetchEvents = async () => {
      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me/events?$top=50&$orderby=start/dateTime', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'outlook.timezone="America/Costa_Rica"',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error('Error response:', {
            status: response.status,
            statusText: response.statusText,
            errorData
          });
          throw new Error(`Error HTTP ${response.status}: ${response.statusText || 'Permiso denegado'}`);
        }

        const data = await response.json();
        if (data && data.value) {
          setEvents(data.value);
          setError(null);
        } else {
          throw new Error('Formato de respuesta inválido');
        }
      } catch (err) {
        console.error('Error detallado al obtener eventos:', err);
        setError(`No se pudieron obtener los eventos del calendario: ${err.message}`);
      }
    };

    fetchEvents();
  }, [accessToken]);

  return (
    <div>
      <h2>Perfil de Usuario Microsoft</h2>
      {microsoftUser && microsoftUser.new && microsoftUser.new.user ? (
        <div>
          <p><strong>Nombre:</strong> {microsoftUser.new.user.name}</p>
          <p><strong>Correo:</strong> {microsoftUser.new.user.email}</p>
          {microsoftUser.new.user.profilePicture && (
            <p>
              <strong>Imagen:</strong>
              <br />
              <img src={microsoftUser.new.user.profilePicture} alt="Perfil" width={80} style={{ borderRadius: '50%' }} />
            </p>
          )}
        </div>
      ) : (
        <p>No se encontró un usuario autenticado.</p>
      )}

      {error && (
        <div style={{ color: 'red', marginTop: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <h2>Eventos del Calendario</h2>
      {events.length > 0 ? (
        <ul>
          {events.map((event) => (
            <li key={event.id} style={{ marginBottom: '1rem' }}>
              <p><strong>Asunto:</strong> {event.subject}</p>
              <p><strong>Inicio:</strong> {new Date(event.start.dateTime).toLocaleString()}</p>
              <p><strong>Fin:</strong> {new Date(event.end.dateTime).toLocaleString()}</p>
              <p><strong>Ubicación:</strong> {event.location?.displayName || 'No especificada'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No se encontraron eventos del calendario.</p>
      )}
    </div>
  );
};

export default View_outlook;
