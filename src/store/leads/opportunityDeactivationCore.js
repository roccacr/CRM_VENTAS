/**
 * Ejecuta la inactivacion de oportunidades asociadas a un lead.
 *
 * @param {Function} requestInactivation - Funcion que realiza la solicitud al backend.
 * @param {number} leadId - ID del lead cuyas oportunidades deben pasar a inactivas.
 * @returns {Promise<Object>} Respuesta satisfactoria del backend.
 * @throws {Error} Cuando el backend no confirma la inactivacion.
 */
export const deactivateLeadOpportunities = async (requestInactivation, leadId) => {
    const response = await requestInactivation(leadId);

    if (!response?.ok) {
        throw new Error(response?.errorMessage || "No se pudieron inactivar las oportunidades del lead.");
    }

    return response;
};
