const normalizeIntegerValue = (value, fallback = 0) => {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

/**
 * Reglas de visibilidad pactadas para eventos.
 *
 * - Directores: ven todos los eventos de admins activos.
 * - Supervisor: ve eventos de asesores activos y los propios.
 * - Asesores: solo ven sus propios eventos.
 *
 * No usamos `id_rol_admin` ni `id_supervisor_admin` porque la estructura actual
 * en BD no representa correctamente esta jerarquía de negocio.
 */
const EVENT_DIRECTOR_ADMIN_IDS = [252150, 653055];
const EVENT_SUPERVISOR_ADMIN_IDS = [2146844];

const ACTIVE_DEDUPED_ADMINS_SUBQUERY = `
    SELECT admin_rows.*
    FROM admins AS admin_rows
    INNER JOIN (
        SELECT
            idnetsuite_admin,
            MIN(id_admin) AS canonical_admin_id
        FROM admins
        WHERE status_admin = 1
        GROUP BY idnetsuite_admin
    ) AS canonical_admin
        ON canonical_admin.canonical_admin_id = admin_rows.id_admin
    WHERE admin_rows.status_admin = 1
`;

const isDirectorEventAdmin = (adminId) => (
    EVENT_DIRECTOR_ADMIN_IDS.includes(normalizeIntegerValue(adminId, 0))
);

const isSupervisorEventAdmin = (adminId) => (
    EVENT_SUPERVISOR_ADMIN_IDS.includes(normalizeIntegerValue(adminId, 0))
);

/**
 * Construye el alcance visible de admins para eventos.
 *
 * Siempre opera solo con admins activos (`status_admin = 1`).
 *
 * @param {number|string|null|undefined} currentAdminId - ID NetSuite autenticado.
 * @returns {{ cteSql: string, params: number[], predicateSql: (fieldName: string) => string }}
 */
const buildCalendarVisibilityScope = (currentAdminId) => {
    const normalizedAdminId = normalizeIntegerValue(currentAdminId, 0);
    const activeAdminsCte = `
        WITH active_admin_scope AS (
            ${ACTIVE_DEDUPED_ADMINS_SUBQUERY}
        )
    `;

    if (isDirectorEventAdmin(normalizedAdminId)) {
        return {
            cteSql: activeAdminsCte,
            params: [],
            predicateSql: (fieldName) => `${fieldName} IN (SELECT idnetsuite_admin FROM active_admin_scope)`,
        };
    }

    if (isSupervisorEventAdmin(normalizedAdminId)) {
        const directorsCsv = EVENT_DIRECTOR_ADMIN_IDS.join(", ");

        return {
            cteSql: activeAdminsCte,
            params: [],
            predicateSql: (fieldName) => `
                ${fieldName} IN (
                    SELECT idnetsuite_admin
                    FROM active_admin_scope
                    WHERE idnetsuite_admin NOT IN (${directorsCsv})
                )
            `,
        };
    }

    return {
        cteSql: activeAdminsCte,
        params: [normalizedAdminId],
        predicateSql: (fieldName) => `
            ${fieldName} IN (
                SELECT idnetsuite_admin
                FROM active_admin_scope
                WHERE idnetsuite_admin = ?
            )
        `,
    };
};

module.exports = {
    ACTIVE_DEDUPED_ADMINS_SUBQUERY,
    EVENT_DIRECTOR_ADMIN_IDS,
    EVENT_SUPERVISOR_ADMIN_IDS,
    buildCalendarVisibilityScope,
    isDirectorEventAdmin,
    isSupervisorEventAdmin,
    normalizeIntegerValue,
};
