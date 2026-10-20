import type { FormalizationExample } from "./formalization-preview.model";

export type ScenarioAction = "assign" | "attach" | "document" | "send" | "sign" | "mode" | "bank" | "advisor" | "start" | "complete" | "finance" | "transfer" | "exception" | "close";
export type ScenarioValues = Readonly<Record<string, string>>;
export interface ScenarioEvent {
    readonly at: string;
    readonly action: string;
    readonly before: string;
    readonly after: string;
    readonly actor: string;
    readonly details?: string;
}
export interface FormalizationScenario {
    readonly owner: string;
    readonly documents: readonly { readonly name: string; readonly kind: string; readonly sample: boolean; readonly at: string }[];
    readonly document: string | null;
    readonly sampleDocument: boolean;
    readonly signedDocument: string | null;
    readonly contract: "pending" | "attached" | "sent" | "signed";
    readonly mode: "financed" | "own";
    readonly bank: string;
    readonly advisor: string;
    readonly advisorEmail: string;
    readonly credit: "Sin iniciar" | "En proceso" | "Formalizado" | "No aplica";
    readonly balance: "unknown" | "pending" | "paid";
    readonly transfer: "pending" | "done" | "requested" | "authorized";
    readonly closure: "open" | "closed" | "later";
    readonly stateLabel: string;
    readonly dates: Readonly<Record<string, string>>;
    readonly history: readonly ScenarioEvent[];
}

/** Estado de demostración, compartido en memoria; nunca se persiste fuera de React. */
export function createScenario(order: FormalizationExample): FormalizationScenario {
    const signed = order.contract === "Firmado";
    const own = order.id === "DEMO-OV-104";
    const credits: Record<string, FormalizationScenario["credit"]> = { "DEMO-OV-103": "En proceso", "DEMO-OV-104": "No aplica", "DEMO-OV-105": "Formalizado" };
    return {
        owner: order.owner,
        documents: initialDocuments(order),
        ...initialContract(order),
        mode: own ? "own" : "financed",
        ...initialBank(signed, own),
        credit: credits[order.id] ?? "Sin iniciar",
        balance: order.id === "DEMO-OV-105" ? "paid" : "unknown",
        transfer: "pending",
        closure: "open",
        stateLabel: order.state,
        dates: exampleDates[order.id] ?? {},
        history: [{ at: initialEventDates[order.id] ?? `14/10/2026, ${order.time}:00 · Ejemplo`, action: order.event, before: "Ingreso al escenario", after: order.state, actor: order.owner }],
    };
}

function initialDocuments(order: FormalizationExample): FormalizationScenario["documents"] {
    if (order.id === "DEMO-OV-101") return [];
    const contract = { name: `contrato-${order.id}.pdf`, kind: "Contrato", sample: true, at: "Referencia inicial · Ejemplo" };
    return order.contract === "Firmado" ? [contract, { ...contract, name: `firmado-${order.id}.pdf`, kind: "Contrato firmado" }] : [contract];
}

const exampleDates: Record<string, Readonly<Record<string, string>>> = {
    "DEMO-OV-103": { signed: "24/09/2026, 09:00:00 · Ejemplo", creditStarted: "26/09/2026, 10:20:00 · Ejemplo" },
    "DEMO-OV-105": { signed: "01/10/2026, 09:00:00 · Ejemplo", creditStarted: "03/10/2026, 09:00:00 · Ejemplo", creditCompleted: "08/10/2026, 09:00:00 · Ejemplo" },
};
const initialEventDates: Record<string, string> = { "DEMO-OV-103": "26/09/2026, 10:20:00 · Ejemplo", "DEMO-OV-105": "08/10/2026, 09:00:00 · Ejemplo" };

function initialBank(signed: boolean, own: boolean) {
    const applicable = signed && !own;
    return { bank: applicable ? "Banco de ejemplo A" : "", advisor: applicable ? "Asesor de ejemplo A" : "", advisorEmail: applicable ? "asesor@example.invalid" : "" };
}

function initialContract(order: FormalizationExample): Pick<FormalizationScenario, "document" | "sampleDocument" | "signedDocument" | "contract"> {
    const missing = order.id === "DEMO-OV-101";
    const signed = order.contract === "Firmado";
    return { document: missing ? null : `contrato-${order.id}.pdf`, sampleDocument: true, signedDocument: signed ? `firmado-${order.id}.pdf` : null, contract: missing ? "pending" : signed ? "signed" : "sent" };
}

const required = (values: ScenarioValues, key: string): string => {
    const value = values[key]?.trim();
    if (!value) throw new Error("Completa los campos obligatorios del ejemplo.");
    return value;
};

type Transition = (state: FormalizationScenario, values: ScenarioValues, at: string) => Partial<FormalizationScenario>;

const transitions: Record<Exclude<ScenarioAction, "document">, Transition> = {
    assign: (_s, v) => ({ owner: required(v, "owner") }),
    attach: (s, v, at) => {
        if (s.contract === "signed") throw new Error("La muestra ya tiene un contrato firmado.");
        return { document: required(v, "document"), sampleDocument: v.sample === "yes", contract: "attached", stateLabel: "Contrato adjunto · Por enviar", dates: { ...s.dates, attached: at } };
    },
    send: (s, v, at) => {
        if (!s.document || s.contract !== "attached") throw new Error("Adjunta el contrato antes de simular su envío.");
        required(v, "recipient");
        required(v, "subject");
        required(v, "message");
        return { contract: "sent", stateLabel: "Contrato enviado · Pendiente de firma", dates: { ...s.dates, sent: at } };
    },
    sign: (s, v, at) => {
        if (s.contract !== "sent") throw new Error("El ejemplo debe estar pendiente de firma.");
        return { contract: "signed", signedDocument: required(v, "document"), stateLabel: "Contrato firmado", dates: { ...s.dates, signed: at } };
    },
    mode: (s, v) => {
        const mode = required(v, "mode");
        if (mode !== "own" && mode !== "financed") throw new Error("Selecciona una modalidad válida.");
        if (mode === s.mode) return {};
        const dates = Object.fromEntries(Object.entries(s.dates).filter(([key]) => !["creditStarted", "creditCompleted"].includes(key)));
        return { mode, bank: "", advisor: "", advisorEmail: "", balance: "unknown", dates, credit: mode === "own" ? "No aplica" : "Sin iniciar", stateLabel: mode === "own" ? "Recursos propios" : "Financiamiento · Sin iniciar" };
    },
    bank: (_s, v) => ({ bank: required(v, "bank"), advisor: required(v, "advisor"), advisorEmail: v.email ?? "", stateLabel: "Banco y asesor seleccionados" }),
    advisor: (s, v) => {
        if (!s.bank) throw new Error("Selecciona primero el banco del asesor.");
        return { advisor: required(v, "advisor"), advisorEmail: required(v, "email"), stateLabel: "Otro asesor registrado" };
    },
    start: (s, _v, at) => {
        if (s.contract !== "signed" || s.mode !== "financed" || s.credit !== "Sin iniciar") throw new Error("Se requiere firma y crédito aplicable sin iniciar.");
        if (!s.bank || !s.advisor) throw new Error("Selecciona banco y asesor antes de iniciar.");
        return { credit: "En proceso", stateLabel: "Gestión bancaria en proceso", dates: { ...s.dates, creditStarted: at } };
    },
    complete: (s, _v, at) => {
        if (s.credit !== "En proceso") throw new Error("El crédito del ejemplo debe estar en proceso.");
        return { credit: "Formalizado", stateLabel: "Crédito formalizado", dates: { ...s.dates, creditCompleted: at } };
    },
    finance: (_s, v) => {
        const balance = required(v, "result");
        if (balance !== "unknown" && balance !== "pending" && balance !== "paid") throw new Error("Selecciona una condición de ejemplo.");
        return { balance, stateLabel: balance === "paid" ? "100% cancelado · Ejemplo" : "Condición financiera pendiente" };
    },
    transfer: (s, v, at) => {
        if (s.balance !== "paid" || s.contract !== "signed") throw new Error("El ejemplo requiere contrato firmado y cancelación total validada.");
        required(v, "document");
        return { transfer: "done", stateLabel: "Traspaso realizado", dates: { ...s.dates, transferred: at } };
    },
    exception: (_s, v) => {
        required(v, "reason");
        required(v, "authorizer");
        required(v, "document");
        if (v.result !== "requested" && v.result !== "authorized") throw new Error("Selecciona el escenario de excepción.");
        return { transfer: v.result, stateLabel: v.result === "authorized" ? "Traspaso pendiente autorizado · Ficticio" : "Excepción solicitada · Pendiente" };
    },
    close: (s, v, at) => {
        required(v, "reason");
        if (v.result === "later") return { closure: "later", stateLabel: "Pendiente por fase posterior", dates: { ...s.dates, closed: at } };
        if (v.result !== "closed" || (s.transfer !== "done" && s.transfer !== "authorized")) throw new Error("El cierre de ejemplo requiere traspaso o autorización ficticia previa.");
        return { closure: "closed", stateLabel: "Cerrado por Formalizaciones", dates: { ...s.dates, closed: at } };
    },
};

export const SCENARIO_ACTION_LABELS: Record<ScenarioAction, string> = {
    assign: "Asignar responsable",
    attach: "Adjuntar contrato",
    document: "Ver documento",
    send: "Enviar contrato",
    sign: "Contrato firmado",
    mode: "Cambiar modalidad de compra",
    bank: "Seleccionar banco y asesor",
    advisor: "Otro asesor",
    start: "Iniciar gestión bancaria",
    complete: "Marcar crédito como formalizado",
    finance: "Consultar condición financiera",
    transfer: "Traspaso realizado",
    exception: "Registrar excepción de traspaso",
    close: "Cerrar Formalización",
};

/** Transiciones para revisar pantallas y resultados ficticios, no reglas autorizantes de producción. */
export function applyScenarioAction(state: FormalizationScenario, action: ScenarioAction, values: ScenarioValues, at: string): FormalizationScenario {
    if (action === "document") return state;
    const reason = getScenarioActionReason(state, action);
    if (reason) throw new Error(reason);
    const next = { ...state, ...transitions[action](state, values, at) };
    const stateLabel = getScenarioFlow(next).label;
    const documents = appendDocument(next.documents, action, values, at);
    return { ...next, stateLabel, documents, history: [{ at, action: `${SCENARIO_ACTION_LABELS[action]} · Simulación`, before: state.stateLabel, after: stateLabel, actor: "Usuario de demostración", details: actionDetails(action, values) }, ...state.history] };
}

function appendDocument(documents: FormalizationScenario["documents"], action: ScenarioAction, values: ScenarioValues, at: string): FormalizationScenario["documents"] {
    const kinds: Partial<Record<ScenarioAction, string>> = { attach: "Contrato", sign: "Contrato firmado", transfer: "Respaldo de traspaso", exception: "Respaldo de excepción" };
    const kind = kinds[action];
    if (!kind || !values.document) return documents;
    return [...documents, { name: values.document, kind, sample: values.sample === "yes", at }];
}

const detailFields: Partial<Record<ScenarioAction, readonly string[]>> = {
    assign: ["owner"],
    attach: ["document"],
    sign: ["document"],
    send: ["recipient", "subject", "message"],
    bank: ["bank", "advisor"],
    advisor: ["advisor", "email", "phone"],
    exception: ["reason", "authorizer", "document"],
    close: ["reason"],
    transfer: ["document"],
};
const detailLabels: Record<string, string> = { owner: "Responsable", document: "Documento", recipient: "Destinatario", subject: "Asunto", message: "Mensaje", bank: "Banco", advisor: "Asesor", email: "Correo", phone: "Teléfono", reason: "Motivo", authorizer: "Responsable propuesto" };
function actionDetails(action: ScenarioAction, values: ScenarioValues): string {
    return (detailFields[action] ?? [])
        .filter((key) => Boolean(values[key]))
        .map((key) => `${detailLabels[key] ?? key}: ${values[key] ?? ""}`)
        .join(" · ");
}

export interface ScenarioFlow {
    readonly stage: FormalizationExample["stage"];
    readonly label: string;
    readonly action: ScenarioAction | null;
    readonly blocker: string;
    readonly step: number;
}

function creditFlow(s: FormalizationScenario): ScenarioFlow {
    if (s.credit === "En proceso") return { stage: "Gestión bancaria", label: "Crédito en proceso", action: "complete", blocker: "Respuesta y formalización de la entidad bancaria.", step: 2 };
    const selected = Boolean(s.bank && s.advisor);
    return { stage: "Gestión bancaria", label: "Crédito sin iniciar", action: selected ? "start" : "bank", blocker: selected ? "Iniciar la gestión del crédito." : "Seleccionar banco y asesor del mismo banco.", step: 2 };
}

/** Prioriza el pendiente operativo, no el nombre de la última acción ejecutada. */
export function getScenarioFlow(s: FormalizationScenario): ScenarioFlow {
    if (s.closure !== "open") return closureFlow(s);
    if (["done", "authorized"].includes(s.transfer)) return transferCompleteFlow(s);
    if (s.contract !== "signed") return contractFlow(s);
    if (s.mode === "financed" && s.credit !== "Formalizado") return creditFlow(s);
    if (s.transfer === "requested") return { stage: "Traspasos", label: "Excepción pendiente de autorización", action: "exception", blocker: "Revisión de la solicitud por el autorizante propuesto. No está autorizada.", step: 4 };
    if (s.balance !== "paid") return { stage: "Pendientes de saldo", label: "Condición financiera pendiente", action: "finance", blocker: "Consultar saldo o condición de avance. Sin registrar pagos.", step: 3 };
    return { stage: "Traspasos", label: "Pendiente de traspaso", action: "transfer", blocker: "Registrar el traspaso o revisar una excepción propuesta.", step: 4 };
}

function closureFlow(s: FormalizationScenario): ScenarioFlow {
    return s.closure === "closed" ? { stage: "Cerradas", label: "Cerrado por Formalizaciones", action: null, blocker: "Sin pendientes de esta fase. No equivale a entrega de llaves.", step: 5 } : { stage: "Fase posterior", label: "Pendiente por fase posterior", action: null, blocker: "Seguimiento a cargo de la fase posterior; no es entrega física.", step: 5 };
}

function transferCompleteFlow(s: FormalizationScenario): ScenarioFlow {
    return { stage: "Por cerrar", label: s.transfer === "done" ? "Traspaso realizado" : "Traspaso pendiente autorizado · Ficticio", action: "close", blocker: "Revisar el resultado propuesto de cierre.", step: 5 };
}

function contractFlow(s: FormalizationScenario): ScenarioFlow {
    const states = { pending: { label: "Contrato por adjuntar", action: "attach", blocker: "Adjuntar el contrato existente." }, attached: { label: "Contrato adjunto · Por enviar", action: "send", blocker: "Revisar destinatario, mensaje y adjunto." }, sent: { label: "Pendiente de firma", action: "sign", blocker: "Recibir y registrar el contrato firmado." } } as const;
    const state = states[s.contract === "signed" ? "sent" : s.contract];
    return { stage: "Contratos", ...state, ...(s.owner === "Sin asignar" ? { action: "assign" as const, blocker: "Asignar un responsable antes de continuar el seguimiento." } : {}), step: s.contract === "sent" ? 1 : 0 };
}

/** Motivos concretos compartidos por botones y transiciones de la maqueta, no permisos API. */
export function getScenarioActionReason(s: FormalizationScenario, action: ScenarioAction): string | null {
    if (action === "document") return s.documents.length ? null : "Primero adjunta un documento.";
    if (s.closure !== "open") return "Este escenario ya finalizó. Restablece el ejemplo para iniciar otro recorrido.";
    if (["mode", "bank", "advisor", "start", "complete", "attach", "send", "sign", "transfer", "exception"].includes(action) && s.transfer === "done") return "El traspaso ya está registrado; corresponde revisar el cierre.";
    return actionReasons(s)[action]?.() ?? null;
}

function actionReasons(s: FormalizationScenario): Partial<Record<ScenarioAction, () => string | null>> {
    const financed = s.contract === "signed" && s.mode === "financed";
    const ready = s.contract === "signed" && (s.mode === "own" || s.credit === "Formalizado");
    return {
        attach: () => (s.contract === "signed" ? "El contrato ya está firmado." : null),
        send: () => (s.contract !== "attached" ? "Adjunta un contrato pendiente de envío antes de enviarlo." : null),
        sign: () => (s.contract !== "sent" ? "Primero envía el contrato; la firma no se registra dos veces." : null),
        bank: () => (!financed ? "Requiere contrato firmado y modalidad financiada." : null),
        advisor: () => (!financed || !s.bank ? "Selecciona primero un banco para una compra financiada con contrato firmado." : null),
        start: () => creditStartReason(s),
        complete: () => (s.credit !== "En proceso" ? "El crédito debe estar en proceso." : null),
        transfer: () => (!ready ? "Primero registra la firma y finaliza el crédito, cuando aplique." : s.balance !== "paid" ? "La condición financiera debe indicar 100% cancelado; desconocido no equivale a cero." : null),
        exception: () => (!ready ? "Requiere contrato firmado y crédito finalizado, cuando aplique. La autorización sigue siendo una propuesta." : null),
        close: () => (!ready ? "Primero registra contrato firmado y crédito finalizado, cuando aplique." : null),
    };
}

function creditStartReason(s: FormalizationScenario): string | null {
    if (s.contract !== "signed" || s.mode !== "financed" || s.credit !== "Sin iniciar") return "Requiere contrato firmado y crédito financiado sin iniciar.";
    return s.bank && s.advisor ? null : "Selecciona banco y asesor antes de iniciar.";
}

/** Proyecta la misma orden local sobre bandejas e indicadores del recorrido. */
export function scenarioOrder(order: FormalizationExample, s: FormalizationScenario): FormalizationExample {
    if (s.history.length === 1) return order;
    const flow = getScenarioFlow(s);
    const contract = { pending: "No adjunto · Envío bloqueado", attached: "Adjunto · Por enviar", sent: "Enviado · Pendiente de firma", signed: "Firmado" };
    return { ...order, owner: s.owner, days: flow.stage === order.stage ? order.days : 0, stage: flow.stage, state: flow.label, blocker: flow.blocker, next: flow.action ? SCENARIO_ACTION_LABELS[flow.action] : "Ver resumen del cierre", contract: contract[s.contract], event: s.history[0]?.action ?? order.event };
}
