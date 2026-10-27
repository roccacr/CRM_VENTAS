import BankOutlined from "@ant-design/icons/BankOutlined";
import CheckOutlined from "@ant-design/icons/CheckOutlined";
import FileDoneOutlined from "@ant-design/icons/FileDoneOutlined";
import KeyOutlined from "@ant-design/icons/KeyOutlined";
import SafetyCertificateOutlined from "@ant-design/icons/SafetyCertificateOutlined";
import SendOutlined from "@ant-design/icons/SendOutlined";
import SwapOutlined from "@ant-design/icons/SwapOutlined";
import WalletOutlined from "@ant-design/icons/WalletOutlined";

import { ORDER_STAGES } from "../../services/formalization/order-stage-service";

const PROGRESS_ICONS: Record<string, typeof SendOutlined> = {
    pending_approval: SafetyCertificateOutlined,
    contract_pending_send: SendOutlined,
    contract_pending_signature: FileDoneOutlined,
    bank_management: BankOutlined,
    pending_balance: WalletOutlined,
    pending_transfer: SwapOutlined,
    transfer_signed: KeyOutlined,
};
const RECORD_PROGRESS_STAGES = [{ code: "pending_approval", label: "Pendientes de aprobación" }, ...ORDER_STAGES.filter((stage) => stage.code !== "closed")].map((stage) => ({ ...stage, Icon: PROGRESS_ICONS[stage.code] ?? FileDoneOutlined }));
function ProgressHeader({ current }: { readonly current: number }) {
    const stage = RECORD_PROGRESS_STAGES[current];
    return (
        <>
            <div className="formalization-card__head">
                <div>
                    <h2>Avance de Formalización</h2>
                    {stage && (
                        <p className="formalization-record-progress__summary">
                            Etapa {current + 1} de {RECORD_PROGRESS_STAGES.length} · <strong>{stage.label}</strong>
                        </p>
                    )}
                </div>
                {!stage && <strong className="formalization-record-progress__percentage">Etapa sin identificar</strong>}
            </div>
            {stage && <div className="formalization-sr" role="progressbar" aria-label="Avance de Formalización" aria-valuemin={1} aria-valuemax={RECORD_PROGRESS_STAGES.length} aria-valuenow={current + 1} aria-valuetext={`Etapa ${String(current + 1)} de ${String(RECORD_PROGRESS_STAGES.length)}: ${stage.label}`} />}
        </>
    );
}

/** Position in the workflow, not proof of historical visits: users can jump stages. */
export function FormalizationRecordProgress({ state, compact = false }: { readonly state: string; readonly compact?: boolean }) {
    const current = state === "closed" ? RECORD_PROGRESS_STAGES.length - 1 : RECORD_PROGRESS_STAGES.findIndex((stage) => stage.code === state);
    return (
        <section className={`formalization-card formalization-record-progress${compact ? " formalization-record-progress--compact" : ""}`} aria-label="Etapas de Formalización">
            <ProgressHeader current={current} />
            <ol className="formalization-record-progress__steps" aria-label="Recorrido de etapas">
                {RECORD_PROGRESS_STAGES.map((stage, index) => (
                    <li key={stage.code} data-status={progressStatus(index, current)} aria-current={index === current ? "step" : undefined}>
                        <span className="formalization-record-progress__marker" aria-hidden="true">
                            {index < current ? <CheckOutlined /> : <stage.Icon />}
                        </span>
                        <strong>{stage.label}</strong>
                        <small className="formalization-record-progress__status">
                            {progressLabel(index, current)}
                        </small>
                    </li>
                ))}
            </ol>
        </section>
    );
}
function progressStatus(index: number, current: number): string {
    if (index === current) return "current";
    return index < current ? "reached" : "pending";
}
function progressLabel(index: number, current: number): string {
    if (index === current) return "Etapa actual";
    return index < current ? "Alcanzada" : "Pendiente";
}
