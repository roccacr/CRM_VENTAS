import "./FormalizationHomePage.css";
import "./FormalizationSummaryPage.css";

import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import InfoCircleOutlined from "@ant-design/icons/InfoCircleOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import { useState } from "react";

import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
import type { FormalizationExample } from "./formalization-preview.model";
import { useFormalizationPreview } from "./formalization-preview-session";
import { FormalizationOrderPreview } from "./FormalizationOrderPreview";
import { FormalizationPreviewBoundary } from "./FormalizationPreviewSession";

const checklist = [
    {
        title: "Orden única y aprobaciones",
        source: "IDEA p. 2 · Resumen ajustado p. 1 y 3",
        request: "Trabajar sobre la misma orden aprobada por Jefatura de Ventas y RDR, conservando cliente y unidad.",
        implementation: "Ficha única con identidad, condiciones comerciales y aprobaciones.",
        location: "Gestión de formalizaciones → Orden → Condiciones de la orden",
        review: "Abre la orden y comprueba cliente, unidad y ambas aprobaciones.",
        orderId: "DEMO-OV-101",
    },
    { title: "Bandejas y seguimiento", source: "Resumen ajustado p. 1 y 2", request: "Identificar las órdenes por estado, responsable y bloqueo.", implementation: "Contadores, bandejas, filtros de etapa/proyecto/responsable y siguiente acción.", location: "Inicio y Gestión de formalizaciones", review: "Pulsa un contador en Inicio; abre una fila. En Gestión combina filtros y usa Limpiar para volver a la lista.", path: "/home/formalization" },
    { title: "Asignar responsable", source: "Resumen ajustado p. 1 · IDEA p. 15", request: "Mostrar quién sigue el trámite y cuál es el siguiente pendiente.", implementation: "Responsable visible y formulario local de asignación; la guía propone el siguiente paso.", location: "Orden → Seguimiento actual / Cliente y unidad", review: "En DEMO-OV-101 pulsa Asignar responsable, selecciona un gestor y simula. La guía debe avanzar a Adjuntar contrato.", orderId: "DEMO-OV-101" },
    { title: "Adjuntar contrato", source: "Resumen ajustado p. 1 y 2", request: "Adjuntar el contrato existente antes de enviarlo; no priorizar su generación automática.", implementation: "Selector PDF/Word, referencia y presentación del documento.", location: "Orden → Contrato y documentos", review: "Pulsa Adjuntar contrato → Usar documento de ejemplo → Simular resultado. Enviar debe quedar habilitado.", orderId: "DEMO-OV-101" },
    {
        title: "Enviar contrato",
        source: "IDEA p. 4 · Resumen ajustado p. 2",
        request: "Enviar el contrato adjunto y distinguir el envío de la simple apertura del formulario.",
        implementation: "Vista de destinatario, asunto, mensaje y adjunto.",
        location: "Orden → Contrato y documentos → Enviar contrato",
        review: "Adjunta primero en DEMO-OV-101. Abre Enviar, revisa el correo y confirma. Cancelar no registra envío.",
        orderId: "DEMO-OV-101",
    },
    { title: "Registrar firma", source: "IDEA p. 4 · Resumen ajustado p. 3", request: "Registrar la recepción del contrato firmado con fecha y responsable.", implementation: "Acción Contrato firmado, respaldo, fecha automática e historial.", location: "Orden → Contrato y documentos → Contrato firmado", review: "En DEMO-OV-102 pulsa Contrato firmado, usa el documento de ejemplo y confirma. Revisa la fecha y el cambio de pendiente.", orderId: "DEMO-OV-102" },
    {
        title: "Modalidad, banco y asesor",
        source: "IDEA p. 5",
        request: "Distinguir recursos propios/financiado, seleccionar banco y asesor; permitir Otro asesor del mismo banco.",
        implementation: "Modalidad, asesores filtrados por banco y formulario Otro asesor. Recursos propios omite crédito.",
        location: "Orden → Gestión bancaria",
        review: "En DEMO-OV-103 revisa Seleccionar banco y asesor y Otro asesor. Cambiar modalidad limpia datos incompatibles; no crea bancos ni contactos reales.",
        orderId: "DEMO-OV-103",
    },
    {
        title: "Estados del crédito",
        source: "IDEA p. 5 · Resumen ajustado p. 3",
        request: "Gestionar Sin iniciar → En proceso → Formalizado y registrar sus fechas.",
        implementation: "Botones con requisitos, fechas automáticas y etapa separada de cambios de banco/asesor.",
        location: "Orden → Gestión bancaria y Fechas del escenario",
        review: "En DEMO-OV-103 pulsa Marcar crédito como formalizado. Para recorrer el inicio usa DEMO-OV-102: firma, selecciona banco/asesor e inicia la gestión.",
        orderId: "DEMO-OV-103",
    },
    {
        title: "Condición financiera",
        source: "IDEA p. 2 y 5 · Resumen ajustado p. 1 y 3",
        request: "Consultar la condición financiera de NetSuite, sin registrar pagos desde esta fase.",
        implementation: "Escenarios sin información, saldo pendiente y 100% cancelado. Desconocido no equivale a cero.",
        location: "Orden → Condición financiera",
        review: "En DEMO-OV-104 abre Consultar condición financiera y simula cada resultado. El traspaso normal solo se habilita con cancelación total y demás requisitos.",
        orderId: "DEMO-OV-104",
    },
    {
        title: "Traspaso y excepciones",
        source: "IDEA p. 5 · Resumen ajustado p. 3",
        request: "Registrar el traspaso o una excepción, distinguiendo solicitud y autorización.",
        implementation: "Respaldo, fecha/actor, solicitud pendiente y autorización ficticia diferenciadas.",
        location: "Orden → Traspaso y cierre",
        review: "En DEMO-OV-105 prueba Traspaso realizado o Registrar excepción de traspaso. Restablece el ejemplo para comparar resultados. Solicitar no significa autorizar.",
        orderId: "DEMO-OV-105",
        status: "Política pendiente",
    },
    {
        title: "Cierre de Formalización",
        source: "Resumen ajustado p. 3",
        request: "Distinguir cierre de Formalización y pendiente de fase posterior.",
        implementation: "Dos resultados, observaciones e historial; el cierre bloquea nuevas modificaciones del escenario.",
        location: "Orden → Traspaso y cierre → Cerrar Formalización",
        review: "En DEMO-OV-105 registra traspaso o autorización ficticia y abre Cerrar. Revisa ambos resultados, restableciendo entre pruebas. No equivale a entregar llaves.",
        orderId: "DEMO-OV-105",
        status: "Política pendiente",
    },
    {
        title: "Documentos, fechas e historial",
        source: "IDEA p. 2, 3, 13 y 14 · Resumen ajustado p. 1",
        request: "Mantener documentos vinculados, quién actuó, fecha/hora y cambios anteriores/nuevos.",
        implementation: "Referencias de contrato, firma y respaldos; selector Ver documento, fechas e historial por orden.",
        location: "Orden → Contrato y documentos / Fechas / Historial de la orden",
        review: "Simula una acción y revisa antes/después, actor y orden. Ver documento permite elegir los respaldos.",
        orderId: "DEMO-OV-105",
    },
    {
        title: "Calendario vinculado",
        source: "IDEA p. 3 y 13",
        request: "Vincular actividades con la orden y conservar el historial de cambios de eventos.",
        implementation: "Mes/agenda, tareas/reuniones, responsable, horario, estados e historial de reprogramación.",
        location: "Calendario; desde la orden → Agendar seguimiento",
        review: "Crea un evento con una orden. Ábrelo, cambia fecha/estado y revisa Historial del evento. Ver orden de venta vuelve a la ficha.",
        path: "/home/formalization/calendar",
    },
    {
        title: "Indicadores de referencia",
        source: "IDEA p. 5 y 13 · Resumen ajustado p. 2",
        request: "Visualizar carga por estado y tiempos de gestión para seguimiento.",
        implementation: "Contadores por estado y seguimiento filtrado por proyecto y bandeja. Las tablas de tiempos bancarios y pendientes por proyecto se retiraron del Inicio.",
        location: "Inicio → Indicadores / Pendientes de seguimiento",
        review: "Abre una bandeja desde un contador o filtra el seguimiento por proyecto. Métricas de duración, SLA y reportes productivos no están disponibles en el Inicio.",
        path: "/home/formalization",
        status: "Cobertura parcial",
    },
    {
        title: "Límites de esta primera fase",
        source: "IDEA p. 6 y 14 · Resumen ajustado p. 1 y 3",
        request: "Delimitar Formalización y dejar las políticas no definidas para aprobación.",
        implementation: "Sin cobros, modificaciones, entrega física/llaves, altas de bancos ni generación automática de contratos.",
        location: "Alcance inicial",
        review: "Confirmar con el responsable los criterios de excepción/cierre, permisos, responsables y métricas restantes antes de implementar operaciones reales.",
        status: "Fuera de esta fase",
    },
] as const;

type ChecklistItem = (typeof checklist)[number];

/** Éxito solo para lo representado; advertencia para lo pendiente de política o parcial; neutro para lo excluido. */
function ItemStatus({ item }: { readonly item: ChecklistItem }) {
    if (!("status" in item)) return <span className="formalization-status formalization-summary__status--visual">Representado visualmente</span>;
    return <span className={`formalization-status${item.status === "Fuera de esta fase" ? "" : " formalization-status--attention"}`}>{item.status}</span>;
}

function SummaryItem({ item, reviewed, onReviewed, onOpen }: { readonly item: ChecklistItem; readonly reviewed: boolean; readonly onReviewed: (checked: boolean) => void; readonly onOpen?: (() => void) | undefined }) {
    return (
        <li className={`formalization-card formalization-summary__item${reviewed ? " is-reviewed" : ""}`}>
            <div className="formalization-card__head">
                <h2>{item.title}</h2>
                <ItemStatus item={item} />
            </div>
            <div className="formalization-summary__body">
                <p className="formalization-summary__source">{item.source}</p>
                <dl>
                    <div>
                        <dt>Qué pide el PDF</dt>
                        <dd>{item.request}</dd>
                    </div>
                    <div>
                        <dt>Qué hicimos visualmente</dt>
                        <dd>{item.implementation}</dd>
                    </div>
                    <div>
                        <dt>Dónde está</dt>
                        <dd>{item.location}</dd>
                    </div>
                </dl>
                <p className="formalization-summary__review">
                    <strong>Cómo comprobarlo:</strong> {item.review}
                </p>
            </div>
            <div className="formalization-order__actions formalization-summary__actions">
                <label className="formalization-summary__check">
                    <input
                        type="checkbox"
                        aria-label={`Revisado: ${item.title}`}
                        checked={reviewed}
                        onChange={(event) => {
                            onReviewed(event.target.checked);
                        }}
                    />
                    Revisado
                </label>
                {("orderId" in item || "path" in item) && (
                    <Button icon={<ArrowRightOutlined />} aria-label={`Revisar: ${item.title}`} disabled={!onOpen} onClick={onOpen}>
                        {"orderId" in item ? "Abrir orden" : "Abrir vista"}
                    </Button>
                )}
            </div>
        </li>
    );
}

function SummaryContent({ onNavigate }: { readonly onNavigate?: ((path: string) => void) | undefined }) {
    const { orders } = useFormalizationPreview();
    const [selected, setSelected] = useState<FormalizationExample | null>(null);
    const [reviewed, setReviewed] = useState<readonly string[]>([]);
    const openItem = (item: ChecklistItem) => {
        if ("orderId" in item)
            return () => {
                setSelected(orders.find((order) => order.id === item.orderId) ?? null);
            };
        if ("path" in item && onNavigate)
            return () => {
                onNavigate(item.path);
            };
        return undefined;
    };
    return (
        <div className="global-home-dashboard formalization-home formalization-summary">
            {selected && (
                <FormalizationOrderPreview
                    order={selected}
                    backLabel="Volver al resumen"
                    onNavigate={onNavigate}
                    onBack={() => {
                        setSelected(null);
                    }}
                />
            )}
            <div className="formalization-summary__page" hidden={selected !== null}>
                <header className="global-home-page-header formalization-page-header">
                    <div>
                        <nav className="formalization-breadcrumb" aria-label="Ruta">
                            <span>Formalización</span>
                            <span aria-hidden="true">/</span>
                            <span>Resumen</span>
                        </nav>
                        <div className="formalization-title-row">
                            <h1>Resumen</h1>
                            <span className="formalization-total">{checklist.length} puntos</span>
                        </div>
                        <p className="formalization-page-header__caption">
                            <InfoCircleOutlined aria-hidden="true" /> Requisitos de los PDF y comprobación visual
                        </p>
                    </div>
                </header>
                <section className="formalization-surface formalization-summary__overview" aria-label="Avance de la revisión">
                    <div className="formalization-toolbar formalization-summary__progress">
                        <p role="status">
                            <strong>
                                {reviewed.length} de {checklist.length}
                            </strong>{" "}
                            puntos revisados manualmente
                        </p>
                        <span className="formalization-summary__meter" aria-hidden="true">
                            <span style={{ width: `${String((reviewed.length / checklist.length) * 100)}%` }} />
                        </span>
                    </div>
                </section>
                <ol className="formalization-summary__list" aria-label="Checklist de Formalización">
                    {checklist.map((item) => (
                        <SummaryItem
                            key={item.title}
                            item={item}
                            reviewed={reviewed.includes(item.title)}
                            onReviewed={(checked) => {
                                setReviewed((current) => (checked ? [...current, item.title] : current.filter((title) => title !== item.title)));
                            }}
                            onOpen={openItem(item)}
                        />
                    ))}
                </ol>
            </div>
        </div>
    );
}

/** Checklist de aceptación visual, independiente de permisos y estados de negocio. */
export function FormalizationSummaryPage({ onNavigate }: { readonly onNavigate?: ((path: string) => void) | undefined }) {
    return (
        <FormalizationPreviewBoundary>
            <ConfigProvider theme={PROJECTS_THEME} locale={esES}>
                <SummaryContent onNavigate={onNavigate} />
            </ConfigProvider>
        </FormalizationPreviewBoundary>
    );
}
