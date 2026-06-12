const normalizeComparableId = (idValue) => {
    const parsedId = Number(idValue);

    return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
};

const normalizeComparableText = (textValue, fallback = "") => (
    typeof textValue === "string" && textValue.trim() ? textValue.trim() : fallback
);

/**
 * Valida si admin autenticado es dueño del evento CRM.
 *
 * @param {object|null|undefined} eventRecord - Registro obtenido desde DB.
 * @param {number|string|null|undefined} currentAdminId - ID NetSuite autenticado.
 * @returns {{ ok: boolean, statusCode: number, message: string, code: string, ownerName: string, ownerEmail: string }}
 */
const validateCrmCalendarOwnership = (eventRecord, currentAdminId) => {
    if (!eventRecord) {
        return {
            ok: false,
            statusCode: 404,
            message: "Evento no encontrado.",
            code: "EVENT_NOT_FOUND",
            ownerName: "",
            ownerEmail: "",
        };
    }

    const ownerId = normalizeComparableId(eventRecord.id_admin);
    const authenticatedAdminId = normalizeComparableId(currentAdminId);
    const ownerName = normalizeComparableText(eventRecord.name_admin, "otro usuario");
    const ownerEmail = normalizeComparableText(eventRecord.email_admin);

    if (ownerId === null || authenticatedAdminId === null || ownerId !== authenticatedAdminId) {
        return {
            ok: false,
            statusCode: 403,
            message: `Este evento no se puede mover porque pertenece a ${ownerName}.`,
            code: "EVENT_OWNER_MISMATCH",
            ownerName,
            ownerEmail,
        };
    }

    return {
        ok: true,
        statusCode: 200,
        message: "",
        code: "",
        ownerName,
        ownerEmail,
    };
};

module.exports = {
    normalizeComparableId,
    validateCrmCalendarOwnership,
};
