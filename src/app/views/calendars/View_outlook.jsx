import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

const View_outlook = () => {
  const { microsoftUser } = useSelector((state) => state.auth);
  const [events, setEvents] = useState([]);
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState(null);
  const { instance, accounts } = useMsal();
  const [loading, setLoading] = useState(false);

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
        if (err instanceof InteractionRequiredAuthError) {
          try {
            const response = await instance.acquireTokenPopup({
              scopes: ['Calendars.Read'],
              account: accounts[0],
            });
            setAccessToken(response.accessToken);
            setError(null);
          } catch (popupErr) {
            setError('Se requiere permiso para acceder al calendario.');
          }
        } else {
          setError('No se pudo obtener el token con permisos de calendario.');
        }
      }
    };

    getAccessToken();
  }, [instance, accounts]);

  useEffect(() => {
    if (!accessToken) return;

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const startDate = new Date().toISOString();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        const endDateISO = endDate.toISOString();

        const url = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDate}&endDateTime=${endDateISO}&$orderby=start/dateTime&$top=100`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'outlook.timezone=\"America/Costa_Rica\"',
          },
        });

        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data && data.value) {
          // Transform events to FullCalendar format
          const formattedEvents = data.value.map(event => ({
            id: event.id,
            title: event.subject,
            start: event.start.dateTime,
            end: event.end.dateTime,
            description: event.bodyPreview,
            location: event.location?.displayName,
            organizer: event.organizer?.emailAddress.name,
            attendees: event.attendees?.map(a => a.emailAddress.name)
          }));
          setEvents(formattedEvents);
          setError(null);
        }
      } catch (err) {
        setError(`Error al obtener eventos: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [accessToken]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Calendario de Outlook</h2>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando calendario...</div>
      ) : (
        <div style={{ height: '800px' }}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            locale={esLocale}
            events={events}
            eventClick={(info) => {
              alert(`
                Título: ${info.event.title}
                Inicio: ${info.event.start.toLocaleString()}
                Fin: ${info.event.end.toLocaleString()}
                ${info.event.extendedProps.description ? `\nDescripción: ${info.event.extendedProps.description}` : ''}
                ${info.event.extendedProps.location ? `\nUbicación: ${info.event.extendedProps.location}` : ''}
                ${info.event.extendedProps.organizer ? `\nOrganizador: ${info.event.extendedProps.organizer}` : ''}
              `);
            }}
            height="100%"
          />
        </div>
      )}
    </div>
  );
};

export default View_outlook;
