import { type ClientHistoryPage, getDatabaseOrder } from "./database-order-service";
import type { NetsuiteOrderIdentity } from "./netsuite-order-service";

export interface ClientField {
    readonly label: string;
    readonly value: string;
}
export interface OrderClientDetail {
    readonly history?: ClientHistoryPage | null;
    readonly name: string;
    readonly groups: readonly { readonly title: string; readonly fields: readonly ClientField[] }[];
    readonly warnings: readonly string[];
}
type Mapping = readonly [label: string, native: string, legacy: string];
/** Only what the person who opens the order needs to know about the client; the rest of the lead stays in its own module. */
const leadGroups: readonly { title: string; fields: readonly Mapping[] }[] = [
    {
        title: "Información comercial",
        fields: [
            ["Proyecto", "", "proyecto_lead"],
            ["Subsidiaria", "", "subsidiaria_lead"],
        ],
    },
    {
        title: "Captación y seguimiento",
        fields: [
            ["Campaña", "campaign_id_lead", "campana_lead"],
            ["Anuncio", "ad_name_lead", ""],
            ["Seguimiento registrado", "", "segimineto_lead"],
        ],
    },
];
const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
function text(value: unknown): string {
    if (typeof value === "boolean") return value ? "Sí" : "No";
    const shown = ["string", "number"].includes(typeof value) ? String(value).trim() : "";
    if (!shown) return "Sin dato";
    const moment = ISO_MOMENT.test(shown) ? new Date(shown) : null;
    return moment && !Number.isNaN(moment.getTime()) ? moment.toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" }) : shown;
}
function fields(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
/** Read only the client related to an authorized order; never search another lead by matching its name. */
export async function getOrderClientDetail(identity: NetsuiteOrderIdentity, historyCursor?: string): Promise<OrderClientDetail> {
    const data = await getDatabaseOrder(identity, historyCursor);
    const lead = fields(data.lead?.sourceFields);
    const origin = data.source === "native" ? 1 : 2;
    const name = text(data.contact?.name);
    const groups = [
        {
            title: "Contacto",
            fields: [
                { label: "Nombre completo", value: name },
                { label: "Correo", value: text(data.contact?.email) },
                { label: "Teléfono", value: text(data.contact?.phone) },
            ],
        },
        ...leadGroups.map((group) => ({ title: group.title, fields: group.fields.filter((field) => field[origin] !== "").map((field) => ({ label: field[0], value: text(lead[field[origin]]) })) })),
    ];
    addLeadContext(groups, data.lead);
    return { name, groups, history: data.clientHistory ?? null, warnings: data.warnings.filter((warning) => /^(lead|contact):/.test(warning)) };
}

function addLeadContext(groups: { title: string; fields: ClientField[] }[], lead: Record<string, unknown> | null) {
    const commercial = groups.find((group) => group.title === "Información comercial");
    commercial?.fields.push({ label: "Estado del lead", value: text(fields(lead?.status).label) });
    const capture = groups.find((group) => group.title === "Captación y seguimiento");
    capture?.fields.push({ label: "Clasificación de seguimiento", value: text(fields(lead?.followUpReason).name) });
}
