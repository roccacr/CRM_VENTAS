import CalculatorOutlined from "@ant-design/icons/CalculatorOutlined";
import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import CloudOutlined from "@ant-design/icons/CloudOutlined";
import HistoryOutlined from "@ant-design/icons/HistoryOutlined";
import IdcardOutlined from "@ant-design/icons/IdcardOutlined";
import RiseOutlined from "@ant-design/icons/RiseOutlined";
import ShoppingOutlined from "@ant-design/icons/ShoppingOutlined";
import type { KeyboardEvent, ReactNode } from "react";

import { PROFILE_TABS, type ProfileTab } from "./lead-profile-model";

const ICONS: Record<ProfileTab, ReactNode> = {
    log: <HistoryOutlined />,
    events: <CalendarOutlined />,
    opportunities: <RiseOutlined />,
    estimates: <CalculatorOutlined />,
    info: <IdcardOutlined />,
    orders: <ShoppingOutlined />,
    files: <CloudOutlined />,
};

/** Accessible tab list: arrow keys move between sections, Home and End jump to the first and last, only the active tab is in the tab order. */
export function LeadProfileTabs({ active, counts, onChange }: { readonly active: ProfileTab; readonly counts: Partial<Record<ProfileTab, string>>; readonly onChange: (tab: ProfileTab) => void }) {
    const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = PROFILE_TABS.length - 1;
        const target = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        const next = PROFILE_TABS[target];
        if (!next) return;
        onChange(next.id);
        document.getElementById(`profile-tab-${next.id}`)?.focus();
    };
    return (
        <div className="profile-tabs" role="tablist" aria-label="Secciones del perfil del cliente">
            {PROFILE_TABS.map((tab, index) => (
                <button
                    key={tab.id}
                    id={`profile-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={tab.id === active}
                    aria-controls={`profile-panel-${tab.id}`}
                    tabIndex={tab.id === active ? 0 : -1}
                    onClick={() => {
                        onChange(tab.id);
                    }}
                    onKeyDown={(event) => {
                        move(event, index);
                    }}
                >
                    <i aria-hidden="true">{ICONS[tab.id]}</i>
                    {tab.label}
                    {counts[tab.id] && <em>{counts[tab.id]}</em>}
                </button>
            ))}
        </div>
    );
}
