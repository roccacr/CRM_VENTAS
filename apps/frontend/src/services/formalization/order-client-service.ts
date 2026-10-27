import { getDatabaseOrder } from "./database-order-service";
import type { NetsuiteOrderIdentity } from "./netsuite-order-service";

export interface ClientField {
    readonly label: string;
    readonly value: string;
}
export interface OrderClientDetail {
    readonly name: string;
    readonly groups: readonly { readonly title: string; readonly fields: readonly ClientField[] }[];
    readonly warnings: readonly string[];
}
type Mapping = readonly [label: string, native: string, legacy: string];
const leadGroups: readonly { title: string; fields: readonly Mapping[] }[] = [
    {
        title: "Información comercial",
        fields: [
            ["Empresa", "company_name_lead", "empresa_lead"],
            ["Moneda", "currency_code_lead", "moneda_lead"],
            ["Proyecto", "", "proyecto_lead"],
            ["Referencia del proyecto", "project_id_lead", "idproyecto_lead"],
            ["Subsidiaria", "", "subsidiaria_lead"],
            ["Referencia de subsidiaria", "subsidiary_id_lead", "idsubsidaria_lead"],
            ["Vendedor (referencia)", "owner_user_id_lead", "id_empleado_lead"],
            ["Corredor (referencia)", "broker_id_lead", "id_corredor"],
            ["Interés", "interest_code_lead", "estadointeresado_lead"],
            ["Estado del lead", "status_code_lead", "estado_lead"],
            ["Estado del registro", "status_lead", ""],
            ["Comentario inicial", "initial_comment_lead", "comentario_lead"],
        ],
    },
    {
        title: "Captación y seguimiento",
        fields: [
            ["Origen", "source_code_lead", "referencia_lead"],
            ["Referencia de origen", "source_code_lead", "idreferencia_lead"],
            ["Campaña", "campaign_id_lead", "campana_lead"],
            ["Referencia de campaña", "campaign_id_lead", "idcampana_lead"],
            ["Anuncio", "ad_name_lead", ""],
            ["Acción de campaña (referencia de origen)", "", "custentityaccion_campana"],
            ["Contacto inicial registrado", "initial_contact_template_sent_lead", "whatsapp_template_contact_sent"],
            ["Leads relacionados", "has_related_lead_lead", ""],
            ["Acción registrada", "", "accion_lead"],
            ["Actualización de la acción", "", "actualizadaaccion_lead"],
            ["Seguimiento registrado", "", "segimineto_lead"],
            ["Valor de seguimiento", "", "valor_segimineto_lead"],
            ["Seguimiento de calendario", "", "seguimiento_calendar"],
            ["Contribución registrada", "", "contribucion_lead"],
            ["Referencia de caída", "", "id_Caida"],
        ],
    },
    {
        title: "Registro",
        fields: [
            ["Identificador interno del lead", "id_lead", "id_lead"],
            ["ID público del lead", "public_id_lead", ""],
            ["Contacto principal (referencia)", "primary_contact_id_lead", ""],
            ["Código", "", "codigo_lead"],
            ["Referencia externa del lead", "", "idinterno_lead"],
            ["Referencia adicional del lead", "", "idnetsuite_lead"],
            ["Creado", "created_at_lead", "creado_lead"],
            ["Actualizado", "updated_at_lead", "actualizado_lead"],
            ["Creación en origen", "source_created_at_lead", ""],
            ["Actualización en origen", "source_updated_at_lead", ""],
            ["Inactivado", "inactivated_at_lead", ""],
            ["Eliminado", "deleted_at_lead", ""],
            ["Versión", "version_lead", ""],
            ["Creado por (referencia)", "created_by_user_id_lead", ""],
            ["Administrador de origen (referencia)", "", "id_admin_lead"],
            ["Actualizado por (referencia)", "updated_by_user_id_lead", ""],
            ["Rol de origen (referencia)", "", "id_rol_lead"],
            ["Interés (referencia)", "interest_code_lead", "idestadointeresado_lead"],
        ],
    },
];
function text(value: unknown): string {
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return ["string", "number"].includes(typeof value) ? String(value).trim() || "Sin dato" : "Sin dato";
}
function fields(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
/** Read only the client related to an authorized order; never search another lead by matching its name. */
export async function getOrderClientDetail(identity: NetsuiteOrderIdentity): Promise<OrderClientDetail> {
    const data = await getDatabaseOrder(identity);
    const lead = fields(data.lead?.sourceFields);
    const contact = fields(data.contact?.sourceFields);
    const origin = data.source === "native" ? 1 : 2;
    const name = text(data.contact?.name);
    const groups = [
        {
            title: "Contacto",
            fields: [
                { label: "Nombre completo", value: name },
                { label: "Correo", value: text(data.contact?.email) },
                { label: "Teléfono", value: text(data.contact?.phone) },
                { label: "País (código)", value: text(contact.country_code_contact) },
                { label: "ID de contacto", value: text(data.contact?.id) },
                { label: "Referencia interna del contacto", value: text(contact.id_contact) },
                { label: "Estado del contacto", value: text(contact.status_contact) },
                { label: "Eliminación del contacto", value: text(contact.deleted_at_contact) },
                { label: "Creado", value: text(contact.created_at_contact) },
                { label: "Actualizado", value: text(contact.updated_at_contact) },
            ],
        },
        ...leadGroups.map((group) => ({ title: group.title, fields: group.fields.filter((field) => field[origin] !== "").map((field) => ({ label: field[0], value: text(lead[field[origin]]) })) })),
    ];
    return { name, groups, warnings: data.warnings.filter((warning) => /^(lead|contact):/.test(warning)) };
}
