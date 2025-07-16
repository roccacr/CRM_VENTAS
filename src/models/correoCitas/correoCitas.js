// // correoCitas.js
// // Módulo para envío de correos e invitaciones calendar (.ics) usando nodemailer y Outlook SMTP
// // Permite enviar invitaciones calendar parametrizables para distintos clientes y proyectos

// const nodemailer = require('nodemailer');

// /**
//  * Configuración del transporte SMTP para Outlook (CRM Ventas)
//  */
// const transporter = nodemailer.createTransport({
//     host: 'smtp.office365.com',
//     port: 587,
//     secure: false,
//     auth: {
//         user: 'crm_noreply@roccacr.com',
//         pass: 'CrM_$2023.T1',
//     },
//     tls: {
//         ciphers: 'SSLv3',
//     },
// });

// /**
//  * Formatea una fecha a formato compatible con .ics (iCalendar)
//  * @param {Date} date
//  * @returns {string}
//  */
// function formatDateICS(date) {
//     return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
// }

// /**
//  * Genera el contenido .ics para una invitación calendar
//  * @param {Object} params
//  * @param {string} params.uid UID único del evento
//  * @param {Date} params.fechaInicio Fecha y hora de inicio
//  * @param {Date} params.fechaFin Fecha y hora de fin
//  * @param {string} params.proyectoNombre Nombre del proyecto
//  * @param {string} params.direccionProyecto Dirección del proyecto
//  * @param {string} params.organizerName Nombre del organizador
//  * @param {string} params.organizerEmail Email del organizador
//  * @param {string} params.attendeeName Nombre del invitado
//  * @param {string} params.attendeeEmail Email del invitado
//  * @param {string} params.summary Resumen del evento
//  * @param {string} params.description Descripción del evento
//  * @returns {string}
//  */
// function generarICS({
//     uid,
//     fechaInicio,
//     fechaFin,
//     proyectoNombre,
//     direccionProyecto,
//     organizerName,
//     organizerEmail,
//     attendeeName,
//     attendeeEmail,
//     summary,
//     description,
// }) {
//     return `
// BEGIN:VCALENDAR
// VERSION:2.0
// PRODID:-//CRM Ventas Rocca//Cita Cliente//ES
// CALSCALE:GREGORIAN
// METHOD:REQUEST
// BEGIN:VEVENT
// UID:${uid}
// DTSTAMP:${formatDateICS(new Date())}
// DTSTART:${formatDateICS(fechaInicio)}
// DTEND:${formatDateICS(fechaFin)}
// SUMMARY:${summary}
// DESCRIPTION:${description}
// LOCATION:${direccionProyecto}
// ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}
// ATTENDEE;CN=${attendeeName};RSVP=TRUE:mailto:${attendeeEmail}
// END:VEVENT
// END:VCALENDAR`.trim();
// }

// /**
//  * Genera el cuerpo de texto del correo de invitación
//  * @param {Object} params
//  * @param {string} params.clienteNombre
//  * @param {string} params.proyectoNombre
//  * @param {string} params.direccionProyecto
//  * @param {string} params.fechaTexto
//  * @param {string} params.asesorNombre
//  * @param {string} params.asesorEmail
//  * @param {string} params.asesorTel
//  * @param {string} params.web
//  * @returns {string}
//  */
// function generarMensajeTexto({
//     clienteNombre,
//     proyectoNombre,
//     direccionProyecto,
//     fechaTexto,
//     asesorNombre,
//     asesorEmail,
//     asesorTel,
//     web,
// }) {
//     return `
// Estimado/a ${clienteNombre},

// ¡Gracias por su interés en nuestros proyectos residenciales!

// Le confirmamos que hemos agendado su visita al proyecto ${proyectoNombre} para el día ${fechaTexto}, en la ubicación: ${direccionProyecto}.

// Durante la visita podrá conocer más detalles sobre las amenidades, los modelos de vivienda disponibles y resolver cualquier consulta que tenga. Nuestro equipo estará encantado de atenderle personalmente.

// Si necesita reprogramar o tiene alguna solicitud adicional, no dude en contactarnos respondiendo a este correo o llamando al ${asesorTel}.

// ¡Le esperamos con gusto!

// Saludos cordiales,

// ${asesorNombre}  
// Asesora de Ventas  
// ${proyectoNombre}  
// Tel: ${asesorTel} | ${asesorEmail}  
// ${web}
// `;
// }

// /**
//  * Envía una invitación calendar por correo electrónico
//  * @param {Object} params
//  * @param {string} params.to Email destinatario principal
//  * @param {string|string[]} [params.cc] Email(s) en copia
//  * @param {string} params.subject Asunto del correo
//  * @param {string} params.text Cuerpo de texto del correo
//  * @param {string} params.icsContent Contenido .ics (calendar)
//  * @param {function} [params.callback] Callback opcional para resultado
//  */
// function enviarInvitacionCalendar({ to, cc, subject, text, icsContent, callback }) {
//     const mailOptions = {
//         from: '"CRM Ventas Rocca" <crm_noreply@roccacr.com>',
//         to,
//         cc,
//         subject,
//         text,
//         alternatives: [
//             {
//                 contentType: 'text/calendar; charset="utf-8"; method=REQUEST',
//                 content: icsContent,
//             },
//         ],
//     };

//     transporter.sendMail(mailOptions, (error, info) => {
//         if (callback) return callback(error, info);
//         if (error) {
//             console.error('❌ Error al enviar:', error);
//         } else {
//             console.log('✅ Invitación enviada correctamente a', to, '@', new Date().toLocaleTimeString());
//         }
//     });
// }


// // Exportar funciones principales para uso externo
// module.exports = {
//     generarICS,
//     generarMensajeTexto,
//     enviarInvitacionCalendar,
// };
