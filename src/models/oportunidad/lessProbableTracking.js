const { executeQuery } = require("../conectionPool/conectionPool");

const LESS_PROBABLE_TRACKING_COLUMN = "fecha_menos_probable_oport";
const INACTIVATION_REASON_COLUMN = "motivo_inactivacion_oport";
const COSTA_RICA_UTC_OFFSET = "-06:00";
const TRACKING_COLUMN_SUPPORT_CACHE = new Map();
const INACTIVATION_REASON_COLUMN_SUPPORT_CACHE = new Map();

/**
 * Construye la consulta para actualizar la probabilidad de una oportunidad.
 *
 * @param {boolean} supportsTrackingColumn - Indica si la BD ya tiene la columna de rastreo.
 * @returns {string} Consulta SQL lista para ejecutar.
 */
const buildUpdateOpportunityProbabilityQuery = (supportsTrackingColumn) => {
    if (!supportsTrackingColumn) {
        return "UPDATE oportunidades SET chek_oport = ?, chek2_oport = ? WHERE id_oportunidad_oport = ?";
    }

    return `
        UPDATE oportunidades
        SET
            chek_oport = ?,
            chek2_oport = ?,
            fecha_menos_probable_oport = CASE
                WHEN ? = 0 THEN CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '${COSTA_RICA_UTC_OFFSET}')
                ELSE NULL
            END
        WHERE id_oportunidad_oport = ?
    `;
};

/**
 * Construye los parámetros necesarios para actualizar la probabilidad.
 *
 * @param {number} probabilidad - Valor nuevo de chek_oport.
 * @param {number} idOportunidad - ID de la oportunidad.
 * @param {boolean} supportsTrackingColumn - Indica si la BD ya tiene la columna de rastreo.
 * @returns {Array<number>} Parámetros para la consulta.
 */
const buildUpdateOpportunityProbabilityParams = (probabilidad, idOportunidad, supportsTrackingColumn) => {
    if (!supportsTrackingColumn) {
        return [probabilidad, 1, idOportunidad];
    }

    return [probabilidad, 1, probabilidad, idOportunidad];
};

/**
 * Construye la consulta para seleccionar oportunidades menos probables vencidas.
 *
 * @param {number} monthsThreshold - Cantidad de meses que deben cumplirse.
 * @returns {string} Consulta SQL de selección.
 */
const buildExpiredLessProbableSelectionQuery = (monthsThreshold) => `
    SELECT id_oportunidad_oport
    FROM oportunidades
    WHERE estatus_oport = 1
      AND chek_oport = 0
      AND ${LESS_PROBABLE_TRACKING_COLUMN} IS NOT NULL
      AND ${LESS_PROBABLE_TRACKING_COLUMN} <= DATE_SUB(
          CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '${COSTA_RICA_UTC_OFFSET}'),
          INTERVAL ${monthsThreshold} MONTH
      )
`;

/**
 * Construye la consulta para inactivar oportunidades por ID.
 *
 * @param {number[]} opportunityIds - IDs a inactivar.
 * @returns {{query: string, params: number[]}} Consulta y parámetros.
 */
const buildInactivateOpportunitiesByIdsQuery = (opportunityIds) => {
    const placeholders = opportunityIds.map(() => "?").join(", ");

    return {
        query: `UPDATE oportunidades SET estatus_oport = 0, ${INACTIVATION_REASON_COLUMN} = ? WHERE id_oportunidad_oport IN (${placeholders})`,
        params: ["MENOS_PROBABLE_3_MESES", ...opportunityIds],
    };
};

/**
 * Verifica si la BD ya tiene la columna de rastreo para menos probable.
 *
 * @param {string} database - Alias de base de datos configurado.
 * @param {boolean} [forceRefresh=false] - Ignora cache local cuando es true.
 * @returns {Promise<boolean>} True si la columna existe.
 */
const supportsLessProbableTrackingColumn = async (database, forceRefresh = false) => {
    if (!forceRefresh && TRACKING_COLUMN_SUPPORT_CACHE.has(database)) {
        return TRACKING_COLUMN_SUPPORT_CACHE.get(database);
    }

    const result = await executeQuery(
        `
            SELECT 1 AS column_exists
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'oportunidades'
              AND COLUMN_NAME = ?
            LIMIT 1
        `,
        [LESS_PROBABLE_TRACKING_COLUMN],
        database,
    );

    const hasColumn = Boolean(result?.ok && result?.data?.length);
    TRACKING_COLUMN_SUPPORT_CACHE.set(database, hasColumn);

    return hasColumn;
};

/**
 * Verifica si la BD ya tiene la columna de motivo de inactivación.
 *
 * @param {string} database - Alias de base de datos configurado.
 * @param {boolean} [forceRefresh=false] - Ignora cache local cuando es true.
 * @returns {Promise<boolean>} True si la columna existe.
 */
const supportsInactivationReasonColumn = async (database, forceRefresh = false) => {
    if (!forceRefresh && INACTIVATION_REASON_COLUMN_SUPPORT_CACHE.has(database)) {
        return INACTIVATION_REASON_COLUMN_SUPPORT_CACHE.get(database);
    }

    const result = await executeQuery(
        `
            SELECT 1 AS column_exists
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'oportunidades'
              AND COLUMN_NAME = ?
            LIMIT 1
        `,
        [INACTIVATION_REASON_COLUMN],
        database,
    );

    const hasColumn = Boolean(result?.ok && result?.data?.length);
    INACTIVATION_REASON_COLUMN_SUPPORT_CACHE.set(database, hasColumn);

    return hasColumn;
};

/**
 * Construye consulta para inactivar o reactivar manualmente una oportunidad.
 *
 * @param {boolean} supportsReasonColumn - Indica si la BD tiene columna de motivo.
 * @returns {string} Consulta SQL.
 */
const buildUpdateOpportunityStatusQuery = (supportsReasonColumn) => {
    if (!supportsReasonColumn) {
        return "UPDATE oportunidades SET estatus_oport = ? WHERE id_oportunidad_oport = ?";
    }

    return `
        UPDATE oportunidades
        SET
            estatus_oport = ?,
            ${INACTIVATION_REASON_COLUMN} = CASE
                WHEN ? = 0 THEN ?
                ELSE NULL
            END
        WHERE id_oportunidad_oport = ?
    `;
};

/**
 * Construye parámetros para actualizar estado manual.
 *
 * @param {number} estado - Nuevo estado de la oportunidad.
 * @param {number} idOportunidad - ID de la oportunidad.
 * @param {boolean} supportsReasonColumn - Indica si la BD tiene columna de motivo.
 * @param {string|null} [reasonWhenInactive=null] - Motivo cuando se inactiva.
 * @returns {Array<number|string|null>} Parámetros SQL.
 */
const buildUpdateOpportunityStatusParams = (estado, idOportunidad, supportsReasonColumn, reasonWhenInactive = null) => {
    if (!supportsReasonColumn) {
        return [estado, idOportunidad];
    }

    return [estado, estado, reasonWhenInactive, idOportunidad];
};

module.exports = {
    INACTIVATION_REASON_COLUMN,
    LESS_PROBABLE_TRACKING_COLUMN,
    buildExpiredLessProbableSelectionQuery,
    buildInactivateOpportunitiesByIdsQuery,
    buildUpdateOpportunityProbabilityParams,
    buildUpdateOpportunityProbabilityQuery,
    buildUpdateOpportunityStatusParams,
    buildUpdateOpportunityStatusQuery,
    supportsInactivationReasonColumn,
    supportsLessProbableTrackingColumn,
};
