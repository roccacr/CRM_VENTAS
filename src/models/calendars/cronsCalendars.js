const cron = require("node-cron");
const calendars = require("./calendars");

const CONFIG = {
    // Ejecuta la limpieza una vez al día a las 6:00 AM de Costa Rica.
    CRON_SCHEDULE: "0 6 * * *",
    TIMEZONE: "America/Costa_Rica",
    DB_ENVIRONMENT: "produccion",
};

let cronJobInstance = null;
let isRunning = false;

const log = (level, message, data = null) => {
    const timestamp = new Date().toLocaleString("es-CR", {
        timeZone: CONFIG.TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    if (data) {
        console.log(`[CalendarsCron][${level}][${timestamp}] ${message}`, data);
        return;
    }

    console.log(`[CalendarsCron][${level}][${timestamp}] ${message}`);
};

const ejecutarCronJob = async () => {
    if (isRunning) {
        log("WARN", "Cron ya en ejecución, se omite esta iteración");
        return;
    }

    isRunning = true;

    try {
        log("INFO", "Iniciando cancelación automática de eventos vencidos");

        // Se reutiliza la lógica centralizada del modelo para que la regla de negocio
        // viva en un solo lugar y no se duplique entre cron y posibles ejecuciones manuales.
        const result = await calendars.cancelOverduePendingEvents({
            database: CONFIG.DB_ENVIRONMENT,
        });

        const affectedRows = result?.data?.affectedRows ?? 0;
        log("INFO", "Cancelación automática completada", { affectedRows });
    } catch (error) {
        log("ERROR", "Error en cancelación automática de eventos", { error: error.message });
    } finally {
        isRunning = false;
    }
};

const iniciarCronJob = () => {
    if (cronJobInstance) {
        return cronJobInstance;
    }

    log("INFO", `Iniciando cron de calendars con schedule ${CONFIG.CRON_SCHEDULE}`);

    cronJobInstance = cron.schedule(CONFIG.CRON_SCHEDULE, ejecutarCronJob, {
        timezone: CONFIG.TIMEZONE,
    });

    return cronJobInstance;
};

iniciarCronJob();

module.exports = {
    iniciarCronJob,
    ejecutarCronJob,
};
