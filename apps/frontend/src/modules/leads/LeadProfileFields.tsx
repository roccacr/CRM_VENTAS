import Alert from "antd/es/alert";
import Tag from "antd/es/tag";
import { type ReactNode, useState } from "react";

import type { LeadProfileField } from "../../services/leads/lead-profile-service";
import { filledFields, type InfoBlock, isBlank, ORIGIN_LABEL } from "./lead-profile-model";

/** A section card on the Administration contract: 40px band with the title, content below. */
export function ProfileCard({ title, aside, children, className }: { readonly title: string; readonly aside?: ReactNode; readonly children: ReactNode; readonly className?: string }) {
    return (
        <section className={`profile-card${className ? ` ${className}` : ""}`} aria-label={title}>
            <header className="profile-card__head">
                <h2>{title}</h2>
                {aside}
            </header>
            <div className="profile-card__body">{children}</div>
        </section>
    );
}

function FieldValue({ field, multiSource }: { readonly field: LeadProfileField; readonly multiSource: boolean }) {
    return (
        <>
            <span className="profile-field__value">{isBlank(field.value) ? <span className="profile-field__empty">Sin dato</span> : field.value}</span>
            {multiSource && field.source && <Tag>{ORIGIN_LABEL[field.source]}</Tag>}
            {field.legacyValue && <Alert type="warning" showIcon title={`Valor distinto en el sistema anterior: ${field.legacyValue}`} />}
        </>
    );
}

/** The introduction of the consolidated view. */
export function InfoHero() {
    return (
        <header className="profile-intro">
            <p className="profile-eyebrow">Vista consolidada</p>
            <h2>Información completa del lead</h2>
            <p>Consulte en una sola vista la información comercial, personal y cualitativa del cliente para facilitar el seguimiento y la toma de decisiones.</p>
        </header>
    );
}

/**
 * One block of the consolidated view: eyebrow, title, what it contains, then label over value.
 * Every field is shown, because this view exists to read the whole file; a switch hides the empty ones when only what is known matters.
 * A field with a different legacy value always stays visible so the difference is never hidden.
 */
export function InfoBlockCard({ block, multiSource }: { readonly block: InfoBlock; readonly multiSource: boolean }) {
    const [onlyFilled, setOnlyFilled] = useState(false);
    const empty = block.fields.length - filledFields(block.fields).length;
    const shown = onlyFilled ? block.fields.filter((field) => !isBlank(field.value) || field.legacyValue) : block.fields;
    return (
        <section className="profile-block" aria-label={block.title}>
            <header className="profile-block__head">
                <div>
                    <p className="profile-eyebrow">{block.eyebrow}</p>
                    <h3>{block.title}</h3>
                    <p>{block.description}</p>
                </div>
                {empty > 0 && (
                    <button
                        type="button"
                        className="profile-card__toggle"
                        aria-pressed={onlyFilled}
                        onClick={() => {
                            setOnlyFilled((value) => !value);
                        }}
                    >
                        {onlyFilled ? `Mostrar ${String(empty)} sin dato` : "Ocultar campos sin dato"}
                    </button>
                )}
            </header>
            <dl className="profile-fields">
                {shown.map((field) => (
                    <div key={field.code} className="profile-field">
                        <dt>{field.label}</dt>
                        <dd>
                            <FieldValue field={field} multiSource={multiSource} />
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
