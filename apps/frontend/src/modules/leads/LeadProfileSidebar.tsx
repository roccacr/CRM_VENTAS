import CheckOutlined from "@ant-design/icons/CheckOutlined";
import CloudOutlined from "@ant-design/icons/CloudOutlined";
import CopyOutlined from "@ant-design/icons/CopyOutlined";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { LeadProfileResult } from "../../services/leads/lead-profile-service";
import { fieldValue, type ProfileTab } from "./lead-profile-model";

/** Copies a value and confirms for a moment. The clipboard may be blocked, in which case nothing changes. */
function CopyValue({ label, value }: { readonly label: string; readonly value: string }) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | undefined>(undefined);
    useEffect(
        () => () => {
            window.clearTimeout(timer.current);
        },
        [],
    );
    const copy = () => {
        void navigator.clipboard.writeText(value).then(
            () => {
                setCopied(true);
                window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => {
                    setCopied(false);
                }, 1500);
            },
            () => undefined,
        );
    };
    return (
        <button type="button" className="profile-copy" aria-label={copied ? `${label} copiado` : `Copiar ${label.toLowerCase()}`} onClick={copy}>
            {copied ? <CheckOutlined aria-hidden="true" /> : <CopyOutlined aria-hidden="true" />}
        </button>
    );
}

function SideCard({ title, aside, children }: { readonly title: string; readonly aside?: ReactNode; readonly children: ReactNode }) {
    return (
        <section className="profile-side-card" aria-label={title}>
            <header>
                <h2>{title}</h2>
                {aside}
            </header>
            {children}
        </section>
    );
}
function Rows({ data, rows, copy }: { readonly data: LeadProfileResult; readonly rows: readonly (readonly [string, string])[]; readonly copy?: boolean }) {
    const shown = rows.flatMap(([code, label]) => {
        const value = fieldValue(data.sections, code);
        return value ? [{ code, label, value }] : [];
    });
    if (shown.length === 0) return <p className="profile-side-card__empty">Sin datos registrados.</p>;
    return (
        <dl className="profile-side-list">
            {shown.map((row) => (
                <div key={row.code}>
                    <dt>{row.label}</dt>
                    <dd>
                        <span>{row.value}</span>
                        {copy && <CopyValue label={row.label} value={row.value} />}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

const CONTACT: readonly (readonly [string, string])[] = [
    ["email", "Correo"],
    ["phone", "Teléfono"],
    ["alternatePhone", "Teléfono alternativo"],
    ["address", "Dirección"],
];
const COMMERCIAL: readonly (readonly [string, string])[] = [
    ["project", "Proyecto"],
    ["subsidiary", "Subsidiaria"],
    ["owner", "Responsable"],
    ["stage", "Etapa comercial"],
    ["campaign", "Campaña"],
    ["followUp", "Seguimiento"],
    ["broker", "Corredor"],
];
const EXTRA: readonly (readonly [string, string])[] = [
    ["relatedName", "Nombre"],
    ["relatedPhone", "Teléfono"],
    ["relatedEmail", "Correo"],
];

/** What is looked up while working in any section: contact, commercial facts, the additional person and where the documents will be. */
export function LeadProfileSidebar({ data, onOpenTab }: { readonly data: LeadProfileResult; readonly onOpenTab: (tab: ProfileTab) => void }) {
    return (
        <aside className="profile-side" aria-label="Datos del cliente">
            <SideCard title="Contacto">
                <Rows data={data} rows={CONTACT} copy />
            </SideCard>
            <SideCard title="Datos comerciales">
                <Rows data={data} rows={COMMERCIAL} />
            </SideCard>
            {fieldValue(data.sections, "relatedName") && (
                <SideCard title="Persona adicional">
                    <Rows data={data} rows={EXTRA} />
                </SideCard>
            )}
            <SideCard title="Documentos" aside={<span className="profile-chip">En preparación</span>}>
                <div className="profile-side-files">
                    <CloudOutlined aria-hidden="true" />
                    <p>Los archivos del cliente en OneDrive se listarán aquí.</p>
                    <button
                        type="button"
                        className="profile-card__toggle"
                        onClick={() => {
                            onOpenTab("files");
                        }}
                    >
                        Ver sección OneDrive
                    </button>
                </div>
            </SideCard>
        </aside>
    );
}
