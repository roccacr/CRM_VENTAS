import type { ProcessDefinition, ProcessStep } from "../../components/processes/process-definition";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ORDER_STAGES, type OrderStage } from "../../services/formalization/order-stage-service";

const version = "2026-11-12";
const stageLabels = Object.fromEntries(ORDER_STAGES.map((stage) => [stage.code, stage.label]));
function step(id: string, label: string, options: Omit<ProcessStep, "id" | "label">): ProcessStep {
    return { id, label, ...options };
}
function stage(id: OrderStage, options: Omit<ProcessStep, "id" | "label" | "kind">): ProcessStep {
    return step(id, stageLabels[id] ?? id, { ...options, kind: id === "closed" ? "endEvent" : "userTask" });
}

/** Mapa de consulta del recorrido habitual. Las políticas del API conservan toda la autoridad para avanzar. */
export const FORMALIZATION_PROCESS: ProcessDefinition = {
    id: "Formalization",
    title: "Formalización",
    summary: "De la aprobación al cierre. Sigue las flechas; los fondos propios evitan la gestión bancaria. El mapa explica el recorrido habitual, no ejecuta cambios.",
    version,
    width: 1460,
    laneHeight: 220,
    lanes: ["Formalización", "Cliente y banco", "Formalización · cierre"],
    steps: [
        step("start", "Orden por revisar", { labelPosition: [110, 160], kind: "startEvent", lane: 0, x: 70, y: 96, description: "Inicio del recorrido de una orden de venta.", requirements: "La consulta y cada acción conservan sus permisos independientes.", next: "Revisar y aprobar Formalización." }),
        step("pending_approval", "Aprobar Formalización", { kind: "userTask", lane: 0, x: 160, y: 76, description: "Formalización revisa la orden y registra su aprobación después de la confirmación de la integración.", requirements: "Permiso de aprobación y prerrequisitos verificados por el sistema. Ver una orden no concede aprobación.", next: "Contrato por enviar." }),
        stage("contract_pending_send", { lane: 0, x: 390, y: 76, description: "Preparar el contrato y registrar su envío por la acción correspondiente.", requirements: "Orden activa y aprobación de Formalización. Abrir un borrador de correo no acredita envío ni cambia la etapa.", next: "Pendiente de firma." }),
        stage("contract_pending_signature", { lane: 1, x: 600, y: 296, description: "Formalización da seguimiento a la firma del cliente.", requirements: "Envío registrado y contrato firmado confirmado para salir de Contratos. Un dato ausente no cuenta como confirmado.", next: "Seleccionar el origen de fondos de la compra." }),
        step("funds", "¿Origen de fondos?", { labelPosition: [710, 142], kind: "exclusiveGateway", lane: 0, x: 820, y: 88, description: "El origen de fondos determina la salida obligatoria de Contratos.", requirements: "Seleccionar fondos propios o financiamiento bancario; no se deduce por el banco asignado.", next: "Fondos propios: Pendiente de saldo. Financiamiento: Gestión bancaria." }),
        stage("bank_management", { lane: 1, x: 1000, y: 296, description: "Orden financiada en espera de iniciar la gestión bancaria.", requirements: "Contrato firmado y origen de fondos bancario al salir de Contratos.", next: "Iniciar gestión bancaria." }),
        stage("bank_management_in_progress", { lane: 1, x: 1250, y: 286, size: [156, 96], description: "Seguimiento del trámite con el banco y el cliente.", requirements: "Registrar los avances mediante las acciones autorizadas de la orden.", next: "Pendiente de saldo." }),
        stage("pending_balance", { lane: 2, x: 1250, y: 516, description: "Consultar la situación financiera antes del traspaso o cierre.", requirements: "Para avanzar se necesita evidencia del destino: cuotas pagadas y condiciones de traspaso, o Unidad entregada para el cierre.", next: "El destino depende de los indicadores confirmados; puede corresponder traspaso pendiente, traspaso firmado o cierre." }),
        step("completion", "¿Qué acredita la entrega?", {
            labelPosition: [1000, 474],
            kind: "exclusiveGateway",
            lane: 2,
            x: 1080,
            y: 528,
            description: "La evidencia confirmada determina el destino elegible. No se inventan visitas intermedias.",
            requirements: "Unidad entregada permite cierre. Para traspaso pendiente: cuotas pagadas, unidad no entregada y no traspasada. Para traspaso firmado: cuotas pagadas, unidad no entregada, traspasada y llaves no entregadas.",
            next: "Registrar el destino permitido por el sistema; sin evidencia suficiente se conserva la etapa.",
        }),
        stage("pending_transfer", { lane: 2, x: 840, y: 516, description: "Gestionar el traspaso de la unidad.", requirements: "Cuotas pagadas por completo y condiciones de entrega confirmadas. Después de iniciar traspaso no se permite volver a Pendiente de saldo.", next: "Registrar traspaso firmado o el cierre que permita la evidencia." }),
        stage("transfer_signed", { lane: 2, x: 600, y: 516, description: "Traspaso firmado con seguimiento de la entrega.", requirements: "La firma manual desde Traspaso pendiente requiere cuotas pagadas, llaves no entregadas y unidad no entregada, aunque aún no se confirme el traspaso en la integración.", next: "Cerrar cuando Unidad entregada esté confirmada." }),
        stage("closed", { lane: 2, x: 410, y: 536, description: "Formalización cerrada según la evidencia de entrega.", requirements: "Unidad entregada confirmada para el cierre manual. La sincronización tiene reglas propias y puede reflejar un cierre posterior sin recorrer todas las visitas.", next: "Fin del recorrido comercial mostrado." }),
    ],
    flows: [
        { from: "start", to: "pending_approval" },
        { from: "pending_approval", to: "contract_pending_send" },
        { from: "contract_pending_send", to: "contract_pending_signature" },
        {
            from: "contract_pending_signature",
            to: "funds",
            points: [
                [756, 334],
                [845, 334],
                [845, 138],
            ],
        },
        {
            from: "funds",
            to: "bank_management",
            label: "Financiamiento",
            points: [
                [870, 113],
                [1078, 113],
                [1078, 296],
            ],
        },
        {
            from: "funds",
            to: "pending_balance",
            label: "Fondos propios",
            points: [
                [845, 88],
                [845, 40],
                [1430, 40],
                [1430, 554],
                [1406, 554],
            ],
        },
        { from: "bank_management", to: "bank_management_in_progress" },
        { from: "bank_management_in_progress", to: "pending_balance" },
        {
            from: "pending_balance",
            to: "completion",
            points: [
                [1250, 554],
                [1130, 554],
            ],
        },
        {
            from: "completion",
            to: "pending_transfer",
            points: [
                [1080, 553],
                [996, 554],
            ],
        },
        {
            from: "completion",
            to: "transfer_signed",
            label: "Traspasada",
            points: [
                [1105, 578],
                [1105, 620],
                [678, 620],
                [678, 592],
            ],
        },
        {
            from: "completion",
            to: "closed",
            label: "Unidad entregada",
            points: [
                [1105, 528],
                [1105, 470],
                [428, 470],
                [428, 536],
            ],
        },
        { from: "pending_transfer", to: "transfer_signed" },
        { from: "transfer_signed", to: "closed" },
    ],
};

/** El marcador Adéndum es independiente de la etapa comercial y del evento de calendario. */
export const ADDENDUM_PROCESS: ProcessDefinition = {
    id: "Addendum",
    title: "Adéndum",
    version,
    width: 1140,
    laneHeight: 240,
    lanes: ["Formalización", "Seguimiento"],
    summary: "Seguimiento paralelo: marcar un adéndum no cambia la etapa comercial. El evento del calendario y el marcador de la orden se gestionan por separado.",
    steps: [
        step("addendum_start", "Necesidad de adéndum", { kind: "startEvent", lane: 0, x: 65, y: 96, description: "Se identifica una necesidad de adéndum en una orden.", requirements: "La orden debe ser accesible. Las capacidades de marcar, consultar y resolver son independientes.", next: "Marcar pendiente con motivo." }),
        step("pending", "Marcar pendiente", { kind: "userTask", lane: 0, x: 190, y: 76, description: "Registrar el motivo del adéndum mediante la acción autorizada.", requirements: "Permiso específico para marcar pendiente y motivo obligatorio. No modifica la etapa de Formalización.", next: "Dar seguimiento; puede registrarse el envío." }),
        step("sent", "Registrar enviado", { kind: "userTask", lane: 0, x: 430, y: 76, description: "Registrar la evidencia de envío del adéndum pendiente.", requirements: "Lectura efectiva de la orden y del marcador; la acción revalida estado y versión. Esta marca no envía correo.", next: "Completar o cancelar cuando corresponda." }),
        step("resolve", "¿Cómo se resuelve?", { labelPosition: [575, 365], kind: "exclusiveGateway", lane: 1, x: 690, y: 308, description: "El marcador pendiente o enviado puede resolverse; enviado no es un requisito universal para completar.", requirements: "Permiso específico para actualizar el adéndum. Resolver el marcador no resuelve automáticamente un evento de calendario.", next: "Completar o cancelar, sin avanzar la etapa comercial." }),
        step("completed", "Adéndum completado", { kind: "endEvent", lane: 1, x: 940, y: 265, description: "La gestión del marcador terminó como completada.", requirements: "Respuesta confirmada y bitácora de la operación.", next: "Continuar la etapa comercial que corresponda." }),
        step("cancelled", "Adéndum cancelado", { kind: "endEvent", lane: 1, x: 940, y: 370, description: "La gestión del marcador terminó como cancelada.", requirements: "Respuesta confirmada y bitácora de la operación.", next: "La etapa comercial se conserva." }),
    ],
    flows: [
        { from: "addendum_start", to: "pending" },
        { from: "pending", to: "sent" },
        {
            from: "sent",
            to: "resolve",
            points: [
                [508, 152],
                [508, 275],
                [665, 275],
                [665, 333],
                [690, 333],
            ],
        },
        {
            from: "pending",
            to: "resolve",
            label: "Resolver sin envío",
            points: [
                [268, 152],
                [268, 333],
                [690, 333],
            ],
        },
        {
            from: "resolve",
            to: "completed",
            label: "Completar",
            labelPosition: [865, 251],
            points: [
                [715, 308],
                [715, 283],
                [940, 283],
            ],
        },
        {
            from: "resolve",
            to: "cancelled",
            label: "Cancelar",
            labelPosition: [875, 356],
            points: [
                [715, 358],
                [715, 388],
                [940, 388],
            ],
        },
    ],
};

/** La rama de finiquito conserva su origen y nunca reemplaza la etapa comercial por una etapa ficticia. */
export const FINIQUITO_PROCESS: ProcessDefinition = {
    id: "Finiquito",
    title: "Venta caída y finiquito",
    version,
    width: 1280,
    laneHeight: 220,
    lanes: ["Formalización", "Cliente / recepción"],
    summary: "Rama independiente para ventas caídas con Reserva Aplicada confirmada. Validar saldo, registrar envío y registrar recepción firmada son pasos distintos.",
    steps: [
        step("finiquito_start", "Venta caída", { kind: "startEvent", lane: 0, x: 65, y: 96, description: "La venta caída puede tener una gestión de finiquito independiente.", requirements: "Venta caída y Reserva Aplicada confirmadas. Una historia existente se conserva aunque cambien los indicadores.", next: "Revisar y validar el saldo." }),
        step("balance_validated", "Validar saldo", { kind: "userTask", lane: 0, x: 190, y: 76, description: "Registrar la validación financiera propia del CRM.", requirements: "Elegibilidad y permiso de gestión. Para este paso todavía no se exige contrato firmado.", next: "Comprobar Contrato firmado antes de registrar el envío." }),
        step("signed_contract", "¿Contrato firmado?", { labelPosition: [470, 40], kind: "exclusiveGateway", lane: 0, x: 445, y: 88, description: "Sin contrato firmado se conserva la validación y se bloquean envío y recepción.", requirements: "Saldo validado y Contrato firmado confirmados.", next: "Si se confirma, registrar el envío; de lo contrario esperar confirmación." }),
        step("waiting_contract", "Esperar confirmación", { kind: "userTask", lane: 1, x: 390, y: 296, description: "La gestión espera confirmación del contrato firmado.", requirements: "No se interpreta un dato ausente como firma confirmada.", next: "Volver a comprobar Contrato firmado." }),
        step("sent", "Registrar finiquito enviado", { kind: "userTask", lane: 0, x: 650, y: 66, size: [190, 96], description: "Registrar el envío del documento. Este paso no envía correo automáticamente.", requirements: "Saldo validado, contrato firmado, elegibilidad y versión vigente. No se permiten saltos ni repeticiones distintas.", next: "Dar seguimiento a la firma del cliente." }),
        step("signed", "Registrar recepción firmada", { kind: "userTask", lane: 1, x: 870, y: 286, size: [190, 96], description: "Confirmar que se recibió el finiquito firmado.", requirements: "Envío previo confirmado, saldo validado y contrato firmado. La operación queda auditada.", next: "Finiquito formalizado." }),
        step("formalized", "Formalizada · finiquito", { kind: "endEvent", lane: 1, x: 1110, y: 316, description: "Final de la gestión de finiquito; no equivale al cierre comercial por entrega de la unidad.", requirements: "Recepción firmada confirmada por el sistema.", next: "Consultar la bitácora; se conserva la etapa comercial de origen." }),
    ],
    flows: [
        { from: "finiquito_start", to: "balance_validated" },
        { from: "balance_validated", to: "signed_contract" },
        {
            from: "signed_contract",
            to: "sent",
            label: "Sí",
            points: [
                [495, 113],
                [650, 114],
            ],
        },
        { from: "signed_contract", to: "waiting_contract", label: "No / sin dato", labelPosition: [555, 165] },
        {
            from: "waiting_contract",
            to: "signed_contract",
            label: "Actualizar",
            labelPosition: [260, 240],
            points: [
                [390, 334],
                [320, 334],
                [320, 190],
                [375, 190],
                [375, 113],
                [445, 113],
            ],
        },
        { from: "sent", to: "signed" },
        {
            from: "signed",
            to: "formalized",
            points: [
                [1060, 334],
                [1110, 334],
            ],
        },
    ],
};

/** Solo se resalta la posición recibida; nunca se inventa un historial de pasos completados. */
export function formalizationCurrentStep(item: FollowUpItem | undefined): string | undefined {
    return FORMALIZATION_PROCESS.steps.find((entry) => entry.id === item?.state.code)?.id;
}
