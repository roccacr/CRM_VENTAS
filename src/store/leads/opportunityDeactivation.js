import { inactivateOpportunitiesByLead } from "./Api_leads_Providers.js";
import { deactivateLeadOpportunities } from "./opportunityDeactivationCore.js";

/**
 * Inactiva las oportunidades activas asociadas a un lead usando el proveedor real.
 *
 * @param {number} leadId - ID del lead.
 * @returns {Promise<Object>} Respuesta satisfactoria del backend.
 */
export const ensureLeadOpportunitiesAreInactive = async (leadId) =>
    deactivateLeadOpportunities(inactivateOpportunitiesByLead, leadId);
