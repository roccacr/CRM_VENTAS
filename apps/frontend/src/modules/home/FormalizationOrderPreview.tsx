import ArrowLeftOutlined from "@ant-design/icons/ArrowLeftOutlined";
import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import InfoCircleOutlined from "@ant-design/icons/InfoCircleOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import UndoOutlined from "@ant-design/icons/UndoOutlined";
import Button from "antd/es/button";
import Tooltip from "antd/es/tooltip";
import { useCallback, useEffect, useRef, useState } from "react";

import { type FollowUpItem, getFormalizationOrderRecord } from "../../services/formalization/follow-up-service";
import type { NetsuitePrimary } from "../../services/formalization/netsuite-primary";
import { type FormalizationExample, isUnassigned } from "./formalization-preview.model";
import { FORMALIZATION_EXAMPLES } from "./formalization-preview.model";
import { useFormalizationPreview } from "./formalization-preview-session";
import { applyScenarioAction, createScenario, type FormalizationScenario, getScenarioFlow, SCENARIO_ACTION_LABELS, type ScenarioAction, type ScenarioValues } from "./formalization-scenario.model";
import { FormalizationFiniquito } from "./FormalizationFiniquito";
import { NetsuiteSynchronizationActions } from "./FormalizationNetsuiteSync";
import { FormalizationOrderActions } from "./FormalizationOrderActions";
import { FormalizationOrderAddendum } from "./FormalizationOrderAddendum";
import { FormalizationPreviewBoundary } from "./FormalizationPreviewSession";
import { FormalizationPurchaseFunds } from "./FormalizationPurchaseFunds";
import { FormalizationRecordLoading } from "./FormalizationRecordLoading";
import { FormalizationRecordProgress } from "./FormalizationRecordProgress";
import { FormalizationRecordSummary } from "./FormalizationRecordSummary";
import { FormalizationStageEditor } from "./FormalizationStageEditor";
import { FormalizationStatusPill } from "./FormalizationStatusPill";

/** `muted` marca valores ausentes o fuera de la muestra; `code` muestra identificadores como chip. */
type FieldKind = "value" | "muted" | "code";
type Field = readonly [label: string, value: string, kind?: FieldKind];

const getCreditState = (order: FormalizationExample) => (order.stage === "Gestión bancaria" ? "En proceso" : order.id === "DEMO-OV-105" ? "Formalizado" : "No aplica o aún no iniciado");

interface Section {
    readonly id: string;
    readonly title: string;
    readonly fields: readonly Field[];
}

const isOwnResources = (order: FormalizationExample) => order.id === "DEMO-OV-104";
const getOwnerField = (order: FormalizationExample): Field => ["Responsable", order.owner, isUnassigned(order) ? "muted" : "value"];

function getOrderSections(order: FormalizationExample): readonly Section[] {
    const ownResources = isOwnResources(order);
    const signed = order.contract === "Firmado";
    const amount = order.project === "AVIVA" ? 184250 : 352750;
    const money = new Intl.NumberFormat("es-CR", { style: "currency", currency: "USD" });
    return [
        {
            id: "general",
            title: "Cliente y unidad",
            fields: [
                ["Cliente", order.client],
                ["Correo", `${order.id.toLowerCase()}@example.invalid`],
                ["Teléfono", "No incluido en la muestra", "muted"],
                ["Proyecto", order.project],
                ["Unidad", order.unit, "code"],
                ["Tipo de vivienda", "A · Ejemplo"],
                ["Área total", "120 m² · Ejemplo"],
                ["Subsidiaria", "Sociedad de ejemplo"],
            ],
        },
        {
            id: "commercial",
            title: "Condiciones de la orden",
            fields: [
                ["Orden de venta", order.id, "code"],
                ["Origen", "Orden comercial aprobada · Ejemplo"],
                ["Precio pactado", `${money.format(amount)} · Ficticio`],
                ["Modalidad", ownResources ? "Recursos propios" : "Financiamiento"],
                ["Jefatura de Ventas", "Aprobada · Ejemplo"],
                ["RDR", "Aprobada · Ejemplo"],
                ["Asesor comercial", "Asesor de ejemplo"],
                ["Referencia externa", "Sin vínculo a un ERP real", "muted"],
            ],
        },
        {
            id: "contract",
            title: "Contrato y documentos",
            fields: [
                ["Estado del contrato", order.contract],
                ["Contrato adjunto", order.id === "DEMO-OV-101" ? "Pendiente · Envío bloqueado" : "Contrato de ejemplo · Sin archivo real"],
                ["Envío", order.id === "DEMO-OV-101" ? "No enviado" : "Registrado en el escenario de ejemplo"],
                ["Firma", signed ? "Recibida · Ejemplo" : "Pendiente"],
                ["Repositorio", "Sin conexión documental", "muted"],
                ["Otros respaldos", "No incluidos en la muestra", "muted"],
            ],
        },
    ];
}

function getProcessSections(order: FormalizationExample): readonly Section[] {
    return [
        {
            id: "bank",
            title: "Gestión bancaria",
            fields: [["Modalidad", isOwnResources(order) ? "Recursos propios · No aplica crédito" : "Financiamiento"], ["Banco / Asesor", order.bank], ["Estado del crédito", getCreditState(order)], getOwnerField(order)],
        },
        {
            id: "finance",
            title: "Condición financiera",
            fields: [
                ["Situación", order.financial],
                ["Saldo", "Sin importe validado · No consultado", "muted"],
                ["Fuente financiera", "NetSuite no conectado", "muted"],
                ["Registro de pagos", "Fuera de esta vista", "muted"],
            ],
        },
        {
            id: "transfer",
            title: "Traspaso y cierre",
            fields: [
                ["Traspaso", order.stage === "Traspasos" ? "Pendiente de registrar" : "Aún no corresponde en este ejemplo"],
                ["Excepción autorizada", "No registrada en la muestra", "muted"],
                ["Cierre de Formalización", "Pendiente"],
                ["Entrega de llaves", "Fuera del proceso de Formalización", "muted"],
            ],
        },
    ];
}

function FieldValue({ value, kind = "value" }: { readonly value: string; readonly kind?: FieldKind | undefined }) {
    if (kind === "code") return <code className="formalization-code">{value}</code>;
    return <span className={kind === "muted" ? "formalization-muted-value" : undefined}>{value}</span>;
}

const dateLabels: Record<string, string> = { attached: "Contrato adjunto", sent: "Contrato enviado", signed: "Firma recibida", creditStarted: "Inicio de gestión bancaria", creditCompleted: "Crédito formalizado", transferred: "Traspaso registrado", closed: "Resultado de cierre" };

function scenarioFields(s: FormalizationScenario): Record<string, string> {
    const contracts = { pending: "Por adjuntar", attached: "Adjunto · Por enviar", sent: "Enviado · Pendiente de firma", signed: "Firmado" };
    const balances = { unknown: "Sin información disponible", pending: "Saldo pendiente", paid: "100% cancelado · Ficticio" };
    const transfers = { pending: "Pendiente", done: "Realizado", requested: "Excepción solicitada", authorized: "Pendiente autorizado · Ficticio" };
    const closures = { open: "Pendiente", closed: "Cerrado por Formalizaciones", later: "Pendiente por fase posterior" };
    return {
        Responsable: s.owner,
        "Otros respaldos":
            s.documents
                .filter((doc) => !["Contrato", "Contrato firmado"].includes(doc.kind))
                .map((doc) => doc.name)
                .join(" · ") || "Sin respaldos adicionales",
        "Estado del contrato": contracts[s.contract],
        "Contrato adjunto": s.document ?? "Pendiente · Envío bloqueado",
        Modalidad: s.mode === "own" ? "Recursos propios" : "Financiamiento",
        "Banco / Asesor": [s.bank, s.advisor, s.advisorEmail].filter(Boolean).join(" · ") || "Sin seleccionar",
        "Estado del crédito": s.credit,
        Situación: balances[s.balance],
        Traspaso: transfers[s.transfer],
        "Excepción autorizada": { pending: "No registrada", done: "No requerida en este ejemplo", requested: "Pendiente de autorización", authorized: "Autorizada · Ficticia" }[s.transfer],
        "Cierre de Formalización": closures[s.closure],
        Firma: s.signedDocument ?? "Pendiente",
        Envío: s.contract === "sent" || s.contract === "signed" ? "Envío registrado · Ejemplo" : "No enviado",
    };
}

/** Orden de demostración en página completa. Ningún campo consulta o modifica registros reales. */
function FormalizationOrderContent({ order, onBack, onNavigate, backLabel }: { readonly order: FormalizationExample; readonly onBack: () => void; readonly onNavigate?: ((path: string) => void) | undefined; readonly backLabel: string }) {
    const { scenarios, updateScenario, setCalendarOrderId } = useFormalizationPreview();
    const scenario = scenarios[order.id] ?? createScenario(order);
    const flow = getScenarioFlow(scenario);
    const focusTitle = useCallback((node: HTMLHeadingElement | null) => {
        node?.focus();
    }, []);
    const apply = (action: ScenarioAction, values: ScenarioValues) => {
        const at = new Intl.DateTimeFormat("es-CR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Costa_Rica" }).format(new Date());
        updateScenario(order.id, applyScenarioAction(scenario, action, values, at));
    };
    const displayValues = scenarioFields(scenario);
    const assignedOrder = { ...order, owner: scenario.owner };
    const sections = [...getOrderSections(assignedOrder), ...getProcessSections(assignedOrder)];
    const summary: readonly Field[] = [
        ["Responsable", scenario.owner],
        ["Situación actual", flow.label],
        ["Siguiente paso", flow.action ? SCENARIO_ACTION_LABELS[flow.action] : "Ver resumen del cierre"],
        ["Tiempo inicial en etapa", `${String(order.days)} días`],
    ];

    return (
        <section className="formalization-order" aria-labelledby="formalization-order-title">
            <Button className="formalization-back" type="text" aria-label={backLabel} icon={<ArrowLeftOutlined />} onClick={onBack}>
                {backLabel}
            </Button>
            <header className="global-home-page-header formalization-page-header">
                <div>
                    <nav className="formalization-breadcrumb" aria-label="Ruta">
                        <span>Formalización</span>
                        <span aria-hidden="true">/</span>
                        <span>Órdenes de venta</span>
                        <span aria-hidden="true">/</span>
                        <span>{order.id}</span>
                    </nav>
                    <div className="formalization-title-row">
                        <h1 id="formalization-order-title" tabIndex={-1} ref={focusTitle}>
                            Orden de venta {order.id}
                        </h1>
                        <FormalizationStatusPill item={{ ...order, owner: scenario.owner }} label={flow.label} />
                    </div>
                    <p>
                        {order.client} · {order.project} · {order.unit}
                    </p>
                </div>
                <div className="global-home-page-header__actions">
                    <Button
                        className="formalization-command"
                        aria-label="Restablecer ejemplo"
                        icon={<UndoOutlined />}
                        onClick={() => {
                            updateScenario(order.id, createScenario(FORMALIZATION_EXAMPLES.find((item) => item.id === order.id) ?? order));
                        }}
                    >
                        Restablecer ejemplo
                    </Button>
                </div>
            </header>
            <p className="formalization-page-header__caption" role="status">
                <InfoCircleOutlined aria-hidden="true" /> Estado: <strong>{flow.label}</strong>
            </p>

            <section className="formalization-card formalization-order__summary" aria-labelledby="formalization-order-summary">
                <div className="formalization-card__head">
                    <h2 id="formalization-order-summary">Seguimiento actual</h2>
                    <span className="formalization-card__meta">{flow.stage}</span>
                </div>
                <dl className="formalization-order__facts">
                    {summary.map(([label, value, kind]) => (
                        <div key={label}>
                            <dt>{label}</dt>
                            <dd>
                                <FieldValue value={value} kind={kind} />
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>
            <section className="formalization-process" aria-labelledby="formalization-next-action">
                <ol aria-label="Avance de Formalización">
                    {["Contrato", "Firma", scenario.mode === "own" ? "Banco · No aplica" : "Banco", "Condición financiera", "Traspaso", "Cierre"].map((step, index) => (
                        <li key={step} aria-current={flow.step === index ? "step" : undefined} className={index < flow.step ? "is-complete" : ""}>
                            <span>{index + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
                <div className="formalization-process__next">
                    <div>
                        <h2 id="formalization-next-action">{flow.action ? "Siguiente acción" : "Resultado de Formalización"}</h2>
                        <p>{flow.blocker}</p>
                    </div>
                    <FormalizationOrderActions order={order} scenario={scenario} section="next" primaryAction={flow.action ?? undefined} onApply={apply} />
                    {onNavigate && (
                        <Button
                            icon={<CalendarOutlined />}
                            aria-label="Agendar seguimiento de esta orden"
                            onClick={() => {
                                setCalendarOrderId(order.id);
                                onNavigate("/home/formalization/calendar");
                            }}
                        >
                            Agendar seguimiento
                        </Button>
                    )}
                </div>
            </section>

            <nav className="formalization-order__sections" aria-label="Secciones de la orden">
                {sections.map((section) => (
                    <a key={section.id} href={`#order-${section.id}`}>
                        {section.title}
                    </a>
                ))}
            </nav>

            <div className="formalization-order__grid">
                {sections.map((section) => (
                    <section key={section.id} id={`order-${section.id}`} className="formalization-card" aria-labelledby={`order-${section.id}-title`}>
                        <div className="formalization-card__head">
                            <h2 id={`order-${section.id}-title`}>{section.title}</h2>
                        </div>
                        <dl className="formalization-card__fields">
                            {section.fields.map(([label, value, kind]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>
                                        <FieldValue value={displayValues[label] ?? value} kind={kind} />
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <FormalizationOrderActions order={order} section={section.id} scenario={scenario} onApply={apply} />
                    </section>
                ))}
            </div>
            <section className="formalization-card" aria-label="Fechas del escenario">
                <div className="formalization-card__head">
                    <h2>Fechas registradas automáticamente</h2>
                </div>
                <dl className="formalization-card__fields">
                    {Object.entries(scenario.dates).map(([key, value]) => (
                        <div key={key}>
                            <dt>{dateLabels[key]}</dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>
                {Object.keys(scenario.dates).length === 0 && <p className="formalization-order__action-note">Sin fechas registradas.</p>}
            </section>

            <section className="formalization-card" aria-labelledby="formalization-order-history">
                <div className="formalization-card__head">
                    <h2 id="formalization-order-history">Historial de la orden</h2>
                    <span className="formalization-card__meta">{scenario.history.length} movimientos</span>
                </div>
                <div className="formalization-grid-scroll">
                    <table className="formalization-grid formalization-grid--history">
                        <caption className="formalization-sr">Movimientos de la orden</caption>
                        <thead>
                            <tr>
                                <th scope="col">Fecha y hora</th>
                                <th scope="col">Acción</th>
                                <th scope="col">Responsable</th>
                                <th scope="col">Registro</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scenario.history.map((event, index) => (
                                <tr key={`${event.at}-${String(index)}`}>
                                    <td className="formalization-grid__time">{event.at}</td>
                                    <td data-label="Acción">
                                        {event.action}
                                        <p>Antes: {event.before}</p>
                                        <p>Después: {event.after}</p>
                                        <p>{event.details}</p>
                                    </td>
                                    <td data-label="Responsable">
                                        <FieldValue value={event.actor} />
                                    </td>
                                    <td data-label="Registro">
                                        <code className="formalization-code">{order.id}</code>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </section>
    );
}

/** Admite una ficha aislada en pruebas sin crear otra sesión dentro del módulo. */
export function FormalizationOrderPreview(props: { readonly order: FormalizationExample; readonly onBack: () => void; readonly onNavigate?: ((path: string) => void) | undefined; readonly backLabel?: string }) {
    return (
        <FormalizationPreviewBoundary>
            <FormalizationOrderContent {...props} backLabel={props.backLabel ?? "Volver a la lista"} />
        </FormalizationPreviewBoundary>
    );
}

/** Same action in the ready header and the full-page loading skeleton. */
function RecordRefreshAction({ onRefresh, loading = false }: { readonly onRefresh: (() => void) | undefined; readonly loading?: boolean }) {
    if (!onRefresh) return null;
    return (
        <Tooltip title="Recargar transacción">
            <Button className="formalization-command formalization-home__reload" icon={<ReloadOutlined spin={loading} />} aria-label="Recargar transacción" disabled={loading} onClick={onRefresh} />
        </Tooltip>
    );
}

/** Database identity/progress plus the explicitly approved NetSuite primary projection. */
export function FormalizationOrderRecord({
    item,
    onBack,
    onRefresh,
    onStageSaved,
    onAddendumChanged,
    primary = null,
    netsuiteStatus = "success",
    netsuiteErrorMessage,
    onNavigate,
    stagePermissions = [],
    canUpdateStage = false,
}: {
    readonly item: FollowUpItem;
    readonly onBack: () => void;
    readonly onRefresh?: () => void;
    readonly onStageSaved?: (item: FollowUpItem) => void;
    readonly onAddendumChanged?: (() => void | Promise<void>) | undefined;
    readonly primary?: NetsuitePrimary | null;
    readonly netsuiteStatus?: "idle" | "loading" | "success" | "error";
    readonly netsuiteErrorMessage?: string | undefined;
    readonly onNavigate?: ((path: string) => void) | undefined;
    readonly stagePermissions?: readonly { code: string; effect: string }[] | undefined;
    readonly canUpdateStage?: boolean;
}) {
    // A confirmed POST updates only this flag in the exact projection that was visible for this order.
    const [confirmedPrimary, setConfirmedPrimary] = useState<{ primary: NetsuitePrimary | null; order: string } | null>(null);
    const [addendumRevision, setAddendumRevision] = useState(0);
    const fundsRevalidation = useStageRevalidation(item, onStageSaved);
    const handleAddendumChanged = () => {
        setAddendumRevision((value) => value + 1);
        return onAddendumChanged?.();
    };
    const orderIdentity = item.source + ":" + item.id;
    const displayedPrimary = confirmedApprovalPrimary(primary, confirmedPrimary, orderIdentity);
    const [integrationEnvironment, setIntegrationEnvironment] = useState<{ identity: string; environment: "production" | "sandbox" } | null>(null);
    const handleEnvironment = useCallback(
        (environment: "production" | "sandbox") => {
            setIntegrationEnvironment({ identity: orderIdentity, environment });
        },
        [orderIdentity],
    );
    if (netsuiteStatus === "loading") return <FormalizationRecordLoading complete actions={<RecordRefreshAction onRefresh={onRefresh} loading />} />;
    // Adendum and purchase funds sit with the contract and the key facts in one compact grid instead of stacking full-width cards.
    const overview = (
        <>
            <FormalizationOrderAddendum item={item} permissions={stagePermissions} refreshVersion={addendumRevision} onChanged={handleAddendumChanged} />
            <FormalizationPurchaseFunds
                key={`funds:${item.source}:${item.id}:${String(item.stateVersion)}:${String(item.purchaseFundsOrigin)}`}
                item={item}
                allowed={canUpdateStage}
                onSaved={fundsRevalidation.saved}
                onRefresh={() => {
                    onRefresh?.();
                }}
            />
        </>
    );
    return (
        <section className="formalization-order" aria-labelledby="formalization-record-title">
            <header className="global-home-page-header formalization-page-header">
                <div>
                    <nav className="formalization-breadcrumb" aria-label="Ruta de la orden">
                        <span>Formalización</span>
                        <span aria-hidden="true">/</span>
                        <a
                            href="/home/formalization/orders"
                            onClick={(event) => {
                                event.preventDefault();
                                onBack();
                            }}
                        >
                            Órdenes de venta
                        </a>
                        <span aria-hidden="true">/</span>
                        <span>{item.number}</span>
                        <span aria-hidden="true">/</span>
                        <NetsuiteEnvironmentLabel value={integrationEnvironment} identity={orderIdentity} />
                    </nav>
                    <h1
                        id="formalization-record-title"
                        tabIndex={-1}
                        ref={(node) => {
                            node?.focus();
                        }}
                    >
                        Orden de venta {item.number}
                    </h1>
                </div>
                <div className="formalization-order-header-actions">
                    <NetsuiteSynchronizationActions key={orderIdentity} identity={{ source: item.source, id: item.id }} allowed={canUpdateStage} onEnvironment={handleEnvironment} onSynchronized={onRefresh} />
                    <RecordRefreshAction onRefresh={onRefresh} />
                </div>
            </header>
            <FormalizationFiniquito item={item} allowed={canUpdateStage} />
            <FormalizationRecordProgress state={item.state.code} />
            <RecordStageActions
                key={item.source + ":" + item.id}
                item={item}
                allowed={canUpdateStage}
                status={netsuiteStatus}
                permissions={stagePermissions}
                onRefresh={onRefresh}
                onStageSaved={onStageSaved}
                onApproved={() => {
                    setConfirmedPrimary({ primary, order: orderIdentity });
                }}
            />
            {netsuiteStatus === "success" ? (
                <FormalizationRecordSummary item={item} primary={displayedPrimary} effectivePermissions={stagePermissions} onNavigate={onNavigate} onAddendumChanged={handleAddendumChanged} overview={overview} />
            ) : (
                <>
                    <div className="record-overview__cards">{overview}</div>
                    <section className="formalization-card formalization-record-loading" role="status">
                        {recordLoadMessage(netsuiteStatus, netsuiteErrorMessage)}
                    </section>
                </>
            )}
        </section>
    );
}

function RecordStageActions({ item, allowed, status, permissions, onRefresh, onStageSaved, onApproved }: { readonly item: FollowUpItem; readonly allowed: boolean; readonly status: string; readonly permissions: readonly { code: string; effect: string }[]; readonly onRefresh: (() => void) | undefined; readonly onStageSaved: ((item: FollowUpItem) => void) | undefined; readonly onApproved: () => void }) {
    const revalidation = useStageRevalidation(item, onStageSaved);
    if ((!allowed && item.state.code !== "pending_approval") || status !== "success") return null;
    return (
        <>
            <FormalizationStageEditor
                key={`${item.id}:${String(item.stateVersion)}:${item.state.code}:${String(item.purchaseFundsOrigin)}`}
                item={item}
                allowed={allowed}
                permissions={permissions}
                onApproved={onApproved}
                onSaved={revalidation.saved}
                onRefresh={() => {
                    onRefresh?.();
                }}
            />
            {revalidation.notice && <p role="status">{revalidation.notice}</p>}
        </>
    );
}

/** Revalidate one CRM record after a committed write without invalidating the provider projection. */
function useStageRevalidation(item: FollowUpItem, onUpdate: ((item: FollowUpItem) => void) | undefined) {
    const [notice, setNotice] = useState<string | null>(null);
    const identity = item.source + ":" + item.id;
    const active = useRef<string | null>(identity);
    useEffect(() => {
        active.current = identity;
        return () => {
            active.current = null;
        };
    }, [identity]);
    const saved = async () => {
        setNotice("Cambio guardado. Verificando estado…");
        try {
            const updated = await getFormalizationOrderRecord(item.source, item.source === "legacy" ? item.id.replace(/^legacy:/, "") : item.id);
            if (active.current !== identity) return;
            onUpdate?.(updated);
            setNotice("Estado guardado y verificado correctamente.");
        } catch {
            if (active.current === identity) setNotice("El cambio se guardó, pero no se pudo verificar el estado actualizado. Recarga la transacción antes de repetir la operación.");
        }
    };
    return { saved, notice };
}

function confirmedApprovalPrimary(primary: NetsuitePrimary | null, confirmed: { primary: NetsuitePrimary | null; order: string } | null, order: string): NetsuitePrimary | null {
    if (!primary || confirmed?.primary !== primary || confirmed.order !== order) return primary;
    return { ...primary, checks: { ...primary.checks, "Aprobación formalización": true } };
}

/** A confirmed missing record has its own safe message; other failures keep the retry guidance. */
function recordLoadMessage(status: string, message: string | undefined): string {
    if (status === "error") return message ?? "No fue posible cargar los datos de la orden. Pulsa recargar para reintentar.";
    return "Los datos de la orden aún no están disponibles.";
}

function NetsuiteEnvironmentLabel({ value, identity }: { readonly value: { identity: string; environment: "production" | "sandbox" } | null; readonly identity: string }) {
    if (value?.identity !== identity) return <span>NetSuite: verificando ambiente…</span>;
    return <span>{value.environment === "production" ? "NetSuite Producción" : "NetSuite Sandbox"}</span>;
}
