import BankOutlined from "@ant-design/icons/BankOutlined";
import CheckOutlined from "@ant-design/icons/CheckOutlined";
import FileDoneOutlined from "@ant-design/icons/FileDoneOutlined";
import KeyOutlined from "@ant-design/icons/KeyOutlined";
import SafetyCertificateOutlined from "@ant-design/icons/SafetyCertificateOutlined";
import SendOutlined from "@ant-design/icons/SendOutlined";
import SwapOutlined from "@ant-design/icons/SwapOutlined";
import WalletOutlined from "@ant-design/icons/WalletOutlined";

import { isFiniquitoOrder } from "../../services/formalization/finiquito-service";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ORDER_STAGES } from "../../services/formalization/order-stage-service";

const PROGRESS_ICONS: Record<string, typeof SendOutlined> = {
    pending_approval: SafetyCertificateOutlined,
    contract_pending_send: SendOutlined,
    contract_pending_signature: FileDoneOutlined,
    bank_management: BankOutlined,
    bank_management_in_progress: BankOutlined,
    pending_balance: WalletOutlined,
    pending_transfer: SwapOutlined,
    transfer_signed: KeyOutlined,
};
const RECORD_PROGRESS_STAGES = [{ code: "pending_approval", label: "Pendientes de aprobación" }, ...ORDER_STAGES.filter((stage) => stage.code !== "closed")].map((stage) => ({ ...stage, Icon: PROGRESS_ICONS[stage.code] ?? FileDoneOutlined }));
function ProgressHeader({ current, closed }: { readonly current: number; readonly closed: boolean }) {
    const stage = RECORD_PROGRESS_STAGES[current];
    return (
        <>
            <div className="formalization-card__head">
                <div>
                    <h2>Avance de Formalización</h2>
                    {stage && (
                        <p className="formalization-record-progress__summary">
                            {closed ? (
                                <>
                                    <strong>Formalización cerrada</strong> · Proceso finalizado
                                </>
                            ) : (
                                <>
                                    Etapa {current + 1} de {RECORD_PROGRESS_STAGES.length} · <strong>{stage.label}</strong>
                                </>
                            )}
                        </p>
                    )}
                </div>
                {!stage && <strong className="formalization-record-progress__percentage">Etapa sin identificar</strong>}
            </div>
            {stage && <div className="formalization-sr" role="progressbar" aria-label="Avance de Formalización" aria-valuemin={1} aria-valuemax={RECORD_PROGRESS_STAGES.length} aria-valuenow={current + 1} aria-valuetext={closed ? "Formalización cerrada: Proceso finalizado" : `Etapa ${String(current + 1)} de ${String(RECORD_PROGRESS_STAGES.length)}: ${stage.label}`} />}
        </>
    );
}

type CheckKey = "salesManagementApproved" | "developerApproved" | "formalizationApproved" | "contractSignedCheck" | "installmentsFullyPaid" | "unitTransferred" | "keysDelivered" | "unitDelivered" | "commercialClosureSigned" | "saleLostCheck";
/** Agrupados por momento del proceso; el orden original de NetSuite se conserva dentro de cada grupo. */
const ORDER_CHECK_GROUPS: readonly { readonly title: string; readonly checks: readonly (readonly [CheckKey, string])[] }[] = [
    {
        title: "Aprobaciones",
        checks: [
            ["salesManagementApproved", "Jefatura de Ventas"],
            ["developerApproved", "Desarrolladora"],
            ["formalizationApproved", "Formalización"],
        ],
    },
    {
        title: "Contrato y pagos",
        checks: [
            ["contractSignedCheck", "Contrato firmado"],
            ["installmentsFullyPaid", "Cuotas pagadas por completo"],
        ],
    },
    {
        title: "Traspaso y entrega",
        checks: [
            ["unitTransferred", "Unidad traspasada"],
            ["keysDelivered", "Entrega de llaves"],
            ["unitDelivered", "Unidad entregada"],
            ["commercialClosureSigned", "Cierre firmado"],
        ],
    },
    { title: "Alerta", checks: [["saleLostCheck", "Venta caída"]] },
];

function checkState(key: CheckKey, value: boolean | null | undefined): { state: string; text: string } {
    if (value == null) return { state: "unknown", text: "Sin dato" };
    if (key === "saleLostCheck") return value ? { state: "alert", text: "Marcado" } : { state: "ok", text: "Desmarcado" };
    return value ? { state: "on", text: "Marcado" } : { state: "off", text: "Desmarcado" };
}

function OrderChecks({ item }: { readonly item: FollowUpItem }) {
    return (
        <section className="formalization-record-checks" aria-label="Checks de NetSuite">
            <h3>Checks de NetSuite</h3>
            <div className="formalization-record-checks__groups">
                {ORDER_CHECK_GROUPS.map((group) => (
                    <div key={group.title} className="formalization-record-checks__group" role="group" aria-label={group.title}>
                        <dl>
                            {group.checks.map(([key, label]) => {
                                const { state, text } = checkState(key, item[key]);
                                return (
                                    <div key={key} data-state={state}>
                                        <dt>
                                            <span className="formalization-record-checks__icon" aria-hidden="true">
                                                {(state === "on" || state === "ok") && <CheckOutlined />}
                                                {state === "alert" && "!"}
                                            </span>
                                            {label}
                                        </dt>
                                        <dd className="formalization-sr" data-checked={item[key] === true}>
                                            {text}
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                    </div>
                ))}
            </div>
        </section>
    );
}

/** Posición en el flujo. No prueba visitas históricas: la persona puede saltar etapas. */
export function FormalizationRecordProgress({ item, compact = false }: { readonly item: FollowUpItem; readonly compact?: boolean }) {
    if (isFiniquitoOrder(item)) return <OrderChecks item={item} />;
    const state = item.state.code;
    const closed = state === "closed";
    const current = closed ? RECORD_PROGRESS_STAGES.length - 1 : RECORD_PROGRESS_STAGES.findIndex((stage) => stage.code === state);
    return (
        <section className={`formalization-card formalization-record-progress${compact ? " formalization-record-progress--compact" : ""}`} aria-label="Etapas de Formalización">
            <ProgressHeader current={current} closed={closed} />
            <ol className="formalization-record-progress__steps" aria-label="Recorrido de etapas">
                {RECORD_PROGRESS_STAGES.map((stage, index) => (
                    <li key={stage.code} title={compact ? `${stage.label} · ${progressLabel(index, current, closed)}` : undefined} data-status={progressStatus(index, current, closed)} aria-current={!closed && index === current ? "step" : undefined}>
                        <span className="formalization-record-progress__marker" aria-hidden="true">
                            <stage.Icon />
                            {["completed", "previous"].includes(progressStatus(index, current, closed)) && <CheckOutlined className="formalization-record-progress__check" />}
                        </span>
                        <strong>{stage.label}</strong>
                        <small className="formalization-record-progress__status">{progressLabel(index, current, closed)}</small>
                    </li>
                ))}
            </ol>
            {compact && <OrderChecks item={item} />}
        </section>
    );
}
function progressStatus(index: number, current: number, closed: boolean): string {
    if (closed && index === current) return "completed";
    if (index === current) return "current";
    return index < current ? "previous" : "pending";
}
function progressLabel(index: number, current: number, closed: boolean): string {
    if (closed && index === current) return "Completada";
    if (index === current) return "Etapa actual";
    return index < current ? "Etapa anterior" : "Pendiente";
}
