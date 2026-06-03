const cron = require("node-cron");
const nodemailer = require("nodemailer");
const { executeQuery } = require("../conectionPool/conectionPool");
const dotenv = require("dotenv");
dotenv.config();

/**
 * @fileoverview Gestor de tareas programadas (cron jobs) para el procesamiento de leads interesados.
 * Este módulo implementa un sistema robusto de programación de tareas con manejo de errores,
 * métricas de rendimiento y control del ciclo de vida de los jobs.
 *
 * @module cronsLeads
 * @requires node-cron
 * @requires ../conectionPool/conectionPool
 */

// ============================================================================
// CONSTANTES Y CONFIGURACIÓN
// ============================================================================





/**
 * Configuración del módulo de cron jobs
 * @constant {Object}
 */
const CONFIG = {
    CRON_SCHEDULE: "0 14 * * *", // Ejecuta todos los días a las 2:00 PM
    TIMEZONE: 'America/Costa_Rica',
    LOCALE: 'es-CR',
    DB_ENVIRONMENT: "produccion",
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 5000,
    ATTENTION_ALERT_MANAGEMENT_RECIPIENTS: [
        "ccordoba@roccacr.com",
        "fmata@roccacr.com",
    ],

    // Filtros de consulta
    LEAD_ACTIONS: { NUEVA: 0, SEGUIMIENTO: 2 },
    LEAD_STATUS: { ACTIVO: 1 },
    LEAD_TRACKING_TYPE: '01-LEAD-INTERESADO',

    // Umbrales de alertas por cantidad de leads
    ALERT_THRESHOLDS: {
        OK: 10,        // Menor a 10 leads = ok (verde)
        WARNING: 20    // Entre 10-19 = warning (amarillo), 20+ = danger (rojo)
    },
    ATTENTION_ALERT_THRESHOLD: 50
};

/**
 * Métricas de ejecución del cron job
 * @type {Object}
 */
const metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    lastExecutionTime: null,
    lastExecutionDuration: 0,
    lastError: null,
    leadsProcessedTotal: 0
};

/**
 * Instancia del cron job (permite control del ciclo de vida)
 * @type {cron.ScheduledTask|null}
 */
let cronJobInstance = null;

/**
 * Estado de ejecución del cron
 * @type {boolean}
 */
let isRunning = false;

/**
 * Transporter de nodemailer para envío de correos
 * Usa la misma configuración que sendMailer.js
 */
const emailTransporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.API_NOTIFICATION_EMAIL,
        pass: process.env.API_SECURITY_PREFIX
    }
});

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Obtiene la fecha y hora actual formateada para Costa Rica
 *
 * @returns {string} Fecha y hora en formato local 'DD/MM/YYYY, HH:MM:SS'
 *
 * @example
 * obtenerFechaHoraActual(); // "27/01/2026, 14:30:45"
 */
const obtenerFechaHoraActual = () => {
    return new Date().toLocaleString(CONFIG.LOCALE, {
        timeZone: CONFIG.TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

/**
 * Registra un mensaje en consola con timestamp y nivel de log
 *
 * @param {string} level - Nivel de log: 'INFO', 'WARN', 'ERROR'
 * @param {string} message - Mensaje a registrar
 * @param {Object} [data] - Datos adicionales opcionales
 */
const log = (level, message, data = null) => {
    const timestamp = obtenerFechaHoraActual();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    switch (level) {
        case 'ERROR':
            console.error(logMessage, data || '');
            break;
        case 'WARN':
            console.warn(logMessage, data || '');
            break;
        case 'INFO':
        default:
            // Logging deshabilitado
            break;
    }
};

/**
 * Implementa una espera asíncrona (delay)
 *
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Clasifica el estado de alerta según la cantidad de leads del vendedor
 *
 * Lógica de clasificación:
 * - Menos de 10 leads: "ok" (OK - Verde) ✓
 * - Entre 10 y 19 leads: "warning" (ROJO) ⚠
 * - 20 o más leads: "danger" (ALERTA - Rojo intenso) 🔴
 *
 * @param {number} cantidadLeads - Cantidad de leads del vendedor
 * @returns {string} Estado: "ok" | "warning" | "danger"
 */
const clasificarEstadoAlerta = (cantidadLeads) => {
    const cantidad = parseInt(cantidadLeads, 10);

    if (cantidad < CONFIG.ALERT_THRESHOLDS.OK) return "ok";
    if (cantidad < CONFIG.ALERT_THRESHOLDS.WARNING) return "warning";
    return "danger";
};

/**
 * Genera el HTML del reporte de leads para enviar por correo
 * Solo muestra vendedores con estado ALERTA (20+ leads)
 *
 * @param {Array<Object>} vendedores - Array de vendedores con sus leads
 * @param {Object} estadisticas - Estadísticas generales
 * @returns {string} HTML formateado del reporte
 */
const generarHTMLReporte = (vendedores, estadisticas) => {
    const fecha = obtenerFechaHoraActual();

    // Filtrar solo vendedores con estado ALERTA (20+ leads)
    const vendedoresAlerta = vendedores.filter(v => v.estado_alerta === 'danger');
    const totalLeadsAlerta = vendedoresAlerta.reduce((sum, v) => sum + parseInt(v.cantidad_leads, 10), 0);

    const filasVendedores = vendedoresAlerta.map((v, i) => {
        const linkLeads = `https://crm.roccacr.com/leads/lista?data=2&vendedor=${v.id_empleado_lead}`;

        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 16px; text-align: center; color: #6b7280; font-size: 14px; font-weight: 500;">${i + 1}</td>
                <td style="padding: 16px;">
                    <span style="display: inline-block; padding: 6px 14px; background: #fee2e2; color: #991b1b; border-radius: 4px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ALERTA
                    </span>
                </td>
                <td style="padding: 16px; color: #111827; font-size: 14px; font-weight: 500;">${v.vendedor_nombre}</td>
                <td style="padding: 16px; text-align: center; color: #991b1b; font-weight: 700; font-size: 16px;">
                    ${v.cantidad_leads}
                </td>
                <td style="padding: 16px; text-align: center;">
                    <a href="${linkLeads}"
                       style="display: inline-block; padding: 8px 20px; background: #1f2937; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 13px; transition: background-color 0.2s;">
                        Ver
                    </a>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table role="presentation" style="max-width: 700px; width: 100%; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
                            
                            <!-- Header -->
                            <tr>
                                <td style="background: #1f2937; padding: 32px 40px; text-align: left;">
                                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td>
                                                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">
                                                    Reporte de Alerta - Carga de Leads
                                                </h1>
                                                <p style="margin: 8px 0 0 0; color: #d1d5db; font-size: 14px; font-weight: 400;">
                                                    Sistema CRM Ventas - ROCCA
                                                </p>
                                            </td>
                                            <td align="right" style="vertical-align: top;">
                                                <p style="margin: 0; color: #9ca3af; font-size: 12px; font-weight: 400;">
                                                    ${fecha}
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Resumen Ejecutivo -->
                            <tr>
                                <td style="padding: 32px 40px; background: #fef2f2; border-bottom: 2px solid #fecaca;">
                                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="text-align: center; padding-bottom: 20px;">
                                                <div style="display: inline-block; background: #ffffff; padding: 24px 32px; border-radius: 8px; border: 1px solid #fecaca; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                                    <div style="font-size: 42px; font-weight: 700; color: #991b1b; margin-bottom: 8px; line-height: 1;">
                                                        ${estadisticas.danger}
                                                    </div>
                                                    <div style="color: #7f1d1d; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                                                        Vendedor(es) Requieren Atención
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="text-align: center;">
                                                <div style="display: inline-block; padding: 16px 24px; background: #ffffff; border-radius: 6px; border: 1px solid #fecaca;">
                                                    <span style="color: #4b5563; font-size: 13px; font-weight: 500;">
                                                        Total de Leads en Alerta:
                                                    </span>
                                                    <strong style="color: #991b1b; font-size: 20px; font-weight: 700; margin-left: 8px;">
                                                        ${totalLeadsAlerta}
                                                    </strong>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Tabla de Vendedores -->
                            <tr>
                                <td style="padding: 32px 40px;">
                                    <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 600; letter-spacing: -0.3px;">
                                        Vendedores con Alta Carga de Leads (≥ 20)
                                    </h2>
                                    <table role="presentation" style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                                        <thead>
                                            <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                                <th style="padding: 14px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; width: 8%;">#</th>
                                                <th style="padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; width: 15%;">Estado</th>
                                                <th style="padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; width: 37%;">Vendedor</th>
                                                <th style="padding: 14px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; width: 20%;">Cantidad Leads</th>
                                                <th style="padding: 14px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; width: 20%;">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${filasVendedores}
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style="padding: 24px 40px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
                                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="text-align: center;">
                                                <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 400; line-height: 1.6;">
                                                    Este es un correo automático generado por el Sistema CRM Ventas de ROCCA
                                                </p>
                                                <p style="margin: 6px 0 0 0; color: #9ca3af; font-size: 11px; font-weight: 400;">
                                                    ${process.env.API_SECURITY_PREFIX || 'Sistema de Gestión de Leads'}
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
};

/**
 * Envía el reporte de leads por correo electrónico
 *
 * @param {Array<Object>} vendedores - Array de vendedores con sus leads
 * @param {Object} estadisticas - Estadísticas generales del reporte
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarReportePorCorreo = async (vendedores, estadisticas) => {
    try {
        const htmlContent = generarHTMLReporte(vendedores, estadisticas);

        const destinatarios = 'rzuniga@roccacr.com, ccordoba@roccacr.com,fmata@roccacr.com ';

        const subject = `[ALERTA CRM] ${estadisticas.danger} Vendedor(es) con Alta Carga de Leads (${estadisticas.danger > 1 ? '20+ leads cada uno' : '20+ leads'})`;

        const mailOptions = {
            from: `"ROCCA CRM" <${process.env.API_NOTIFICATION_EMAIL}>`,
            to: destinatarios,
            subject: subject,
            html: htmlContent
        };

        const info = await emailTransporter.sendMail(mailOptions);

        log('INFO', `✉ Correo enviado exitosamente a: ${destinatarios}`);

        return {
            success: true,
            messageId: info.messageId,
            destinatarios: destinatarios
        };

    } catch (error) {
        log('ERROR', '✉ Error al enviar correo', { error: error.message });
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Genera HTML de alerta de leads que requieren atención por asesor.
 *
 * @param {Object} asesor - Datos del asesor en alerta.
 * @returns {string} HTML del correo.
 */
const generarHTMLReporteAtencionPorAsesor = (asesor) => {
    const fecha = obtenerFechaHoraActual();
    const linkLeads = `https://crm.roccacr.com/leads/lista?data=3&vendedor=${asesor.id_empleado_lead}`;

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table role="presentation" style="max-width: 720px; width: 100%; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
                            <tr>
                                <td style="background: #1f2937; padding: 32px 40px; text-align: left;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">
                                        Alerta CRM - Leads Requieren Atención
                                    </h1>
                                    <p style="margin: 8px 0 0 0; color: #d1d5db; font-size: 14px; font-weight: 400;">
                                        Ejecución diaria de control comercial
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 32px 40px;">
                                    <p style="margin: 0 0 20px 0; color: #374151; font-size: 14px; line-height: 1.6;">
                                        Se detectó una acumulación alta de leads pendientes de seguimiento para un asesor.
                                        Este correo se envía al asesor correspondiente y en copia a la jefatura comercial.
                                    </p>

                                    <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                                        <tbody>
                                            <tr>
                                                <td style="padding: 14px 16px; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 34%;">Asesor</td>
                                                <td style="padding: 14px 16px; color: #111827; font-size: 14px; font-weight: 500;">${asesor.vendedor_nombre}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 14px 16px; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Correo futuro destino</td>
                                                <td style="padding: 14px 16px; color: #111827; font-size: 14px; font-weight: 500;">${asesor.vendedor_email || "No configurado"}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 14px 16px; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Jefatura detectada</td>
                                                <td style="padding: 14px 16px; color: #111827; font-size: 14px; font-weight: 500;">${asesor.supervisor_nombre || "No detectada"}${asesor.supervisor_email ? ` (${asesor.supervisor_email})` : ""}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 14px 16px; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Leads requieren atención</td>
                                                <td style="padding: 14px 16px; color: #991b1b; font-size: 28px; font-weight: 700;">${asesor.cantidad_leads}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 14px 16px; background: #f9fafb; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Fecha de corte</td>
                                                <td style="padding: 14px 16px; color: #111827; font-size: 14px; font-weight: 500;">${fecha}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 24px;">
                                        <tr>
                                            <td align="left">
                                                <a href="${linkLeads}" style="display: inline-block; padding: 10px 20px; background: #1f2937; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 13px;">
                                                    Ver leads requieren atención
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
};

/**
 * Envía alerta individual de requiere atención.
 *
 * @param {Object} asesor - Datos del asesor.
 * @returns {Promise<Object>} Resultado del envío.
 */
const enviarReporteAtencionPorAsesor = async (asesor) => {
    try {
        const htmlContent = generarHTMLReporteAtencionPorAsesor(asesor);
        const subject = `[ALERTA CRM] Requieren atención - ${asesor.vendedor_nombre} - ${asesor.cantidad_leads} leads`;
        const destinatarioAsesor = asesor.vendedor_email;

        if (!destinatarioAsesor) {
            throw new Error(`Asesor sin correo configurado: ${asesor.vendedor_nombre}`);
        }

        const info = await emailTransporter.sendMail({
            from: `"ROCCA CRM" <${process.env.API_NOTIFICATION_EMAIL}>`,
            to: destinatarioAsesor,
            cc: CONFIG.ATTENTION_ALERT_MANAGEMENT_RECIPIENTS.join(","),
            subject,
            html: htmlContent,
        });

        return {
            success: true,
            messageId: info.messageId,
            destinatarioAsesor,
            destinatariosJefatura: [...CONFIG.ATTENTION_ALERT_MANAGEMENT_RECIPIENTS],
        };
    } catch (error) {
        log('ERROR', 'Error enviando alerta de requiere atención', {
            asesor: asesor.vendedor_nombre,
            error: error.message,
        });

        return {
            success: false,
            error: error.message,
        };
    }
};

// ============================================================================
// CONSULTAS A BASE DE DATOS
// ============================================================================

/**
 * Consulta de SQL para contar leads interesados agrupados por vendedor
 * Utiliza parámetros preparados para prevenir SQL injection
 *
 * @constant {string}
 */
const QUERY_LEADS_INTERESADOS = `
    SELECT
        l.id_empleado_lead,
        a.name_admin  AS vendedor_nombre,
        a.email_admin AS vendedor_email,
        COUNT(l.id_lead) AS cantidad_leads
    FROM leads AS l
    INNER JOIN admins AS a
        ON a.idnetsuite_admin = l.id_empleado_lead
    WHERE l.accion_lead IN (?, ?)
        AND l.estado_lead = ?
        AND l.segimineto_lead = ?
    GROUP BY l.id_empleado_lead, a.name_admin, a.email_admin
    ORDER BY cantidad_leads DESC, a.name_admin ASC
`;

const QUERY_LEADS_REQUIEREN_ATENCION_POR_ASESOR = `
    SELECT
        l.id_empleado_lead,
        a.name_admin AS vendedor_nombre,
        a.email_admin AS vendedor_email,
        a.id_supervisor_admin,
        (
            SELECT s.name_admin
            FROM admins s
            WHERE s.id_admin = CAST(NULLIF(a.id_supervisor_admin, '') AS UNSIGNED)
               OR s.idnetsuite_admin = CAST(NULLIF(a.id_supervisor_admin, '') AS UNSIGNED)
            ORDER BY s.status_admin DESC, s.id_admin ASC
            LIMIT 1
        ) AS supervisor_nombre,
        (
            SELECT s.email_admin
            FROM admins s
            WHERE s.id_admin = CAST(NULLIF(a.id_supervisor_admin, '') AS UNSIGNED)
               OR s.idnetsuite_admin = CAST(NULLIF(a.id_supervisor_admin, '') AS UNSIGNED)
            ORDER BY s.status_admin DESC, s.id_admin ASC
            LIMIT 1
        ) AS supervisor_email,
        COUNT(DISTINCT l.idinterno_lead) AS cantidad_leads
    FROM leads AS l
    INNER JOIN admins AS a
        ON a.idnetsuite_admin = l.id_empleado_lead
    LEFT JOIN calendars c
        ON c.id_lead = l.idinterno_lead
        AND STR_TO_DATE(c.fechaIni_calendar, '%Y-%m-%dT%H:%i') >= l.actualizadaaccion_lead
        AND c.estado_calendar = 1
        AND c.accion_calendar = 'Pendiente'
    WHERE l.accion_lead = 6
        AND l.estado_lead = 1
        AND l.seguimiento_calendar = 0
        AND l.actualizadaaccion_lead <= DATE_SUB(CURDATE(), INTERVAL 4 DAY)
        AND l.segimineto_lead NOT IN (
            '02-LEAD-OPORTUNIDAD',
            '03-LEAD-PRE-RESERVA',
            '04-LEAD-RESERVA',
            '05-LEAD-CONTRATO',
            '06-LEAD-ENTREGADO'
        )
        AND c.id_calendar IS NULL
    GROUP BY
        l.id_empleado_lead,
        a.name_admin,
        a.email_admin,
        a.id_supervisor_admin
    HAVING COUNT(DISTINCT l.idinterno_lead) > ?
    ORDER BY cantidad_leads DESC, a.name_admin ASC
`;

/**
 * Consulta los leads interesados agrupados por vendedor con contador
 * Incluye retry logic automático ante fallos transitorios de conexión
 *
 * @async
 * @param {number} [retryCount=0] - Contador interno de reintentos
 * @returns {Promise<Array<Object>>} Array con vendedores y cantidad de leads
 * @throws {Error} Si falla después de agotar los reintentos
 */
const consultarLeadsInteresados = async (retryCount = 0) => {
    try {
        const params = [
            CONFIG.LEAD_ACTIONS.NUEVA,
            CONFIG.LEAD_ACTIONS.SEGUIMIENTO,
            CONFIG.LEAD_STATUS.ACTIVO,
            CONFIG.LEAD_TRACKING_TYPE
        ];

        const resultado = await executeQuery(
            QUERY_LEADS_INTERESADOS,
            params,
            CONFIG.DB_ENVIRONMENT
        );

        // executeQuery retorna { ok, statusCode, data }
        const datos = resultado?.data || resultado;

        if (!Array.isArray(datos)) {
            throw new Error('La consulta no retornó un array válido');
        }

        // Agregar clasificación de estado de alerta a cada vendedor
        return datos.map(vendedor => ({
            ...vendedor,
            estado_alerta: clasificarEstadoAlerta(vendedor.cantidad_leads)
        }));

    } catch (error) {
        // Reintentar solo si no se agotaron los intentos y no es un error de formato
        if (retryCount < CONFIG.MAX_RETRIES && !error.message.includes('array válido')) {
            log('WARN', `Error en consulta. Reintento ${retryCount + 1}/${CONFIG.MAX_RETRIES}`);
            await sleep(CONFIG.RETRY_DELAY_MS);
            return consultarLeadsInteresados(retryCount + 1);
        }

        log('ERROR', 'Error crítico en consulta de leads', { error: error.message });
        throw error;
    }
};

/**
 * Consulta asesores con exceso de leads en requiere atención.
 *
 * @param {number} [retryCount=0] - Contador de reintentos.
 * @returns {Promise<Array<Object>>} Asesores en alerta.
 */
const consultarLeadsAtencionPorAsesor = async (retryCount = 0) => {
    try {
        const resultado = await executeQuery(
            QUERY_LEADS_REQUIEREN_ATENCION_POR_ASESOR,
            [CONFIG.ATTENTION_ALERT_THRESHOLD],
            CONFIG.DB_ENVIRONMENT
        );

        const datos = resultado?.data || resultado;

        if (!Array.isArray(datos)) {
            throw new Error('La consulta de atención no retornó un array válido');
        }

        return datos;
    } catch (error) {
        if (retryCount < CONFIG.MAX_RETRIES && !error.message.includes('array válido')) {
            log('WARN', `Error en consulta de atención. Reintento ${retryCount + 1}/${CONFIG.MAX_RETRIES}`);
            await sleep(CONFIG.RETRY_DELAY_MS);
            return consultarLeadsAtencionPorAsesor(retryCount + 1);
        }

        log('ERROR', 'Error crítico en consulta de atención por asesor', { error: error.message });
        throw error;
    }
};

// ============================================================================
// LÓGICA DE NEGOCIO
// ============================================================================

/**
 * Procesa los leads interesados agrupados por vendedor
 * Calcula totales, clasifica alertas y genera reporte formateado
 *
 * @async
 * @returns {Promise<Object>} Resultado del procesamiento con estadísticas
 */
const procesarLeadsInteresados = async () => {
    const startTime = Date.now();

    try {
        const vendedores = await consultarLeadsInteresados();
        const totalLeads = vendedores.reduce((sum, v) => sum + parseInt(v.cantidad_leads, 10), 0);

        // Separar vendedores por estado de alerta
        const porEstado = {
            ok: vendedores.filter(v => v.estado_alerta === 'ok'),
            warning: vendedores.filter(v => v.estado_alerta === 'warning'),
            danger: vendedores.filter(v => v.estado_alerta === 'danger')
        };

        // Reporte procesado

        // Actualizar métricas
        metrics.leadsProcessedTotal += totalLeads;
        metrics.lastExecutionDuration = Date.now() - startTime;

        const resultado = {
            success: true,
            totalLeads,
            totalVendedores: vendedores.length,
            vendedores,
            estadisticas: {
                ok: porEstado.ok.length,
                warning: porEstado.warning.length,
                danger: porEstado.danger.length
            },
            duration: metrics.lastExecutionDuration
        };

        // Solo enviar correo si hay vendedores con 20 o más leads (estado ALERTA)
        if (porEstado.danger.length > 0) {
            log('INFO', `⚠ Detectados ${porEstado.danger.length} vendedor(es) con 20+ leads. Enviando correo de alerta...`);

            const emailResult = await enviarReportePorCorreo(
                vendedores,
                {
                    totalLeads,
                    totalVendedores: vendedores.length,
                    ok: porEstado.ok.length,
                    warning: porEstado.warning.length,
                    danger: porEstado.danger.length
                }
            );

            resultado.emailEnviado = emailResult.success;
            resultado.emailMessageId = emailResult.messageId;
        } else {
            log('INFO', `✓ No hay vendedores con 20+ leads. No se envía correo.`);
            resultado.emailEnviado = false;
            resultado.razon = 'No hay vendedores en estado ALERTA (20+ leads)';
        }

        return resultado;

    } catch (error) {
        metrics.lastExecutionDuration = Date.now() - startTime;
        throw error;
    }
};

/**
 * Procesa alertas diarias de requiere atención por asesor.
 *
 * @returns {Promise<Object>} Resumen de ejecución.
 */
const procesarLeadsAtencionPorAsesor = async () => {
    const startTime = Date.now();
    const asesores = await consultarLeadsAtencionPorAsesor();

    if (asesores.length === 0) {
        return {
            success: true,
            totalAsesores: 0,
            emailsEnviados: 0,
            duration: Date.now() - startTime,
            razon: `No hay asesores con más de ${CONFIG.ATTENTION_ALERT_THRESHOLD} leads en requiere atención`,
        };
    }

    const resultados = [];

    for (const asesor of asesores) {
        const envio = await enviarReporteAtencionPorAsesor(asesor);
        resultados.push({
            asesor: asesor.vendedor_nombre,
            cantidad_leads: asesor.cantidad_leads,
            ...envio,
        });
    }

    return {
        success: true,
        totalAsesores: asesores.length,
        emailsEnviados: resultados.filter((item) => item.success).length,
        asesores,
        resultados,
        duration: Date.now() - startTime,
    };
};


// ============================================================================
// CONTROL DEL CRON JOB
// ============================================================================

/**
 * Ejecuta el procesamiento del cron job
 * Previene ejecuciones concurrentes y registra métricas
 *
 * @async
 * @returns {Promise<void>}
 */
const ejecutarCronJob = async () => {
    if (isRunning) {
        log('WARN', 'Cron job ya en ejecución, se omite esta iteración');
        return;
    }

    isRunning = true;
    metrics.totalExecutions++;
    metrics.lastExecutionTime = new Date();

    try {
        const resultado = await procesarLeadsInteresados();
        const resultadoAtencion = await procesarLeadsAtencionPorAsesor();

        metrics.successfulExecutions++;
        metrics.lastError = null;

        log('INFO', `Ejecutado exitosamente - ${resultado.totalLeads} leads procesados en ${resultado.duration}ms`);
        log('INFO', `Atención ejecutado - ${resultadoAtencion.totalAsesores} asesor(es) en alerta, ${resultadoAtencion.emailsEnviados} correo(s) enviados`);

    } catch (error) {
        metrics.failedExecutions++;
        metrics.lastError = { message: error.message, timestamp: new Date() };

        log('ERROR', 'Error en ejecución de cron job', { error: error.message });

    } finally {
        isRunning = false;
    }
};

/**
 * Inicia el cron job de procesamiento de leads
 */
const iniciar = () => {
    if (cronJobInstance) {
        throw new Error('El cron job ya está iniciado');
    }

    log('INFO', `Iniciando cron job con schedule: ${CONFIG.CRON_SCHEDULE}`);
    cronJobInstance = cron.schedule(CONFIG.CRON_SCHEDULE, ejecutarCronJob, {
        timezone: CONFIG.TIMEZONE
    });
    log('INFO', 'Cron job iniciado exitosamente');

    return cronJobInstance;
};

/**
 * Detiene el cron job de procesamiento de leads
 */
const detener = () => {
    if (!cronJobInstance) {
        log('WARN', 'El cron job no está iniciado');
        return false;
    }

    log('INFO', 'Deteniendo cron job...');
    cronJobInstance.stop();
    cronJobInstance = null;
    log('INFO', 'Cron job detenido');
    return true;
};

/**
 * Obtiene el estado actual y métricas del cron job
 */
const obtenerEstado = () => ({
    isActive: cronJobInstance !== null,
    isRunning,
    metrics: { ...metrics },
    config: { schedule: CONFIG.CRON_SCHEDULE, timezone: CONFIG.TIMEZONE }
});

/**
 * Reinicia el cron job
 */
const reiniciar = () => {
    log('INFO', 'Reiniciando cron job...');
    detener();
    return iniciar();
};

/**
 * Ejecuta manualmente el procesamiento (útil para testing)
 */
const ejecutarManualmente = async () => {
    log('INFO', 'Ejecución manual iniciada');
    const interesados = await procesarLeadsInteresados();
    const atencion = await procesarLeadsAtencionPorAsesor();

    return {
        interesados,
        atencion,
    };
};

// ============================================================================
// EXPORTACIÓN
// ============================================================================

const cronsLeads = {
    iniciar,
    detener,
    reiniciar,
    obtenerEstado,
    obtenerMetricas: () => ({ ...metrics }),
    ejecutarManualmente,
    getConfig: () => ({ ...CONFIG })
};

// Auto-inicio del cron job al cargar el módulo
iniciar();

module.exports = cronsLeads;
