const COSTA_RICA_UTC_OFFSET = "-06:00";
const HISTORY_TABLE_NAME = "oportunidades_historial_estado";
const TRACEABILITY_COLUMNS = [
    "fecha_inactivacion_oport",
    "id_usuario_inactivo_oport",
    "tipo_actor_inactivacion_oport",
    "fuente_inactivacion_oport",
    "detalle_inactivacion_oport",
    "fecha_reactivacion_oport",
    "id_usuario_reactivo_oport",
    "tipo_actor_reactivacion_oport",
    "fuente_reactivacion_oport",
    "detalle_reactivacion_oport",
    "duracion_ultima_inactividad_seg_oport",
];
const TRACEABILITY_SUPPORT_CACHE = new Map();
const HISTORY_TABLE_SUPPORT_CACHE = new Map();

/**
 * Normaliza el tipo de actor que ejecuta el cambio.
 *
 * @param {string | null | undefined} actorType - Tipo de actor recibido.
 * @returns {string} Tipo de actor normalizado.
 */
const normalizeActorType = (actorType) => {
    const normalized = String(actorType || "").trim().toUpperCase();

    if (["USUARIO", "SISTEMA", "CRON", "BACKFILL"].includes(normalized)) {
        return normalized;
    }

    return "SISTEMA";
};

/**
 * Normaliza la fuente del cambio para auditoría.
 *
 * @param {string | null | undefined} source - Fuente reportada por el flujo.
 * @returns {string} Fuente normalizada.
 */
const normalizeSource = (source) => String(source || "SISTEMA").trim().toUpperCase() || "SISTEMA";

/**
 * Genera motivo por defecto para reactivaciones cuando el flujo no envía uno.
 *
 * @param {string} actorType - Tipo de actor.
 * @returns {string} Motivo de reactivación.
 */
const getActivationReason = (actorType) => {
    if (actorType === "CRON") {
        return "REACTIVACION_CRON";
    }

    if (actorType === "USUARIO") {
        return "REACTIVACION_MANUAL";
    }

    return "REACTIVACION_SISTEMA";
};

/**
 * Verifica si la tabla oportunidades ya tiene todas las columnas de trazabilidad.
 *
 * @param {object} connection - Conexión activa MySQL.
 * @returns {Promise<boolean>} True cuando todas existen.
 */
const supportsTraceabilityColumns = async (connection) => {
    const cacheKey = connection.config.database;

    if (TRACEABILITY_SUPPORT_CACHE.has(cacheKey)) {
        return TRACEABILITY_SUPPORT_CACHE.get(cacheKey);
    }

    const placeholders = TRACEABILITY_COLUMNS.map(() => "?").join(", ");
    const [rows] = await connection.execute(
        `
            SELECT COUNT(*) AS total
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'oportunidades'
              AND COLUMN_NAME IN (${placeholders})
        `,
        TRACEABILITY_COLUMNS,
    );
    const supportsColumns = Number(rows?.[0]?.total || 0) === TRACEABILITY_COLUMNS.length;
    TRACEABILITY_SUPPORT_CACHE.set(cacheKey, supportsColumns);

    return supportsColumns;
};

/**
 * Verifica si la tabla de historial ya existe.
 *
 * @param {object} connection - Conexión activa MySQL.
 * @returns {Promise<boolean>} True si la tabla existe.
 */
const supportsHistoryTable = async (connection) => {
    const cacheKey = connection.config.database;

    if (HISTORY_TABLE_SUPPORT_CACHE.has(cacheKey)) {
        return HISTORY_TABLE_SUPPORT_CACHE.get(cacheKey);
    }

    const [rows] = await connection.execute(
        `
            SELECT 1 AS table_exists
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            LIMIT 1
        `,
        [HISTORY_TABLE_NAME],
    );
    const hasTable = Boolean(rows?.length);
    HISTORY_TABLE_SUPPORT_CACHE.set(cacheKey, hasTable);

    return hasTable;
};

/**
 * Construye detalle legible para bitácora de lead.
 *
 * @param {object} params - Datos del evento.
 * @param {string | null} params.tranid - Código visible de oportunidad.
 * @param {number} params.nextStatus - Estado nuevo.
 * @param {string | null} params.reason - Motivo de negocio.
 * @param {string | null} params.detail - Detalle adicional.
 * @returns {string} Texto humano.
 */
const buildLeadBitacoraDetail = ({ tranid, nextStatus, reason, detail, actorType, actorId }) => {
    const code = tranid ? `#${tranid}` : "sin código";
    const action = Number(nextStatus) === 0 ? "inactivada" : "reactivada";
    const reasonText = reason ? ` Motivo: ${reason}.` : "";
    const actorText = actorType
        ? ` Actor: ${actorType}${actorId ? ` #${actorId}` : ""}.`
        : "";
    const detailText = detail ? ` Detalle: ${detail}.` : "";

    return `Oportunidad ${code} ${action}.${reasonText}${actorText}${detailText}`.trim();
};

/**
 * Inserta evento técnico/humano en bitácora de lead.
 *
 * @param {object} connection - Conexión activa MySQL.
 * @param {object} params - Datos del evento.
 * @returns {Promise<void>}
 */
const insertLeadBitacoraEntry = async (connection, params) => {
    if (!params.leadId) {
        return;
    }

    const estadoBit = Number(params.nextStatus) === 0 ? "09-OPORTUNIDAD-INACTIVA" : "10-OPORTUNIDAD-REACTIVADA";
    const detail = buildLeadBitacoraDetail(params);

    await connection.execute(
        `
            INSERT INTO bitacoras (
                id_lead_bit,
                id_admin_bit,
                id_caida_bit,
                detalle_bit,
                tipo_documento_bit,
                estado_bit,
                estado_lead,
                fech_seg_bit
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, '')
        `,
        [
            params.leadId,
            params.actorId || 0,
            -1,
            detail,
            "oportunidad",
            estadoBit,
            params.leadStatus ?? 1,
        ],
    );
};

/**
 * Inserta fila de historial append-only.
 *
 * @param {object} connection - Conexión activa MySQL.
 * @param {object} params - Datos del evento.
 * @returns {Promise<void>}
 */
const insertHistoryEntry = async (connection, params) => {
    const hasHistoryTable = await supportsHistoryTable(connection);

    if (!hasHistoryTable) {
        return;
    }

    await connection.execute(
        `
            INSERT INTO ${HISTORY_TABLE_NAME} (
                id_oportunidad_oport,
                id_oport,
                id_lead_oport,
                tranid_oport,
                estado_anterior_oport,
                estado_nuevo_oport,
                motivo_oport,
                detalle_oport,
                id_usuario_actor_oport,
                tipo_actor_oport,
                fuente_oport,
                fecha_inicio_inactividad_oport,
                fecha_fin_inactividad_oport,
                duracion_inactividad_seg_oport
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            params.opportunityId,
            params.localOpportunityId,
            params.leadId,
            params.tranid,
            params.previousStatus,
            params.nextStatus,
            params.reason,
            params.detail,
            params.actorId,
            params.actorType,
            params.source,
            params.inactiveStartAt,
            params.inactiveEndAt,
            params.inactiveDurationSeconds,
        ],
    );
};

/**
 * Obtiene fila base de la oportunidad antes del cambio.
 *
 * @param {object} connection - Conexión activa MySQL.
 * @param {number} opportunityId - ID interno Netsuite de oportunidad.
 * @returns {Promise<object | null>} Fila encontrada.
 */
const getOpportunityRow = async (connection, opportunityId) => {
    const [rows] = await connection.execute(
        `
            SELECT
                o.id_oport,
                o.id_oportunidad_oport,
                o.entity_oport,
                o.tranid_oport,
                o.estatus_oport,
                o.motivo_inactivacion_oport,
                o.fecha_inactivacion_oport,
                l.estado_lead
            FROM oportunidades o
            LEFT JOIN leads l ON l.idinterno_lead = o.entity_oport
            WHERE o.id_oportunidad_oport = ?
            LIMIT 1
        `,
        [opportunityId],
    );

    return rows?.[0] || null;
};

/**
 * Obtiene snapshot mínimo después de actualizar para reutilizar timestamps reales de BD.
 *
 * @param {object} connection - Conexión activa MySQL.
 * @param {number} opportunityId - ID interno Netsuite de oportunidad.
 * @returns {Promise<object | null>} Snapshot mínimo.
 */
const getOpportunityTraceabilitySnapshot = async (connection, opportunityId) => {
    const [rows] = await connection.execute(
        `
            SELECT
                fecha_inactivacion_oport,
                fecha_reactivacion_oport,
                duracion_ultima_inactividad_seg_oport
            FROM oportunidades
            WHERE id_oportunidad_oport = ?
            LIMIT 1
        `,
        [opportunityId],
    );

    return rows?.[0] || null;
};

/**
 * Aplica transición de estado con snapshot, historial y bitácora.
 *
 * @param {object} connection - Conexión activa MySQL.
 * @param {object} params - Datos de transición.
 * @returns {Promise<object>} Resultado estructurado.
 */
const applyOpportunityStatusTransition = async (connection, params) => {
    const currentRow = await getOpportunityRow(connection, params.opportunityId);

    if (!currentRow) {
        throw new Error(`No se encontró la oportunidad ${params.opportunityId}.`);
    }

    const nextStatus = Number(params.nextStatus);
    const previousStatus = Number(currentRow.estatus_oport || 0);
    const actorType = normalizeActorType(params.actorType);
    const actorId = params.actorId ? Number(params.actorId) : null;
    const source = normalizeSource(params.source);
    const supportsColumns = await supportsTraceabilityColumns(connection);
    const reason = nextStatus === 0
        ? String(params.reason || "SISTEMA_OTRO").trim()
        : String(params.reason || getActivationReason(actorType)).trim();
    const detail = params.detail ? String(params.detail).trim() : null;

    if (previousStatus === nextStatus) {
        return {
            changed: false,
            opportunityId: currentRow.id_oportunidad_oport,
            tranid: currentRow.tranid_oport,
            leadId: currentRow.entity_oport,
        };
    }

    if (nextStatus === 0) {
        if (supportsColumns) {
            await connection.execute(
                `
                    UPDATE oportunidades
                    SET
                        estatus_oport = 0,
                        motivo_inactivacion_oport = ?,
                        fecha_inactivacion_oport = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '${COSTA_RICA_UTC_OFFSET}'),
                        id_usuario_inactivo_oport = ?,
                        tipo_actor_inactivacion_oport = ?,
                        fuente_inactivacion_oport = ?,
                        detalle_inactivacion_oport = ?,
                        fecha_reactivacion_oport = NULL,
                        id_usuario_reactivo_oport = NULL,
                        tipo_actor_reactivacion_oport = NULL,
                        fuente_reactivacion_oport = NULL,
                        detalle_reactivacion_oport = NULL,
                        duracion_ultima_inactividad_seg_oport = NULL
                    WHERE id_oportunidad_oport = ?
                `,
                [reason, actorId, actorType, source, detail, params.opportunityId],
            );
        } else {
            await connection.execute(
                "UPDATE oportunidades SET estatus_oport = 0, motivo_inactivacion_oport = ? WHERE id_oportunidad_oport = ?",
                [reason, params.opportunityId],
            );
        }
        const snapshotRow = supportsColumns
            ? await getOpportunityTraceabilitySnapshot(connection, params.opportunityId)
            : null;

        await insertHistoryEntry(connection, {
            opportunityId: currentRow.id_oportunidad_oport,
            localOpportunityId: currentRow.id_oport,
            leadId: currentRow.entity_oport,
            tranid: currentRow.tranid_oport,
            previousStatus,
            nextStatus,
            reason,
            detail,
            actorId,
            actorType,
            source,
            inactiveStartAt: snapshotRow?.fecha_inactivacion_oport || null,
            inactiveEndAt: null,
            inactiveDurationSeconds: null,
        });

        await insertLeadBitacoraEntry(connection, {
            leadId: currentRow.entity_oport,
            leadStatus: currentRow.estado_lead,
            tranid: currentRow.tranid_oport,
            nextStatus,
            reason,
            detail,
            actorId,
            actorType,
        });
    } else {
        let durationSeconds = null;

        if (supportsColumns && currentRow.fecha_inactivacion_oport) {
            const startDate = new Date(currentRow.fecha_inactivacion_oport);

            if (!Number.isNaN(startDate.getTime())) {
                durationSeconds = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 1000));
            }
        }

        if (supportsColumns) {
            await connection.execute(
                `
                    UPDATE oportunidades
                    SET
                        estatus_oport = 1,
                        motivo_inactivacion_oport = NULL,
                        fecha_inactivacion_oport = NULL,
                        id_usuario_inactivo_oport = NULL,
                        tipo_actor_inactivacion_oport = NULL,
                        fuente_inactivacion_oport = NULL,
                        detalle_inactivacion_oport = NULL,
                        fecha_reactivacion_oport = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '${COSTA_RICA_UTC_OFFSET}'),
                        id_usuario_reactivo_oport = ?,
                        tipo_actor_reactivacion_oport = ?,
                        fuente_reactivacion_oport = ?,
                        detalle_reactivacion_oport = ?,
                        duracion_ultima_inactividad_seg_oport = ?
                    WHERE id_oportunidad_oport = ?
                `,
                [actorId, actorType, source, detail, durationSeconds, params.opportunityId],
            );
        } else {
            await connection.execute(
                "UPDATE oportunidades SET estatus_oport = 1 WHERE id_oportunidad_oport = ?",
                [params.opportunityId],
            );
        }
        const snapshotRow = supportsColumns
            ? await getOpportunityTraceabilitySnapshot(connection, params.opportunityId)
            : null;

        await insertHistoryEntry(connection, {
            opportunityId: currentRow.id_oportunidad_oport,
            localOpportunityId: currentRow.id_oport,
            leadId: currentRow.entity_oport,
            tranid: currentRow.tranid_oport,
            previousStatus,
            nextStatus,
            reason,
            detail,
            actorId,
            actorType,
            source,
            inactiveStartAt: currentRow.fecha_inactivacion_oport || null,
            inactiveEndAt: snapshotRow?.fecha_reactivacion_oport || null,
            inactiveDurationSeconds: snapshotRow?.duracion_ultima_inactividad_seg_oport ?? durationSeconds,
        });

        await insertLeadBitacoraEntry(connection, {
            leadId: currentRow.entity_oport,
            leadStatus: currentRow.estado_lead,
            tranid: currentRow.tranid_oport,
            nextStatus,
            reason,
            detail,
            actorId,
            actorType,
        });
    }

    return {
        changed: true,
        opportunityId: currentRow.id_oportunidad_oport,
        tranid: currentRow.tranid_oport,
        leadId: currentRow.entity_oport,
        previousStatus,
        nextStatus,
        reason,
        actorType,
        source,
    };
};

/**
 * Inactiva todas las oportunidades activas de un lead usando misma tubería de auditoría.
 *
 * @param {object} connection - Conexión activa MySQL.
 * @param {object} params - Parámetros de actualización.
 * @returns {Promise<object[]>} Resultados por oportunidad.
 */
const inactivateLeadOpportunitiesWithTraceability = async (connection, params) => {
    const [rows] = await connection.execute(
        `
            SELECT id_oportunidad_oport
            FROM oportunidades
            WHERE entity_oport = ?
              AND estatus_oport = 1
        `,
        [params.leadId],
    );
    const results = [];

    for (const row of rows) {
        const result = await applyOpportunityStatusTransition(connection, {
            opportunityId: row.id_oportunidad_oport,
            nextStatus: 0,
            reason: params.reason,
            actorId: params.actorId,
            actorType: params.actorType,
            source: params.source,
            detail: params.detail,
        });
        results.push(result);
    }

    return results;
};

/**
 * Convierte duración en segundos a texto legible.
 *
 * @param {number | null} seconds - Duración total.
 * @returns {string | null} Etiqueta legible.
 */
const formatDurationLabel = (seconds) => {
    if (!Number.isFinite(Number(seconds))) {
        return null;
    }

    const totalSeconds = Math.max(0, Number(seconds));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts = [];

    if (days) {
        parts.push(`${days}d`);
    }

    if (hours) {
        parts.push(`${hours}h`);
    }

    if (minutes || !parts.length) {
        parts.push(`${minutes}m`);
    }

    return parts.join(" ");
};

module.exports = {
    HISTORY_TABLE_NAME,
    TRACEABILITY_COLUMNS,
    applyOpportunityStatusTransition,
    formatDurationLabel,
    getActivationReason,
    inactivateLeadOpportunitiesWithTraceability,
    normalizeActorType,
    normalizeSource,
    supportsHistoryTable,
    supportsTraceabilityColumns,
};
