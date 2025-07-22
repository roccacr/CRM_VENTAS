// correoCitas.js
// Módulo para envío de correos e invitaciones calendar (.ics) usando nodemailer y Outlook SMTP
// Permite enviar invitaciones calendar parametrizables para distintos clientes y proyectos

const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { executeQuery } = require("../conectionPool/conectionPool");

// Configuración del transporte SMTP para Outlook (CRM Ventas)
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: 'crm_noreply@roccacr.com',
        pass: 'CrM_$2023.T1',
    },
    tls: {
        ciphers: 'SSLv3',
    },
});

// Utilidades para .ics
function formatDateICS(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function generarICS({
    uid,
    fechaInicio,
    fechaFin,
    proyectoNombre,
    direccionProyecto,
    organizerName,
    organizerEmail,
    attendeeName,
    attendeeEmail,
    summary,
    description,
    method = 'REQUEST', // 'REQUEST' (crear/editar) o 'CANCEL' (cancelar)
}) {
    return `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CRM Ventas Rocca//Cita Cliente//ES
CALSCALE:GREGORIAN
METHOD:${method}
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDateICS(new Date())}
${method === 'CANCEL' ? 'STATUS:CANCELLED' : ''}
DTSTART:${formatDateICS(fechaInicio)}
DTEND:${formatDateICS(fechaFin)}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${direccionProyecto}
ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}
ATTENDEE;CN=${attendeeName};RSVP=TRUE:mailto:${attendeeEmail}
END:VEVENT
END:VCALENDAR`.trim();
}

// Mensaje de correo según tipo
function generarMensajeTexto({
    clienteNombre,
    proyectoNombre,
    fechaTexto,
    asesorNombre,
    asesorEmail,
    web,
    tipo = 'nueva'
}) {
    if (tipo === 'cancelada') {
        return `
Estimado/a ${clienteNombre},

Le informamos que su cita para el proyecto ${proyectoNombre} ha sido cancelada.

Si desea reprogramar, por favor contacte a su asesor ${asesorNombre}.

Saludos cordiales,
${asesorNombre}
${proyectoNombre}
${web}
        `.trim();
    }
    if (tipo === 'reprogramada') {
        return `
Estimado/a ${clienteNombre},

Su cita para el proyecto ${proyectoNombre} ha sido reprogramada para el día ${fechaTexto}.

Si necesita reprogramar nuevamente o tiene alguna solicitud adicional, contacte a su asesor ${asesorNombre}.

Saludos cordiales,
${asesorNombre}
${proyectoNombre}
${web}
        `.trim();
    }
    // Por defecto, mensaje de nueva cita
    return `
Estimado/a ${clienteNombre},

¡Gracias por su interés en nuestros proyectos residenciales!

Le confirmamos que hemos agendado su visita al proyecto ${proyectoNombre} para el día ${fechaTexto}.

Durante la visita podrá conocer más detalles sobre las amenidades, los modelos de vivienda disponibles y resolver cualquier consulta que tenga. Nuestro equipo estará encantado de atenderle personalmente.

Si necesita reprogramar o tiene alguna solicitud adicional, no dude en contactarnos respondiendo a este correo o contactando a su asesor ${asesorNombre}.

¡Le esperamos con gusto!

Saludos cordiales,

${asesorNombre}  
${proyectoNombre}  
${asesorEmail}  
${web}
    `.trim();
}

// Enviar correo calendar
function enviarInvitacionCalendar({ to, cc, subject, text, icsContent, callback }) {
    const mailOptions = {
        from: '"CRM Ventas Rocca" <crm_noreply@roccacr.com>',
        to,
        cc,
        subject,
        text,
        alternatives: [
            {
                contentType: 'text/calendar; charset="utf-8"; method=REQUEST',
                content: icsContent,
            },
        ],
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (callback) return callback(error, info);
        if (error) {
            console.error('❌ Error al enviar:', error);
        } else {
            console.log('✅ Invitación enviada correctamente a', to, '@', new Date().toLocaleTimeString());
        }
    });
}

// --- SQL helpers ---
const database = "pruebas";

/**
 * Consulta eventos según el tipo de notificación
 * @param {number} notificarCliente - 6: nueva, 3: reprogramada, 4: cancelada
 */
const extraerEvento = (notificarCliente) => {
    // Determinar el tipo_calendar según el tipo de notificación
    let tipoCalendar = 'Pendiente';
    if (notificarCliente === 4) {
        tipoCalendar = 'Cancelado';
    }
    const query = `SELECT 
        c.*, 
        a.name_admin, 
        a.email_admin, 
        l.nombre_lead, 
        l.email_lead
    FROM calendars c
    INNER JOIN admins a ON c.id_admin = a.idnetsuite_admin
    INNER JOIN leads l ON c.id_lead = l.idinterno_lead
    WHERE 
        c.accion_calendar = ? 
        AND c.tipo_calendar = ? 
        AND c.cita_lead = 1 
        AND c.id_proyecto > 0 
        AND c.NotificarCliente = ?
        AND c.correoEnviado = 0`;
    const params = [tipoCalendar, "Cita", notificarCliente];
    return executeQuery(query, params, database);
};

/**
 * Actualiza el campo idEventoProgramado en la tabla calendars
 */
const actualizarIdEventoProgramado = async (id_calendar, uid) => {
    const query = "UPDATE calendars SET idEventoProgramado = ?, correoEnviado = 1 WHERE id_calendar = ?";
    const result = await executeQuery(query, [uid, id_calendar], database);
    console.log('Resultado del UPDATE:', result);
    return result;
};

/**
 * Marca el evento como procesado/cancelado en la base de datos
 */
const marcarEventoCancelado = async (id_calendar) => {
    const query = "UPDATE calendars SET NotificarCliente = 0, correoEnviado = 1 WHERE id_calendar = ?";
    const result = await executeQuery(query, [id_calendar], database);
    console.log('Resultado del UPDATE:', result);
    return result;
};

// Correos en copia siempre
const CC_FIJOS = ['fmata@roccacr.com'];

/**
 * Procesa y envía correos para eventos nuevos, reprogramados o cancelados
 * @param {number} notificarCliente - 6: nueva, 3: reprogramada, 4: cancelada
 * @param {string} tipo - 'nueva', 'reprogramada', 'cancelada'
 */
async function procesarEventos(notificarCliente, tipo) {
    const result = await extraerEvento(notificarCliente);
    if (Array.isArray(result.data)) {
        for (const evento of result.data) {
            // UID único para el evento (si ya existe, reutiliza; si no, usa el id_calendar)
            const uid = evento.idEventoProgramado && evento.idEventoProgramado !== '0'
                ? evento.idEventoProgramado
                : `crm-evento-${evento.id_calendar}`;

            // Mensaje y método del .ics según el tipo
            const mensaje = generarMensajeTexto({
                clienteNombre: evento.nombre_lead,
                proyectoNombre: evento.nombre_proyecto,
                fechaTexto: new Date(evento.fechaIni_calendar).toLocaleString('es-CR'),
                asesorNombre: evento.name_admin,
                asesorEmail: evento.email_admin,
                web: '',
                tipo
            });

            const icsContent = generarICS({
                uid,
                fechaInicio: new Date(evento.fechaIni_calendar),
                fechaFin: new Date(evento.fechaFin_calendar),
                proyectoNombre: evento.nombre_proyecto,
                direccionProyecto: '', // Si tienes dirección, ponla aquí
                organizerName: evento.name_admin,
                organizerEmail: evento.email_admin,
                attendeeName: evento.nombre_lead,
                attendeeEmail: evento.email_lead,
                summary: evento.nombre_calendar,
                description: evento.decrip_calendar,
                method: tipo === 'cancelada' ? 'CANCEL' : 'REQUEST'
            });

            // Destinatarios
            const to = [evento.email_lead, evento.email_admin].filter(Boolean).join(',');
            const cc = evento.copiaJefe === 1 ? CC_FIJOS.join(',') : '';

            // Asunto
            let subject = `Confirmación de cita: ${evento.nombre_proyecto}`;
            if (tipo === 'reprogramada') subject = `Reprogramación de cita: ${evento.nombre_proyecto}`;
            if (tipo === 'cancelada') subject = `Cancelación de cita: ${evento.nombre_proyecto}`;

            // Enviar correo
            enviarInvitacionCalendar({
                to,
                cc,
                subject,
                text: mensaje,
                icsContent,
            }, (error, info) => {
                if (error) {
                    console.error('❌ Error al enviar correo:', error);
                } else {
                    console.log('✅ Invitación enviada correctamente a', to, '@', new Date().toLocaleTimeString());
                }
            });

            // Actualiza SIEMPRE después de intentar enviar el correo
            if (tipo !== 'cancelada') {
                await actualizarIdEventoProgramado(evento.id_calendar, uid);
            } else {
                await marcarEventoCancelado(evento.id_calendar);
            }

            console.log(`Correo (${tipo}) enviado a ${to} para el evento ${evento.id_calendar} (UID: ${uid})`);
        }
    }
}

// Procesa y envía correos para eventos cancelados definitivos (NotificarCliente = 5)
async function procesarCancelacionesDefinitivas() {
    const result = await extraerEvento(5);
    if (Array.isArray(result.data)) {
        for (const evento of result.data) {

            console.log("evento", evento);
            const uid = evento.idEventoProgramado && evento.idEventoProgramado !== '0'
                ? evento.idEventoProgramado
                : `crm-evento-${evento.id_calendar}`;

            const mensaje = generarMensajeTexto({
                clienteNombre: evento.nombre_lead,
                proyectoNombre: evento.nombre_proyecto,
                fechaTexto: new Date(evento.fechaIni_calendar).toLocaleString('es-CR'),
                asesorNombre: evento.name_admin,
                asesorEmail: evento.email_admin,
                web: '',
                tipo: 'cancelada'
            });

            const icsContent = generarICS({
                uid,
                fechaInicio: new Date(evento.fechaIni_calendar),
                fechaFin: new Date(evento.fechaFin_calendar),
                proyectoNombre: evento.nombre_proyecto,
                direccionProyecto: '',
                organizerName: evento.name_admin,
                organizerEmail: evento.email_admin,
                attendeeName: evento.nombre_lead,
                attendeeEmail: evento.email_lead,
                summary: evento.nombre_calendar,
                description: evento.decrip_calendar,
                method: 'CANCEL'
            });

            const to = [evento.email_lead, evento.email_admin].filter(Boolean).join(',');
            const cc = evento.copiaJefe === 1 ? CC_FIJOS.join(',') : '';

            const subject = `Cancelación de cita: ${evento.nombre_proyecto}`;

            enviarInvitacionCalendar({
                to,
                cc,
                subject,
                text: mensaje,
                icsContent,
            }, (error, info) => {
                if (error) {
                    console.error('❌ Error al enviar correo:', error);
                } else {
                    console.log('✅ Invitación enviada correctamente a', to, '@', new Date().toLocaleTimeString());
                    // Si el correo se envió correctamente, actualiza el campo correoEnviado
                    if (info && info.response.includes('250 2.0.0 Ok')) {
                        marcarEventoCancelado(evento.id_calendar);
                    }
                }
            });

            // Marca el evento como procesado/cancelado
            // La actualización de correoEnviado ahora ocurre en el callback de éxito

            console.log(`Correo (cancelación definitiva) enviado a ${to} para el evento ${evento.id_calendar} (UID: ${uid})`);
        }
    }
}

// Ejecutar cada minuto para cada tipo de notificación
cron.schedule('*/1 * * * *', async () => {
    try {
        // Enviar nuevas citas
        await procesarEventos(1, 'nueva');
        // Enviar reprogramaciones
        await procesarEventos(3, 'reprogramada');
        // Enviar cancelaciones (NotificarCliente = 4)
        await procesarEventos(4, 'cancelada');
        // Enviar cancelaciones definitivas (NotificarCliente = 5)
        await procesarCancelacionesDefinitivas();

        return;
    } catch (error) {
        console.error('Error en el cron de envío de invitaciones:', error);
    }
});

console.log('Cron de envío de invitaciones iniciado. Se ejecuta cada 1 minuto.');



