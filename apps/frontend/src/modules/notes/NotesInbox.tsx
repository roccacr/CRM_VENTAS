import MessageOutlined from "@ant-design/icons/MessageOutlined";
import SnippetsOutlined from "@ant-design/icons/SnippetsOutlined";
import { useCallback, useEffect, useRef, useState } from "react";

import { getNoteInbox, getNoteInboxAuthors, type NoteInbox, type NoteInboxFilters } from "../../services/notes/note-collaboration-service";
import { getNoteWorkflowOverview, type NoteWorkflowOverview } from "../../services/notes/note-workflow-service";
import type { NoteModule } from "../../services/notes/notes-service";
import { setNoteState } from "../../services/notes/notes-service";
import { projectNoteState } from "./note-state";
import { CardAction, NoteCard, NoteLifecycleActions } from "./NoteCard";
import { NotesLoading } from "./NotesLoading";
import { useBackgroundNoteActions } from "./useBackgroundNoteActions";
import { useNotesRealtime } from "./useNotesRealtime";
export type NotesInboxKind = "all" | "created" | "shared" | "mentions" | "assigned";
interface Props {
    readonly kind: NotesInboxKind;
    readonly status: "open" | "completed" | "archived" | "all";
    readonly query: string;
    readonly refreshVersion: number;
    readonly onOpenNote: (id: string) => void;
}
function whereOf(kind: NonNullable<NoteInbox["items"][number]["context"]>["kind"] | undefined): string {
    if (kind === undefined) return "Vínculo restringido";
    if (kind === "personal") return "Personal";
    return kind === "sales_order" ? "Orden" : "Vista";
}
function InboxList({ items, onOpenNote, onState, pending }: { readonly items: NoteInbox["items"]; readonly onOpenNote: (id: string) => void; readonly onState: (note: NoteInbox["items"][number], action: "complete" | "reopen" | "archive") => void; readonly pending: (id: string) => boolean }) {
    return (
        <ul className="personal-notes-list">
            {items.map((note) => (
                <NoteCard
                    key={note.id}
                    note={note}
                    where={whereOf(note.context?.kind)}
                    locked={false}
                    onOpen={() => {
                        onOpenNote(note.id);
                    }}
                    actions={
                        <>
                            <NoteLifecycleActions
                                note={note}
                                disabled={pending(note.id)}
                                onState={(action) => {
                                    onState(note, action);
                                }}
                            />
                            <CardAction
                                label="Abrir conversación"
                                icon={<MessageOutlined />}
                                disabled={false}
                                onClick={() => {
                                    onOpenNote(note.id);
                                }}
                            />
                        </>
                    }
                />
            ))}
        </ul>
    );
}
/** Inbox references are reauthorized by the server; opening always reloads the current thread. */
export function NotesInbox({ kind, status, query, refreshVersion, onOpenNote }: Props) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState(query);
    const [moduleCode, setModuleCode] = useState<NoteModule | "">("");
    const [authorUserId, setAuthorUserId] = useState("");
    const [advanced, setAdvanced] = useState<AdvancedFilters>(() => {
        const now = new Date();
        const month = `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return { createdFrom: `${month}-01T00:00`, createdTo: `${month}-${String(lastDay)}T23:59` };
    });
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(query);
            setPage(1);
        }, 300);
        return () => {
            window.clearTimeout(timer);
        };
    }, [query]);
    const [data, setData] = useState<NoteInbox | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const generation = useRef(0);
    const alive = useRef(true);
    const load = useCallback(async () => {
        const current = ++generation.current;
        setLoading(true);
        try {
            const result = await getNoteInbox(kind, status, page, inboxFilters({ search, moduleCode, authorUserId }, advanced));
            if (alive.current && current === generation.current) {
                setData(result);
                setError("");
            }
        } catch {
            if (alive.current && current === generation.current) {
                setData(null);
                setError("No se pudieron consultar las notas. Reintenta para comprobar tu acceso.");
            }
        } finally {
            if (alive.current && current === generation.current) setLoading(false);
        }
    }, [kind, status, page, search, moduleCode, authorUserId, advanced]);
    const background = useBackgroundNoteActions(data, () => {
        void load();
    });
    const state = (note: NoteInbox["items"][number], action: "complete" | "reopen" | "archive") => {
        const operation = crypto.randomUUID();
        const next = action === "complete" ? "completed" : action === "reopen" ? "open" : "archived";
        const project = (current: NoteInbox | null): NoteInbox | null => {
            if (!current) return null;
            const items = current.items.map((item) => (item.id === note.id ? projectNoteState(item, next) : item)).filter((item) => status === "all" || item.status === status);
            return { ...current, items, page: { ...current.page, total: Math.max(0, current.page.total - current.items.length + items.length) } };
        };
        background.run({
            key: note.id,
            label: `${action === "complete" ? "Completar" : action === "reopen" ? "Reabrir" : "Archivar"} nota`,
            request: () => setNoteState(note.moduleCode, note.id, action, note.version, operation),
            project,
            commit: (result) => {
                setData((current) => {
                    const updated = project(current);
                    return updated ? { ...updated, items: updated.items.map((item) => (item.id === note.id ? { ...item, version: result.version } : item)) } : null;
                });
            },
        });
    };
    useEffect(() => {
        alive.current = true;
        void Promise.resolve().then(load);
        return () => {
            alive.current = false;
        };
    }, [load, refreshVersion]);
    useNotesRealtime("revoke", (event) => {
        generation.current += 1;
        setData((current) => (current ? { ...current, items: current.items.filter((note) => note.id !== event?.noteId) } : null));
    });
    const visible = background.value;
    return (
        <section className="note-inbox" aria-label="Bandeja de notas">
            <WorkflowOverview refreshVersion={refreshVersion} />
            <details className="note-inbox-filtercard">
                <summary>
                    <span>Filtros</span>
                    <em>{(moduleCode ? 1 : 0) + (authorUserId ? 1 : 0)}</em>
                </summary>
                <div className="note-inbox-filters">
                    <label>
                        Módulo
                        <select
                            aria-label="Filtrar notas por módulo"
                            value={moduleCode}
                            onChange={(event) => {
                                setModuleCode(event.target.value as NoteModule | "");
                                setPage(1);
                            }}
                        >
                            <option value="">Todos</option>
                            <option value="ventas">Ventas</option>
                            <option value="mercadeo">Mercadeo</option>
                            <option value="formalizacion">Formalización</option>
                            <option value="contabilidad">Contabilidad</option>
                            <option value="administration">Administración</option>
                        </select>
                    </label>
                    <InboxAuthorSelect
                        value={authorUserId}
                        fallback={inboxAuthors(data)}
                        refreshVersion={refreshVersion}
                        onChange={(value) => {
                            setAuthorUserId(value);
                            setPage(1);
                        }}
                    />
                </div>
                <AdvancedInboxFilters
                    value={advanced}
                    onApply={(value) => {
                        setAdvanced(value);
                        setPage(1);
                    }}
                />
            </details>
            {background.feedback}
            {error && (
                <div role="alert" className="personal-notes-panel__error">
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={() => {
                            void load();
                        }}
                    >
                        Reintentar bandeja
                    </button>
                </div>
            )}
            {loading && <NotesLoading label="Cargando notas…" />}
            {visible && (
                <>
                    <InboxList items={visible.items} onOpenNote={onOpenNote} onState={state} pending={background.pending} />
                    {visible.items.length === 0 && (
                        <div className="personal-notes-panel__empty">
                            <SnippetsOutlined aria-hidden="true" />
                            <p>No hay notas en esta bandeja y estado.</p>
                        </div>
                    )}
                    <div className="note-pagination personal-notes-panel__pages">
                        <button
                            type="button"
                            disabled={loading || page === 1}
                            onClick={() => {
                                setPage((p) => p - 1);
                            }}
                        >
                            Notas anteriores
                        </button>
                        <span>
                            {visible.page.total} {visible.page.total === 1 ? "nota" : "notas"} · Página {page}
                        </span>
                        <button
                            type="button"
                            disabled={loading || page * visible.page.size >= visible.page.total}
                            onClick={() => {
                                setPage((p) => p + 1);
                            }}
                        >
                            Notas siguientes
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}

interface AdvancedFilters {
    createdFrom: string;
    createdTo: string;
}
function inboxFilters(basic: { search: string; moduleCode: NoteModule | ""; authorUserId: string }, advanced: AdvancedFilters): NoteInboxFilters {
    const filters: NoteInboxFilters = { search: basic.search };
    for (const key of ["moduleCode", "authorUserId"] as const) if (basic[key]) Object.assign(filters, { [key]: basic[key] });
    for (const key of ["createdFrom", "createdTo"] as const) {
        if (!advanced[key]) continue;
        const date = new Date(advanced[key]);
        // datetime-local accepts minutes: include the whole final minute in the upper bound.
        if (key === "createdTo") date.setSeconds(59, 999);
        filters[key] = date.toISOString();
    }
    return filters;
}
function inboxAuthors(data: NoteInbox | null) {
    return Array.from(new Map((data?.items ?? []).map((note) => [note.author.publicId, note.author])).values());
}

function WorkflowOverview({ refreshVersion }: { readonly refreshVersion: number }) {
    const [data, setData] = useState<NoteWorkflowOverview | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        void getNoteWorkflowOverview()
            .then((result) => {
                if (active) {
                    setData(result);
                    setFailed(false);
                }
            })
            .catch(() => {
                if (active) {
                    setData(null);
                    setFailed(true);
                }
            });
        return () => {
            active = false;
        };
    }, [refreshVersion]);
    if (failed) return <p role="status">Resumen de seguimiento no disponible.</p>;
    if (!data) return null;
    return (
        <p className="note-workflow-overview" title="Notas abiertas asignadas a ti. El vencimiento de hoy usa el día de tu zona horaria; vencidas compara con la hora actual.">
            <span>{data.counts.assigned} asignadas</span>
            <span>
                {data.counts.dueToday} vencen hoy ({data.timeZone})
            </span>
            <span data-alert={data.counts.overdue > 0}>{data.counts.overdue} vencidas</span>
            {data.truncated && <span>Recuento parcial</span>}
        </p>
    );
}

function InboxAuthorSelect({ value, fallback, refreshVersion, onChange }: { readonly value: string; readonly fallback: { publicId: string; displayName: string }[]; readonly refreshVersion: number; readonly onChange: (value: string) => void }) {
    const [authors, setAuthors] = useState<{ publicId: string; displayName: string }[] | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        void Promise.resolve()
            .then(() => getNoteInboxAuthors())
            .then((people) => {
                if (active) {
                    setAuthors(people);
                    setFailed(false);
                }
            })
            .catch(() => {
                if (active) {
                    setAuthors(null);
                    setFailed(true);
                }
            });
        return () => {
            active = false;
        };
    }, [refreshVersion]);
    return (
        <label>
            Autor
            <select
                aria-label="Filtrar notas por autor"
                value={value}
                onChange={(event) => {
                    onChange(event.target.value);
                }}
            >
                <option value="">Todos</option>
                {(authors ?? fallback).map((person) => (
                    <option key={person.publicId} value={person.publicId}>
                        {person.displayName}
                    </option>
                ))}
            </select>
            {failed && <small role="status">No se pudo cargar el directorio completo; se muestran autores de esta página.</small>}
        </label>
    );
}
function AdvancedInboxFilters({ value, onApply }: { readonly value: AdvancedFilters; readonly onApply: (value: AdvancedFilters) => void }) {
    const [draft, setDraft] = useState(value);
    return (
        <details className="note-inbox-advanced">
            <summary>Fecha de creación</summary>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onApply(draft);
                }}
            >
                <div className="note-inbox-filters">
                    <label>
                        Creada desde (hora local)
                        <input
                            type="datetime-local"
                            value={draft.createdFrom}
                            max={draft.createdTo}
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, createdFrom: event.target.value }));
                            }}
                        />
                    </label>
                    <label>
                        Creada hasta (hora local)
                        <input
                            type="datetime-local"
                            value={draft.createdTo}
                            min={draft.createdFrom}
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, createdTo: event.target.value }));
                            }}
                        />
                    </label>
                </div>
                <button type="submit">Aplicar fechas</button>
                <button
                    type="button"
                    onClick={() => {
                        const empty = { createdFrom: "", createdTo: "" };
                        setDraft(empty);
                        onApply(empty);
                    }}
                >
                    Limpiar fechas
                </button>
            </form>
        </details>
    );
}
