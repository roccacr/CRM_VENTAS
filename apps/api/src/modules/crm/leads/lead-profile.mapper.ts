import type { LeadProfileField, LeadProfileSource } from "./lead-profile.contract.js";

const sections = [
    { title: "Datos generales", fields: { fullName: "Nombre completo", company: "Empresa", status: "Estado operativo", stage: "Etapa comercial", owner: "Responsable", project: "Proyecto", subsidiary: "Subsidiaria", currency: "Moneda", createdAt: "Creado", updatedAt: "Actualizado" } },
    { title: "Contacto", fields: { email: "Correo", phone: "Teléfono", countryCode: "Código de país", alternatePhone: "Teléfono alternativo", address: "Dirección", residenceZone: "Zona de residencia" } },
    {
        title: "Captación y seguimiento",
        fields: { campaign: "Campaña", ad: "Anuncio", acquisitionSource: "Origen de captación", interest: "Interés", comment: "Comentario inicial", followUp: "Seguimiento", followUpValue: "Valor de seguimiento", followUpReason: "Clasificación de seguimiento", broker: "Corredor", contribution: "Contribución", templateSent: "Plantilla de contacto enviada", relatedLead: "Tiene lead relacionado", action: "Última acción", actionAt: "Fecha de acción", calendarFollowUp: "Seguimiento en calendario" },
    },
    { title: "Perfil y calificación", fields: { identification: "Identificación", nationality: "Nacionalidad", maritalStatus: "Estado civil", age: "Edad", profession: "Profesión", children: "Hijos", income: "Ingresos", purchaseReason: "Motivo de compra", purchaseTiming: "Momento de compra", employment: "Trabajo", fundsOrigin: "Origen de fondos", buyerProfile: "Perfil del comprador", additionalInformation: "Información adicional" } },
    { title: "Persona adicional", fields: { relatedName: "Nombre", relatedIdentification: "Identificación", relatedProfession: "Profesión", relatedMaritalStatus: "Estado civil", relatedPhone: "Teléfono", relatedNationality: "Nacionalidad", relatedEmail: "Correo", relatedResidence: "Lugar de residencia" } },
    {
        title: "Identificadores y trazabilidad",
        fields: {
            localId: "ID local del lead",
            publicId: "ID público",
            externalReference: "Referencia externa",
            netsuiteId: "ID NetSuite",
            extraId: "ID información extra",
            extraLeadReference: "Referencia información extra",
            adminReference: "Administrador (referencia)",
            employeeReference: "Responsable (referencia)",
            roleReference: "Rol (referencia)",
            projectReference: "Proyecto (referencia)",
            subsidiaryReference: "Subsidiaria (referencia)",
            campaignReference: "Campaña (referencia)",
            interestReference: "Interés (referencia)",
            acquisitionReference: "Captación (referencia)",
            followUpReasonReference: "Clasificación (referencia)",
            brokerReference: "Corredor (referencia)",
            contactReference: "Contacto (referencia)",
            version: "Versión",
            sourceCreatedAt: "Creado en origen",
            sourceUpdatedAt: "Actualizado en origen",
            createdByReference: "Creado por (referencia)",
            updatedByReference: "Actualizado por (referencia)",
            inactivatedAt: "Inactivado",
        },
    },
] as const;

/** Nativo prevalece cuando está informado; se conserva el valor antiguo distinto para revisión. */
export function buildLeadProfile(native: LeadProfileSource | null, legacy: LeadProfileSource | null) {
    const primary = native ?? legacy;
    if (!primary) throw new Error("Se requiere una identidad resuelta.");
    return {
        schemaVersion: 1 as const,
        observedAt: new Date().toISOString(),
        id: primary.id,
        source: primary.source,
        sources: [native, legacy].filter((entry): entry is LeadProfileSource => entry !== null).map((entry) => entry.source),
        sections: sections.map((section) => ({
            title: section.title,
            fields: Object.entries(section.fields).map(([code, label]) => mergeField(code, label, native?.values ?? {}, legacy?.values ?? {})),
        })),
    };
}

/** El sistema anterior guarda el estado civil como código; ambas bases se muestran con el mismo nombre. */
const MARITAL_STATUS: Readonly<Record<string, string>> = { "0": "No definido", "1": "Casado/a", "2": "Soltero/a", "3": "Unión libre", "4": "Viudo/a", "5": "Divorciado/a" };
const MARITAL_CODES = new Set(["maritalStatus", "relatedMaritalStatus"]);
const named = (code: string, value: string | null): string | null => (value !== null && MARITAL_CODES.has(code) ? (MARITAL_STATUS[value] ?? value) : value);

function mergeField(code: string, label: string, native: LeadProfileSource["values"], legacy: LeadProfileSource["values"]): LeadProfileField {
    const current = named(code, presentValue(native[code]));
    const old = named(code, presentValue(legacy[code]));
    const source = current === null ? "legacy" : "native";
    const value = current ?? old;
    return { code, label, value, source: value === null ? null : source, legacyValue: current && old && current !== old ? old : null };
}

function presentValue(value: string | null | undefined): string | null {
    return value?.trim() || null;
}
