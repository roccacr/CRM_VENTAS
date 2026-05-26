const cron = require("node-cron");
const { executeQuery } = require("../conectionPool/conectionPool");
const {
    buildExpiredLessProbableSelectionQuery,
    buildInactivateOpportunitiesByIdsQuery,
    supportsLessProbableTrackingColumn,
} = require("./lessProbableTracking");

const CONFIG = {
    CRON_SCHEDULE: "0 1 * * *",
    TIMEZONE: "America/Costa_Rica",
    DB_ENVIRONMENT: "produccion",
    LESS_PROBABLE_MONTHS_THRESHOLD: 3,
};

const metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    lastExecutionTime: null,
    lastExecutionDuration: 0,
    lastError: null,
    lastInactivatedCount: 0,
};

let cronJobInstance = null;
let isRunning = false;
let warnedMissingTrackingColumn = false;

/**
 * Devuelve timestamp local de Costa Rica para logging.
 *
 * @returns {string} Fecha local formateada.
 */
const getCostaRicaTimestamp = () =>
    new Date().toLocaleString("es-CR", {
        timeZone: CONFIG.TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

/**
 * Logging mínimo del cron.
 *
 * @param {"INFO"|"WARN"|"ERROR"} level - Nivel de severidad.
 * @param {string} message - Mensaje a registrar.
 * @param {Object} [data] - Datos opcionales.
 */
const log = (level, message, data = null) => {
    if (level === "INFO") {
        return;
    }

    const payload = data ? [data] : [];
    const method = level === "ERROR" ? console.error : console.warn;
    method(`[${getCostaRicaTimestamp()}] [${level}] ${message}`, ...payload);
};

/**
 * Inactiva oportunidades menos probables vencidas.
 *
 * @returns {Promise<{inactivatedCount: number, opportunityIds: number[]}>} Resultado de la ejecución.
 */
const inactivateExpiredLessProbableOpportunities = async () => {
    const supportsTrackingColumn = await supportsLessProbableTrackingColumn(CONFIG.DB_ENVIRONMENT);

    if (!supportsTrackingColumn) {
        if (!warnedMissingTrackingColumn) {
            warnedMissingTrackingColumn = true;
            log(
                "WARN",
                "Cron de oportunidades omitido: falta columna fecha_menos_probable_oport. Aplique script SQL antes de activar esta regla.",
            );
        }

        return { inactivatedCount: 0, opportunityIds: [] };
    }

    warnedMissingTrackingColumn = false;

    const expiredOpportunitiesResult = await executeQuery(
        buildExpiredLessProbableSelectionQuery(CONFIG.LESS_PROBABLE_MONTHS_THRESHOLD),
        [],
        CONFIG.DB_ENVIRONMENT,
    );

    if (!expiredOpportunitiesResult?.ok) {
        throw new Error(expiredOpportunitiesResult?.error || "No se pudieron consultar las oportunidades menos probables vencidas.");
    }

    const opportunityIds = (expiredOpportunitiesResult.data || []).map(
        ({ id_oportunidad_oport }) => id_oportunidad_oport,
    );

    if (!opportunityIds.length) {
        return { inactivatedCount: 0, opportunityIds: [] };
    }

    const { query, params } = buildInactivateOpportunitiesByIdsQuery(opportunityIds);
    const updateResult = await executeQuery(query, params, CONFIG.DB_ENVIRONMENT);

    if (!updateResult?.ok) {
        throw new Error(updateResult?.error || "No se pudieron inactivar las oportunidades menos probables vencidas.");
    }

    return {
        inactivatedCount: opportunityIds.length,
        opportunityIds,
    };
};

/**
 * Ejecuta una iteración del cron con control de concurrencia.
 *
 * @returns {Promise<void>}
 */
const runCronJob = async () => {
    if (isRunning) {
        log("WARN", "Cron de oportunidades ya está ejecutándose. Se omite iteración.");
        return;
    }

    isRunning = true;
    metrics.totalExecutions += 1;
    metrics.lastExecutionTime = new Date();

    const startTime = Date.now();

    try {
        const result = await inactivateExpiredLessProbableOpportunities();
        metrics.successfulExecutions += 1;
        metrics.lastError = null;
        metrics.lastInactivatedCount = result.inactivatedCount;
        metrics.lastExecutionDuration = Date.now() - startTime;

        if (result.inactivatedCount > 0) {
            log("WARN", "Oportunidades menos probables inactivadas por antigüedad.", {
                inactivatedCount: result.inactivatedCount,
                opportunityIds: result.opportunityIds,
            });
        }
    } catch (error) {
        metrics.failedExecutions += 1;
        metrics.lastExecutionDuration = Date.now() - startTime;
        metrics.lastError = { message: error.message, timestamp: new Date() };
        log("ERROR", "Error en cron de oportunidades menos probables.", { error: error.message });
    } finally {
        isRunning = false;
    }
};

/**
 * Inicia el cron si todavía no existe instancia activa.
 *
 * @returns {cron.ScheduledTask} Instancia creada.
 */
const iniciar = () => {
    if (cronJobInstance) {
        return cronJobInstance;
    }

    cronJobInstance = cron.schedule(CONFIG.CRON_SCHEDULE, runCronJob, {
        timezone: CONFIG.TIMEZONE,
    });

    return cronJobInstance;
};

/**
 * Permite ejecutar lógica manualmente para pruebas controladas.
 *
 * @returns {Promise<{inactivatedCount: number, opportunityIds: number[]}>} Resultado de la ejecución manual.
 */
const ejecutarManualmente = async () => inactivateExpiredLessProbableOpportunities();

iniciar();

module.exports = {
    ejecutarManualmente,
    getConfig: () => ({ ...CONFIG }),
    getMetrics: () => ({ ...metrics }),
    iniciar,
};
