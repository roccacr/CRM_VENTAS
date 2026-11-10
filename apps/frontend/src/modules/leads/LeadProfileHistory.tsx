import FileSearchOutlined from "@ant-design/icons/FileSearchOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Button from "antd/es/button";
import Input from "antd/es/input";
import Tag from "antd/es/tag";
import { useMemo, useState } from "react";

import type { LeadProfileResult } from "../../services/leads/lead-profile-service";
import { HISTORY_KINDS, historyDate, type HistoryEntry, type HistoryKind, historyKind, matchesHistory, ORIGIN_LABEL, stampParts } from "./lead-profile-model";
import { ProfileCard } from "./LeadProfileFields";

type History = LeadProfileResult["history"];
interface Props {
    readonly history: History;
    readonly refreshing: boolean;
    readonly atStart: boolean;
    readonly onFirst: () => void;
    readonly onNext: () => void;
    /** Filtra anotaciones de actividad; no sustituye las colecciones comerciales reales. */
    readonly kind?: HistoryKind;
    readonly title?: string;
    readonly hint?: string;
    readonly emptyText?: string;
}

const statusChange = (entry: HistoryEntry): string | null => (entry.fromStatus || entry.toStatus ? `${entry.fromStatus ?? "—"} → ${entry.toStatus ?? "—"}` : null);
/** Quién lo hizo, qué estado cambió y por qué, y de qué sistema vino. */
function EntryMeta({ entry }: { readonly entry: HistoryEntry }) {
    const change = statusChange(entry);
    return (
        <div className="profile-timeline__meta">
            <span>{entry.actorName ?? "Sin actor registrado"}</span>
            {change && <span className="profile-chip">{change}</span>}
            {entry.reason && <span className="profile-chip">{entry.reason.name}</span>}
            <Tag>{ORIGIN_LABEL[entry.source === "native" ? "native" : "legacy"]}</Tag>
        </div>
    );
}
function Entry({ entry }: { readonly entry: HistoryEntry }) {
    const when = stampParts(historyDate(entry));
    return (
        <li className="profile-timeline__item" data-kind={historyKind(entry)}>
            <span className="profile-timeline__dot" aria-hidden="true" />
            <article className="profile-entry">
                <time className="profile-entry__date">
                    <strong>{when.date}</strong>
                    {when.time && <span>{when.time}</span>}
                </time>
                <div className="profile-entry__body">
                    <h3>{entry.action}</h3>
                    <p>{entry.detail ?? "Sin detalle registrado"}</p>
                    <EntryMeta entry={entry} />
                </div>
            </article>
        </li>
    );
}
function KindFilter({ kinds, counts, active, onChange }: { readonly kinds: readonly { id: HistoryKind; label: string }[]; readonly counts: Record<string, number>; readonly active: HistoryKind | "all"; readonly onChange: (kind: HistoryKind | "all") => void }) {
    const options = [{ id: "all" as const, label: "Todos" }, ...kinds];
    return (
        <div className="profile-filter" role="group" aria-label="Tipo de registro">
            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    aria-pressed={option.id === active}
                    onClick={() => {
                        onChange(option.id);
                    }}
                >
                    {option.label}
                    <em>{counts[option.id] ?? 0}</em>
                </button>
            ))}
        </div>
    );
}
function EmptyState({ text }: { readonly text: string }) {
    return (
        <div className="profile-empty">
            <FileSearchOutlined aria-hidden="true" />
            <p>{text}</p>
        </div>
    );
}

const DEFAULT_HINT = "Acciones y notas registradas para este cliente. Las fechas del sistema anterior conservan su hora de origen.";
const countByKind = (items: readonly HistoryEntry[]) => {
    const result: Record<string, number> = { all: items.length };
    for (const entry of items) result[historyKind(entry)] = (result[historyKind(entry)] ?? 0) + 1;
    return result;
};
const matching = (items: readonly HistoryEntry[], filter: HistoryKind | "all", query: string) => items.filter((entry) => (filter === "all" || historyKind(entry) === filter) && matchesHistory(entry, query));

function HistorySearch({ title, query, onQuery }: { readonly title: string; readonly query: string; readonly onQuery: (value: string) => void }) {
    return (
        <Input
            allowClear
            prefix={<SearchOutlined aria-hidden="true" />}
            placeholder="Buscar en los registros cargados"
            aria-label={`Buscar en ${title.toLowerCase()}`}
            value={query}
            onChange={(event) => {
                onQuery(event.target.value);
            }}
        />
    );
}
function HistoryBody({ visible, total, emptyText, refreshing }: { readonly visible: readonly HistoryEntry[]; readonly total: number; readonly emptyText: string; readonly refreshing: boolean }) {
    return (
        <div className="profile-section-body" aria-busy={refreshing} data-loading={refreshing}>
            {visible.length === 0 ? (
                <EmptyState text={total === 0 ? emptyText : "Ningún registro coincide con el filtro."} />
            ) : (
                <ol className="profile-timeline">
                    {visible.map((entry) => (
                        <Entry key={entry.id} entry={entry} />
                    ))}
                </ol>
            )}
        </div>
    );
}
function HistoryPager({ history, refreshing, atStart, onFirst, onNext }: Pick<Props, "history" | "refreshing" | "atStart" | "onFirst" | "onNext">) {
    if (atStart && !history.nextCursor) return null;
    return (
        <footer className="profile-pager">
            <Button disabled={atStart || refreshing} onClick={onFirst}>
                Volver al inicio del historial
            </Button>
            <Button disabled={!history.nextCursor || refreshing} onClick={onNext}>
                Siguiente página del historial
            </Button>
        </footer>
    );
}

/** Actividad del cliente. La búsqueda y los filtros trabajan sobre los registros ya cargados en esta página. La siguiente página se pide con el cursor existente. */
export function LeadProfileHistory(props: Props) {
    const { history, kind, title = "Bitácora de seguimiento", hint = DEFAULT_HINT, emptyText = "Sin historial registrado." } = props;
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<HistoryKind | "all">("all");
    const items = useMemo(() => (kind ? history.items.filter((entry) => historyKind(entry) === kind) : history.items), [history.items, kind]);
    const counts = useMemo(() => countByKind(items), [items]);
    return (
        <ProfileCard title={title} className="profile-card--history">
            <p className="profile-hint">{hint} Los filtros cuentan anotaciones de esta página, no oportunidades ni estimaciones únicas.</p>
            <div className="profile-toolbar">
                <HistorySearch title={title} query={query} onQuery={setQuery} />
                {!kind && <KindFilter kinds={HISTORY_KINDS.filter((item) => (counts[item.id] ?? 0) > 0)} counts={counts} active={filter} onChange={setFilter} />}
            </div>
            <HistoryBody visible={matching(items, filter, query)} total={items.length} emptyText={emptyText} refreshing={props.refreshing} />
            <HistoryPager {...props} />
        </ProfileCard>
    );
}
