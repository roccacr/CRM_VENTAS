const cron = require("node-cron");
const { handleDatabaseOperation } = require("../conectionPool/conectionPool");

const CONFIG = {
    CRON_SCHEDULE: "0 6 * * *",
    TIMEZONE: "America/Costa_Rica",
    DB_ENVIRONMENT: "produccion",
    THRESHOLD_DAYS: 7,
    ACTIVE_LEAD_STATUS: 1,
    NEW_LEAD_ACTIONS: [0, 2],
    NEW_TRACKING: "01-LEAD-INTERESADO",
    LOST_LEAD_STATUS: 0,
    LOST_LEAD_ACTION: 7,
    LOST_TRACKING: "07-LEAD-PERDIDO",
    LOST_TRACKING_VALUE: 7,
    LOSS_REASON_ID: 66,
    BITACORA_DETAIL: "Se paso a perdido automaticamente por falta de seguimiento durante mas de 7 dias en 01-LEAD-INTERESADO.",
    BITACORA_DOCUMENT_TYPE: "Perdida automatica por falta de seguimiento",
};

const metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    lastExecutionTime: null,
    lastExecutionDuration: 0,
    lastError: null,
    lastUpdatedCount: 0,
};

let cronJobInstance = null;
let isRunning = false;

const buildSelectExpiredNewLeadsQuery = () => `
    SELECT
        id_lead,
        idinterno_lead,
        id_empleado_lead
    FROM leads
    WHERE estado_lead = ?
        AND accion_lead IN (?, ?)
        AND segimineto_lead = ?
        AND creado_lead < DATE_SUB(NOW(), INTERVAL ? DAY)
    ORDER BY creado_lead ASC
    FOR UPDATE
`;

const UPDATE_EXPIRED_LEAD_TO_LOST_QUERY = `
    UPDATE leads
    SET
        estado_lead = ?,
        accion_lead = ?,
        actualizadaaccion_lead = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'),
        segimineto_lead = ?,
        id_Caida = ?,
        valor_segimineto_lead = ?
    WHERE id_lead = ?
        AND estado_lead = ?
        AND accion_lead IN (?, ?)
        AND segimineto_lead = ?
`;

const INSERT_AUTOMATIC_LOSS_BITACORA_QUERY = `
    INSERT INTO bitacoras (
        id_lead_bit,
        id_admin_bit,
        id_caida_bit,
        detalle_bit,
        tipo_documento_bit,
        estado_bit,
        estado_lead,
        fecha_creado_bit,
        fech_seg_bit
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), '')
`;

const getSelectParams = () => [
    CONFIG.ACTIVE_LEAD_STATUS,
    ...CONFIG.NEW_LEAD_ACTIONS,
    CONFIG.NEW_TRACKING,
    CONFIG.THRESHOLD_DAYS,
];

const getUpdateParams = (leadId) => [
    CONFIG.LOST_LEAD_STATUS,
    CONFIG.LOST_LEAD_ACTION,
    CONFIG.LOST_TRACKING,
    CONFIG.LOSS_REASON_ID,
    CONFIG.LOST_TRACKING_VALUE,
    leadId,
    CONFIG.ACTIVE_LEAD_STATUS,
    ...CONFIG.NEW_LEAD_ACTIONS,
    CONFIG.NEW_TRACKING,
];

const getBitacoraParams = (lead) => [
    lead.idinterno_lead,
    lead.id_empleado_lead,
    CONFIG.LOSS_REASON_ID,
    CONFIG.BITACORA_DETAIL,
    CONFIG.BITACORA_DOCUMENT_TYPE,
    CONFIG.LOST_TRACKING,
    CONFIG.ACTIVE_LEAD_STATUS,
];

const applyAutomaticLossForExpiredNewLeads = async (connection) => {
    const [expiredLeads] = await connection.execute(
        buildSelectExpiredNewLeadsQuery(),
        getSelectParams(),
    );

    const leadIds = [];

    for (const lead of expiredLeads) {
        const [updateResult] = await connection.execute(
            UPDATE_EXPIRED_LEAD_TO_LOST_QUERY,
            getUpdateParams(lead.id_lead),
        );

        if (Number(updateResult?.affectedRows || 0) !== 1) {
            continue;
        }

        await connection.execute(
            INSERT_AUTOMATIC_LOSS_BITACORA_QUERY,
            getBitacoraParams(lead),
        );
        leadIds.push(lead.idinterno_lead);
    }

    return {
        selectedCount: expiredLeads.length,
        updatedCount: leadIds.length,
        leadIds,
    };
};

const processAutomaticLossForExpiredNewLeads = async () =>
    handleDatabaseOperation(async (connection) => {
        const [timeZoneRows] = await connection.query("SELECT @@session.time_zone AS sessionTimeZone");
        const previousTimeZone = timeZoneRows?.[0]?.sessionTimeZone || "SYSTEM";

        await connection.query("SET time_zone = '-06:00'");
        await connection.beginTransaction();

        try {
            const result = await applyAutomaticLossForExpiredNewLeads(connection);
            await connection.commit();

            return {
                ok: true,
                statusCode: 200,
                data: result,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            await connection.query("SET time_zone = ?", [previousTimeZone]);
        }
    }, CONFIG.DB_ENVIRONMENT);

const runCronJob = async () => {
    if (isRunning) {
        return;
    }

    isRunning = true;
    metrics.totalExecutions += 1;
    metrics.lastExecutionTime = new Date();

    const startTime = Date.now();

    try {
        const result = await processAutomaticLossForExpiredNewLeads();

        if (!result?.ok) {
            throw new Error(result?.error || "No se pudo ejecutar la perdida automatica de leads.");
        }

        const updatedCount = Number(result?.data?.updatedCount || 0);

        metrics.successfulExecutions += 1;
        metrics.lastError = null;
        metrics.lastUpdatedCount = updatedCount;
        metrics.lastExecutionDuration = Date.now() - startTime;

    } catch (error) {
        metrics.failedExecutions += 1;
        metrics.lastExecutionDuration = Date.now() - startTime;
        metrics.lastError = { message: error.message, timestamp: new Date() };
    } finally {
        isRunning = false;
    }
};

const iniciar = () => {
    if (cronJobInstance) {
        return cronJobInstance;
    }

    cronJobInstance = cron.schedule(CONFIG.CRON_SCHEDULE, runCronJob, {
        timezone: CONFIG.TIMEZONE,
    });

    return cronJobInstance;
};

const ejecutarManualmente = async () => processAutomaticLossForExpiredNewLeads();

if (process.env.NODE_ENV !== "test") {
    iniciar();
}

module.exports = {
    CONFIG,
    applyAutomaticLossForExpiredNewLeads,
    buildSelectExpiredNewLeadsQuery,
    ejecutarManualmente,
    getConfig: () => ({ ...CONFIG }),
    getMetrics: () => ({ ...metrics }),
    iniciar,
};
