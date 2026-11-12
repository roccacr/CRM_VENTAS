/** Escenarios ficticios compartidos por Inicio, bandejas y orden; nunca son datos del API. */
export const FORMALIZATION_EXAMPLES = [
    { id: "DEMO-OV-103", client: "Cliente de ejemplo C", project: "AVIVA", unit: "DEMO-AV-032", stage: "Gestión bancaria", state: "Crédito en proceso", days: 18, owner: "Gestor de ejemplo 1", blocker: "Respuesta de la entidad bancaria", next: "Dar seguimiento al asesor bancario", contract: "Firmado", bank: "Banco de ejemplo · Asesor asignado", financial: "Pendiente de consulta", event: "Gestor de ejemplo 1 inició la gestión bancaria", time: "10:20" },
    { id: "DEMO-OV-102", client: "Cliente de ejemplo B", project: "Andira", unit: "DEMO-AN-014", stage: "Contratos", state: "Pendiente de firma", days: 12, owner: "Gestor de ejemplo 2", blocker: "Devolución del contrato firmado", next: "Contactar al cliente por la firma", contract: "Enviado · Pendiente de firma", bank: "Aún no habilitada", financial: "Pendiente de consulta", event: "Gestor de ejemplo 2 registró el envío del contrato", time: "09:45" },
    { id: "DEMO-OV-104", client: "Cliente de ejemplo D", project: "Amara", unit: "DEMO-AM-041", stage: "Pendientes de saldo", state: "Saldo pendiente", days: 9, owner: "Gestor de ejemplo 1", blocker: "Condición financiera pendiente", next: "Revisar la condición financiera", contract: "Firmado", bank: "No aplica · Recursos propios", financial: "Saldo pendiente · Ejemplo, sin consulta a NetSuite", event: "Gestor de ejemplo 1 registró la firma del contrato", time: "09:10" },
    { id: "DEMO-OV-105", client: "Cliente de ejemplo E", project: "AVIVA", unit: "DEMO-AV-056", stage: "Traspasos", state: "Pendiente de traspaso", days: 6, owner: "Gestor de ejemplo 2", blocker: "Registro del traspaso", next: "Coordinar y registrar el traspaso", contract: "Firmado", bank: "Formalizado", financial: "Cancelado · Escenario ficticio", event: "Gestor de ejemplo 2 completó la gestión bancaria", time: "08:40" },
    { id: "DEMO-OV-101", client: "Cliente de ejemplo A", project: "Amara", unit: "DEMO-AM-008", stage: "Contratos", state: "Contrato por adjuntar", days: 3, owner: "Sin asignar", blocker: "Contrato adjunto pendiente", next: "Asignar responsable y adjuntar contrato", contract: "No adjunto · Envío bloqueado", bank: "Aún no habilitada", financial: "Pendiente de consulta", event: "La orden ingresó tras la aprobación de Jefatura y RDR", time: "08:15" },
] as const;

export interface FormalizationExample {
    readonly approvalPending?: boolean;
    readonly id: string;
    readonly client: string;
    readonly project: string;
    readonly unit: string;
    readonly stage: "Contratos" | "Gestión bancaria" | "Pendientes de saldo" | "Traspasos" | "Por cerrar" | "Cerradas" | "Fase posterior";
    readonly state: string;
    readonly days: number;
    readonly owner: string;
    readonly blocker: string;
    readonly next: string;
    readonly contract: string;
    readonly bank: string;
    readonly financial: string;
    readonly event: string;
    readonly time: string;
}
export const PREVIEW_PROJECTS = ["Amara", "Andira", "AVIVA"] as const;
export const PREVIEW_OWNERS = ["Gestor de ejemplo 1", "Gestor de ejemplo 2", "Sin asignar"] as const;
export const isUnassigned = (item: FormalizationExample): boolean => item.owner === "Sin asignar";
export const formatOrderTotal = (total: number): string => `${String(total)} ${total === 1 ? "orden" : "órdenes"}`;
export const PREVIEW_FILTER_TITLES = {
    approvals: "Pendientes de aprobación",
    addendum: "Pendientes de adéndum",
    all: "Todas las órdenes",
    contracts: "Contratos pendientes",
    send: "Contratos por enviar",
    signature: "Contratos pendientes de firma",
    bank: "Gestión bancaria",
    balance: "Pendientes de saldo",
    transfer: "Traspasos pendientes",
    signed: "Traspaso firmado",
    closed: "Formalizaciones cerradas este año",
    finiquito_validation: "Validación de saldo",
    finiquito_pending: "Finiquito pendiente",
    finiquito_signed: "Finiquito firmado",
    finiquito_formalized: "Formalizada",
} as const;
export type PreviewFilter = keyof typeof PREVIEW_FILTER_TITLES;
export interface PreviewQueue {
    readonly filter: PreviewFilter;
    readonly project?: string;
}

/** Firmados es transversal; las bandejas se recalculan desde el escenario local. */
export function matchesPreviewFilter(item: FormalizationExample, filter: PreviewFilter): boolean {
    if (filter === "addendum" || filter.startsWith("finiquito_")) return false;
    const matches: Partial<Record<PreviewFilter, boolean>> = {
        approvals: item.approvalPending === true,
        all: true,
        contracts: item.stage === "Contratos",
        send: item.stage === "Contratos" && item.contract !== "Enviado · Pendiente de firma",
        signature: item.contract === "Enviado · Pendiente de firma",
        bank: item.stage === "Gestión bancaria",
        balance: item.stage === "Pendientes de saldo",
        transfer: item.stage === "Traspasos",
        signed: item.contract === "Firmado",
        closed: item.stage === "Cerradas",
    };
    return matches[filter] ?? false;
}
