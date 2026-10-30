import CheckOutlined from "@ant-design/icons/CheckOutlined";
import InboxOutlined from "@ant-design/icons/InboxOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import UndoOutlined from "@ant-design/icons/UndoOutlined";
import type { CSSProperties, ReactNode } from "react";

import type { PersonalNote } from "../../services/notes/notes-service";
import { NoteRelatedRecordsSummary } from "./NoteRelatedRecords";

interface CardNote {
    readonly status?: PersonalNote["status"];
    readonly relatedRecords?: PersonalNote["relatedRecords"];
    readonly id: string;
    readonly title: string | null;
    readonly color: string;
    readonly priority: "low" | "normal" | "high";
    readonly updatedAt: string;
    readonly content: { readonly text: string };
    readonly author: { readonly displayName: string };
}
interface CardProps {
    readonly note: CardNote;
    /** Short label of where the note lives: "Personal", "Vista", "Orden". */
    readonly where: string;
    readonly locked: boolean;
    readonly onOpen: () => void;
    readonly actions?: ReactNode;
}

const shortDate = (iso: string): string => new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** One note as a small sticky card: title, three lines of text, who and when, and its actions as icon buttons. Cards sit two by two. */
export function NoteCard({ note, where, locked, onOpen, actions }: CardProps) {
    return (
        <li className="note-card" style={{ "--note": note.color } as CSSProperties}>
            <button type="button" className="personal-notes-list__open note-card__open" disabled={locked} onClick={onOpen}>
                <strong>{note.title ?? "Sin título"}</strong>
                <span>{note.content.text}</span>
            </button>
            <div className="note-card__meta">
                {note.status && <span className="note-chip">{{ open: "Pendiente", completed: "Completada", archived: "Archivada" }[note.status]}</span>}
                {note.priority === "high" && <span className="note-chip note-chip--high">Prioridad alta</span>}
                <span className="note-chip">{where}</span>
            </div>
            <NoteRelatedRecordsSummary records={note.relatedRecords} compact />
            <div className="note-card__foot">
                <small title={`${note.author.displayName} · ${new Date(note.updatedAt).toLocaleString("es-CR")}`}>
                    {firstName(note.author.displayName)} · {shortDate(note.updatedAt)}
                </small>
                {actions && <div className="note-card__actions">{actions}</div>}
            </div>
        </li>
    );
}

/** Author capabilities come from the API; invited readers never receive lifecycle controls. */
export function NoteLifecycleActions({ note, disabled, onState }: { readonly note: PersonalNote; readonly disabled: boolean; readonly onState: (action: "complete" | "reopen" | "archive") => void }) {
    const actions = [
        { action: "complete", capability: "canComplete", label: "Completar", icon: <CheckOutlined /> },
        { action: "reopen", capability: "canReopen", label: "Reabrir", icon: <UndoOutlined /> },
        { action: "archive", capability: "canArchive", label: "Archivar", icon: <InboxOutlined /> },
    ] as const;
    return (
        <>
            {actions
                .filter((item) => note.capabilities[item.capability])
                .map((item) => (
                    <CardAction
                        key={item.action}
                        label={item.label}
                        icon={item.icon}
                        disabled={disabled}
                        onClick={() => {
                            onState(item.action);
                        }}
                    />
                ))}
        </>
    );
}

/** A square icon button with its name for screen readers and as a tooltip. */
export function CardAction({ label, icon, disabled, onClick }: { readonly label: string; readonly icon: ReactNode; readonly disabled: boolean; readonly onClick: () => void }) {
    return (
        <button type="button" className="note-card__action" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
            {icon}
        </button>
    );
}

/** Shares the search field across server-filtered inboxes and the current view. */
export function NotesSearch({ value, onChange, disabled }: { readonly value: string; readonly onChange: (value: string) => void; readonly disabled: boolean }) {
    return (
        <label className="notes-search">
            <SearchOutlined aria-hidden="true" />
            <input
                type="search"
                maxLength={200}
                aria-label="Buscar en las notas"
                placeholder="Buscar en las notas"
                value={value}
                disabled={disabled}
                onChange={(event) => {
                    onChange(event.target.value);
                }}
            />
        </label>
    );
}
