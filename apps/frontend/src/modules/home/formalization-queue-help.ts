import type { FollowUpQueue } from "../../services/formalization/follow-up-service";

const eligible = "Orden activa y sin venta caída. ";

/** Explica los filtros vigentes sin confundir requisitos de avance con una etapa ya registrada. */
export const FORMALIZATION_QUEUE_HELP: Readonly<Record<FollowUpQueue, string>> = {
    all: eligible + "Incluye las bandejas que puedes consultar y los casos con indicadores incompletos para revisar. El total considera los filtros actuales, no solo esta página.",
    approvals: eligible + "Jefatura de Ventas y Desarrolladora aprobadas; Aprobación Formalización desmarcada.",
    addendum: eligible + "Marca de Adéndum pendiente, registrada desde la orden o al guardar un evento Adéndum. La marca no cambia la etapa de Formalización. Requiere permiso para consultar órdenes con Adéndum.",
    contracts: eligible + "Aprobación Formalización marcada y etapa Por enviar o Pendiente de firma.",
    send: eligible + "Aprobación Formalización marcada y contrato en Por enviar.",
    signature: eligible + "Aprobación Formalización marcada y etapa Pendiente de firma.",
    bank: eligible + "Contrato firmado y etapa Gestión bancaria (Sin iniciar) o Gestión bancaria en proceso. Las órdenes con Fondos propios pasan directo a Pendiente de saldo.",
    balance: eligible + "Contrato firmado y etapa Pendiente de saldo. Llega desde Contratos con Fondos propios o después de completar la gestión bancaria. Aquí se confirma el pago completo para continuar.",
    transfer: eligible + "Cuotas pagadas: sí. Unidad traspasada: no. Unidad entregada: no. Llaves: cualquiera. Contrato firmado y etapa Traspasos pendientes.",
    signed: eligible + "Cuotas pagadas y Unidad traspasada: sí. Entrega de llaves y Unidad entregada: no. Contrato firmado y etapa Traspaso firmado.",
    closed: eligible + "Unidad entregada y contrato firmado: sí. Cierre registrado este año, con horario de Costa Rica. Cuotas, traspaso y llaves no condicionan el cierre.",
};

export const FORMALIZATION_FOLLOW_UP_HELP = "Muestra las órdenes que puedes consultar. Selecciona varios proyectos y varias bandejas a la vez. Gestión bancaria distingue Sin iniciar y En proceso como subestados. La selección se guarda automáticamente por usuario y vista en este navegador. Sin selección se muestran todos los proyectos y las bandejas permitidas. La etapa guardada se conserva y los indicadores incompletos se señalan para revisión.";
