import DownOutlined from "@ant-design/icons/DownOutlined";
import FileSearchOutlined from "@ant-design/icons/FileSearchOutlined";
import Button from "antd/es/button";
import Tag from "antd/es/tag";
import { useId, useState } from "react";

import type { LeadProfileCommercialPage } from "../../services/leads/lead-profile-service";
import { type CommercialRecord, displayValue, recordCount, summarizeRecord } from "./lead-profile-commercial-model";
import { isBlank, labelTone, ORIGIN_LABEL } from "./lead-profile-model";
import { ProfileCard } from "./LeadProfileFields";

interface Props {
    readonly title: string;
    readonly data: LeadProfileCommercialPage | undefined;
    readonly refreshing: boolean;
    readonly onPage: (page: number) => void;
}

/** Every field of the record, label over value. Empty ones fold behind a switch: these records carry dozens of control fields. */
function RecordFields({ record, id }: { readonly record: CommercialRecord; readonly id: string }) {
    const [showEmpty, setShowEmpty] = useState(false);
    const empty = record.fields.filter((field) => isBlank(field.value)).length;
    const shown = showEmpty ? record.fields : record.fields.filter((field) => !isBlank(field.value));
    return (
        <div id={id} className="profile-record__details">
            <dl className="profile-fields">
                {shown.map((field) => (
                    <div key={field.code} className="profile-field">
                        <dt>{field.label}</dt>
                        <dd>{displayValue(field.code, field.value)}</dd>
                    </div>
                ))}
            </dl>
            {empty > 0 && (
                <button
                    type="button"
                    className="profile-card__toggle"
                    aria-pressed={showEmpty}
                    onClick={() => {
                        setShowEmpty((value) => !value);
                    }}
                >
                    {showEmpty ? "Ocultar campos sin dato" : `Mostrar ${String(empty)} campos sin dato`}
                </button>
            )}
        </div>
    );
}

function RecordHead({ record }: { readonly record: CommercialRecord }) {
    const summary = summarizeRecord(record);
    return (
        <header className="profile-record__head">
            <div>
                <h3>{summary.number}</h3>
                {summary.status && (
                    <span className="profile-chip" data-tone={labelTone(summary.status)}>
                        {summary.status}
                    </span>
                )}
                <Tag>{ORIGIN_LABEL[record.source]}</Tag>
            </div>
            {summary.created && <span className="profile-record__date">Creada {summary.created}</span>}
        </header>
    );
}
function RecordFacts({ record }: { readonly record: CommercialRecord }) {
    const { facts, note } = summarizeRecord(record);
    return (
        <>
            {facts.length > 0 && (
                <dl className="profile-record__facts">
                    {facts.map((fact) => (
                        <div key={fact.label}>
                            <dt>{fact.label}</dt>
                            <dd>{fact.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {note && <p className="profile-record__note">{note}</p>}
        </>
    );
}

/** One record: headline first, the rest on demand. */
function Record({ record }: { readonly record: CommercialRecord }) {
    const [open, setOpen] = useState(false);
    const detailsId = useId();
    return (
        <li className="profile-record" data-open={open}>
            <RecordHead record={record} />
            <RecordFacts record={record} />
            <button
                type="button"
                className="profile-record__toggle"
                aria-expanded={open}
                aria-controls={detailsId}
                onClick={() => {
                    setOpen((value) => !value);
                }}
            >
                {open ? "Ocultar datos" : "Ver todos los datos"} <DownOutlined aria-hidden="true" />
            </button>
            {open && <RecordFields record={record} id={detailsId} />}
        </li>
    );
}
function Pager({ data, refreshing, onPage }: { readonly data: LeadProfileCommercialPage; readonly refreshing: boolean; readonly onPage: (page: number) => void }) {
    if (data.page === 1 && !data.hasMore) return null;
    return (
        <footer className="profile-pager">
            <Button
                disabled={refreshing || data.page === 1}
                onClick={() => {
                    onPage(data.page - 1);
                }}
            >
                Página anterior
            </Button>
            <span>Página {data.page}</span>
            <Button
                disabled={refreshing || !data.hasMore}
                onClick={() => {
                    onPage(data.page + 1);
                }}
            >
                Página siguiente
            </Button>
        </footer>
    );
}
function Empty({ text }: { readonly text: string }) {
    return (
        <div className="profile-empty">
            <FileSearchOutlined aria-hidden="true" />
            <p>{text}</p>
        </div>
    );
}

/** Real records of the client. A log entry is not an opportunity or an estimate, so nothing is inferred from the log. */
export function LeadProfileCommercial({ title, data, refreshing, onPage }: Props) {
    if (!data?.available) {
        return (
            <ProfileCard title={title}>
                <Empty text={`Todavía no hay ${title.toLowerCase()} en el sistema nuevo para este cliente. Aparecerán aquí cuando existan; no se infieren de la bitácora.`} />
            </ProfileCard>
        );
    }
    return (
        <ProfileCard title={title} aside={<span className="profile-chip">{recordCount(data.total)}</span>}>
            <div className="profile-section-body" aria-busy={refreshing} data-loading={refreshing}>
                {data.items.length === 0 ? (
                    <Empty text={`Sin ${title.toLowerCase()} en esta página.`} />
                ) : (
                    <ol className="profile-records">
                        {data.items.map((record) => (
                            <Record key={`${record.source}:${record.id}`} record={record} />
                        ))}
                    </ol>
                )}
            </div>
            <Pager data={data} refreshing={refreshing} onPage={onPage} />
        </ProfileCard>
    );
}
