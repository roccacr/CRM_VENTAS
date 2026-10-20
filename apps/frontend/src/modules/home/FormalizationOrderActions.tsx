import BankOutlined from "@ant-design/icons/BankOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import EyeOutlined from "@ant-design/icons/EyeOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import SendOutlined from "@ant-design/icons/SendOutlined";
import SwapOutlined from "@ant-design/icons/SwapOutlined";
import UploadOutlined from "@ant-design/icons/UploadOutlined";
import Button from "antd/es/button";
import { type ReactNode, useState } from "react";

import type { FormalizationExample } from "./formalization-preview.model";
import { type FormalizationScenario, getScenarioActionReason, SCENARIO_ACTION_LABELS, type ScenarioAction, type ScenarioValues } from "./formalization-scenario.model";
import { FormalizationActionDialog } from "./FormalizationActionDialog";

const groups: Record<string, readonly ScenarioAction[]> = {
    general: ["assign"],
    contract: ["attach", "document", "send", "sign"],
    bank: ["mode", "bank", "advisor", "start", "complete"],
    finance: ["finance"],
    transfer: ["transfer", "exception", "close"],
};

const icons: Record<ScenarioAction, ReactNode> = {
    assign: <EditOutlined />,
    attach: <UploadOutlined />,
    document: <EyeOutlined />,
    send: <SendOutlined />,
    sign: <CheckCircleOutlined />,
    mode: <EditOutlined />,
    bank: <BankOutlined />,
    advisor: <EditOutlined />,
    start: <BankOutlined />,
    complete: <CheckCircleOutlined />,
    finance: <SearchOutlined />,
    transfer: <SwapOutlined />,
    exception: <EditOutlined />,
    close: <CheckCircleOutlined />,
};

/** Cada control abre una simulación local, nunca una operación real. */
export function FormalizationOrderActions({ order, section, scenario, onApply, primaryAction }: { readonly order: FormalizationExample; readonly section: string; readonly scenario: FormalizationScenario; readonly onApply: (action: ScenarioAction, values: ScenarioValues) => void; readonly primaryAction?: ScenarioAction | undefined }) {
    const [selected, setSelected] = useState<ScenarioAction | null>(null);
    const actions = primaryAction ? [primaryAction] : groups[section];
    if (!actions) return null;
    return (
        <>
            <div className="formalization-order__actions" aria-label={`Acciones de la orden ${order.id}`}>
                {actions.map((action) => (
                    <span key={action} title={getScenarioActionReason(scenario, action) ?? "Abrir escenario visual"}>
                        <Button
                            icon={icons[action]}
                            type={primaryAction ? "primary" : "default"}
                            aria-label={primaryAction ? `Continuar: ${SCENARIO_ACTION_LABELS[action]}` : SCENARIO_ACTION_LABELS[action]}
                            disabled={getScenarioActionReason(scenario, action) !== null}
                            onClick={() => {
                                setSelected(action);
                            }}
                        >
                            {SCENARIO_ACTION_LABELS[action]}
                        </Button>
                    </span>
                ))}
            </div>
            {selected && (
                <FormalizationActionDialog
                    key={selected}
                    order={order}
                    scenario={scenario}
                    action={selected}
                    onApply={onApply}
                    onClose={() => {
                        setSelected(null);
                    }}
                />
            )}
        </>
    );
}
