import Tag from "antd/es/tag";
import type { ReactNode } from "react";

import type { LeadProfileResult } from "../../services/leads/lead-profile-service";
import { fieldValue, initials, labelTone, ORIGIN_LABEL, type ProfileTab } from "./lead-profile-model";

export interface ProfileStat {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly tab: ProfileTab;
}
interface Props {
    readonly data: LeadProfileResult;
    readonly name: string;
    readonly stats: readonly ProfileStat[];
    readonly onStat: (tab: ProfileTab) => void;
    /** Quick actions on the right of the name. */
    readonly actions: ReactNode;
    /** The tab bar sits at the bottom edge of the card. */
    readonly children: ReactNode;
}

/** A label whose wording says something (inactive, lost, contract…) gets a soft tint; anything else stays neutral. */
function Chip({ label }: { readonly label: string }) {
    return (
        <span className="profile-chip" data-tone={labelTone(label)}>
            {label}
        </span>
    );
}
function Chips({ data }: { readonly data: LeadProfileResult }) {
    const status = fieldValue(data.sections, "status");
    const stage = fieldValue(data.sections, "stage");
    return (
        <div className="profile-hero__chips">
            {data.sources.map((source) => (
                <Tag key={source}>{ORIGIN_LABEL[source]}</Tag>
            ))}
            {status && <Chip label={status} />}
            {stage && <Chip label={stage} />}
        </div>
    );
}
function Subtitle({ data }: { readonly data: LeadProfileResult }) {
    const owner = fieldValue(data.sections, "owner");
    const parts = [fieldValue(data.sections, "project"), owner ? `Responsable: ${owner}` : null].filter(Boolean);
    return <p className="profile-hero__role">{parts.length > 0 ? parts.join(" · ") : `Referencia ${data.id}`}</p>;
}

/**
 * The client at a glance: a quiet cover, the person, quick actions, the figures of the file as shortcuts into its sections, and the tab bar.
 * It never shows a figure the data does not support.
 */
export function LeadProfileHero({ data, name, stats, onStat, actions, children }: Props) {
    return (
        <section className="profile-hero-card" aria-label="Identidad del cliente">
            <div className="profile-cover" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                    <i key={index} style={{ width: 150 - index * 22, height: 150 - index * 22 }} />
                ))}
            </div>
            <div className="profile-hero__body">
                <span className="profile-avatar" aria-hidden="true">
                    {initials(name)}
                </span>
                <div className="profile-hero__who">
                    <h2>{name}</h2>
                    <Chips data={data} />
                    <Subtitle data={data} />
                </div>
                <div className="profile-hero__actions">{actions}</div>
            </div>
            <ul className="profile-stats" aria-label="Resumen del expediente">
                {stats.map((stat) => (
                    <li key={stat.id}>
                        <button
                            type="button"
                            onClick={() => {
                                onStat(stat.tab);
                            }}
                        >
                            <strong>{stat.value}</strong>
                            <span>{stat.label}</span>
                        </button>
                    </li>
                ))}
            </ul>
            {children}
        </section>
    );
}
