SET SQL_SAFE_UPDATES = 0;

UPDATE crmdatabase_ventas.calendars as c
SET
    tipo_calendar = 'Cita'
WHERE
    cita_lead = 1
    or citas_chek = 1