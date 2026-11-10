import "../administration/components/UserDetailDrawer.css";
import "./PersonalNotes.css";

import AlignLeftOutlined from "@ant-design/icons/AlignLeftOutlined";
import BgColorsOutlined from "@ant-design/icons/BgColorsOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import FlagOutlined from "@ant-design/icons/FlagOutlined";
import LinkOutlined from "@ant-design/icons/LinkOutlined";
import MessageOutlined from "@ant-design/icons/MessageOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import PushpinOutlined from "@ant-design/icons/PushpinOutlined";
import Drawer from "antd/es/drawer";
import Typography from "antd/es/typography";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import { FormSwitch } from "../../components/forms/FormSwitch";
import { ApiClientError } from "../../services/api/api-client";
import { type NoteParticipant, replaceNoteParticipants } from "../../services/notes/note-collaboration-service";
import type { NoteRelatedRecord } from "../../services/notes/note-related-records-service";
import { createNote, editNote, getNotes, normalizeNoteContext, type NoteCommandResult, type NoteContext, type NoteFields, type NoteModule, type NotePlacement, type PersonalNote, setNoteState } from "../../services/notes/notes-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { matchesNote } from "./note-search";
import { projectNoteState } from "./note-state";
import { CardAction, NoteCard, NoteLifecycleActions, NotesSearch } from "./NoteCard";
import { NoteCollaborationDrawer } from "./NoteCollaborationDrawer";
import { NoteNotificationsButton } from "./NoteNotifications";
import { NoteParticipantsPicker } from "./NoteParticipantsPicker";
import { NoteRelatedRecordsPicker, NoteRelatedRecordsSummary } from "./NoteRelatedRecords";
import { NoteSheet } from "./NoteSheet";
import { NotesInbox, type NotesInboxKind } from "./NotesInbox";
import { NotesLoading } from "./NotesLoading";
import { NotesSavingOverlay } from "./NotesSavingOverlay";
import { useBackgroundNoteActions } from "./useBackgroundNoteActions";
import { type PlacementSaveState, useNotePlacements } from "./useNotePlacements";
import { useNotesRealtime } from "./useNotesRealtime";

const NOTE_INBOXES: readonly { code: "context" | NotesInboxKind; label: string }[] = [
    { code: "all", label: "Todas" },
    { code: "context", label: "En esta vista" },
    { code: "created", label: "Creadas por mí" },
    { code: "shared", label: "Compartidas conmigo" },
    { code: "mentions", label: "Menciones" },
    { code: "assigned", label: "Asignadas a mí" },
];

type Target = { context: NoteContext; label: string } | null;
const HOME_TARGET: NonNullable<Target> = { context: { kind: "view" }, label: "Inicio" };
const PERSONAL_CONTEXT: NoteContext = { kind: "personal" };
const PERSONAL_TARGET: NonNullable<Target> = { context: PERSONAL_CONTEXT, label: "Mis notas personales" };
const NOTE_MODULES: readonly NoteModule[] = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"];
function resolveModule(moduleCode: string | undefined, permissions: readonly Permission[]): NoteModule | undefined {
    if (moduleCode) return NOTE_MODULES.find((code) => code === moduleCode);
    return NOTE_MODULES.find((code) => allowed(permissions, code, "read"));
}
function routeOrderTarget(moduleCode: string | undefined, path: string, search: string): Target | undefined {
    if (!moduleCode || !/^\/home\/(formalization|sales|marketing|accounting)(?:\/|$)/.test(path)) return undefined;
    const query = new URLSearchParams(search);
    if (!query.has("orderSource") && !query.has("orderId")) return undefined;
    const source = query.get("orderSource");
    const id = query.get("orderId");
    if ((source !== "native" && source !== "legacy") || !id) return PERSONAL_TARGET;
    return { context: normalizeNoteContext({ kind: "sales_order", source, id }), label: `Orden de venta ${id}` };
}
type Permission = { readonly code: string; readonly effect: "allow" | "deny" };
const NotesContext = createContext<{ visible: boolean; available: boolean; open: () => void; openNote: (id: string) => void; setTarget: (target: Target | undefined) => void } | null>(null);
const allowed = (permissions: readonly Permission[], module: string, action: string) => !permissions.some((p) => p.code === `${module}.notes.${action}` && p.effect === "deny") && permissions.some((p) => p.code === `${module}.notes.${action}` && p.effect === "allow");
const emptyFields: NoteFields = { title: "", text: "", color: "#FFF3B0", priority: "normal" };
function viewport(): NotePlacement["viewportClass"] {
    if (window.innerWidth < 768) return "mobile";
    return window.innerWidth < 1200 ? "tablet" : "desktop";
}
function placementFor(note: PersonalNote, index = 0): NotePlacement {
    return note.myPlacements.find((p) => p.viewportClass === viewport()) ?? { viewportClass: viewport(), anchorMode: "context", x: Math.max(12, window.innerWidth - 340 - (index % 3) * 24), y: window.scrollY + 160 + (index % 5) * 42, width: 300, height: 230, collapsed: false, hidden: false, layoutVersion: 0 };
}

/** Entrada del encabezado junto a la campana, con el mismo trato de ícono en escritorio y en móvil. */
export function NotesButton({ mobile = false }: { readonly mobile?: boolean }) {
    const notes = useContext(NotesContext);
    if (!notes?.visible) return null;
    return (
        <button className={mobile ? "global-home-mobile-bar__icon-button" : "global-home-header__icon-button"} type="button" aria-label="Mis notas" title="Mis notas" disabled={!notes.available} onClick={notes.open}>
            <FileTextOutlined aria-hidden="true" />
        </button>
    );
}

/** La campana del encabezado abre solo conversaciones que el servidor autorizó, en el mismo proveedor de notas. */
export function NotesNotificationsButton({ mobile = false }: { readonly mobile?: boolean }) {
    const notes = useContext(NotesContext);
    return <NoteNotificationsButton mobile={mobile} enabled={Boolean(notes?.visible)} onOpenNote={(id) => notes?.openNote(id)} />;
}

/** Una orden real reemplaza la vista genérica y conserva la identidad de su origen. */
export function NotesTarget({ source, id, label }: { readonly source: "native" | "legacy"; readonly id: string; readonly label: string }) {
    const setTarget = useContext(NotesContext)?.setTarget;
    useEffect(() => {
        setTarget?.({ context: normalizeNoteContext({ kind: "sales_order", source, id }), label });
        return () => setTarget?.(undefined);
    }, [source, id, label, setTarget]);
    return null;
}

/** Solo los permisos efectivos de notas montan el cliente. El nombre del rol y Owner no abren un atajo. */
export function PersonalNotesProvider({ moduleCode, permissions, homeEnabled, viewCode, viewLabel, children }: { readonly moduleCode: string | undefined; readonly permissions: readonly Permission[]; readonly homeEnabled: boolean; readonly viewCode?: string | undefined; readonly viewLabel?: string | undefined; readonly children: ReactNode }) {
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [threadOpen, setThreadOpen] = useState(false);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const openNote = useCallback((id: string) => {
        setSelectedNoteId(id);
        setThreadOpen(true);
    }, []);
    const refreshNotes = useCallback(() => {
        setRefreshVersion((v) => v + 1);
    }, []);
    useNotesRealtime("snapshot", refreshNotes);
    useNotesRealtime("revoke", (event) => {
        if (event?.noteId === selectedNoteId) {
            setSelectedNoteId(null);
            setThreadOpen(false);
        }
        refreshNotes();
    });
    const [target, setTarget] = useState<Target | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const resolvedModule = resolveModule(moduleCode, permissions);
    const visible = Boolean(resolvedModule && allowed(permissions, resolvedModule, "read"));
    const path = window.location.pathname;
    const search = window.location.search;
    const baseTarget = useMemo<NonNullable<Target>>(() => {
        const order = routeOrderTarget(resolvedModule, path, search);
        if (order) return order;
        if (!moduleCode) return PERSONAL_TARGET;
        if (homeEnabled) return HOME_TARGET;
        return viewCode ? { context: { kind: "view", code: viewCode }, label: viewLabel ?? "Vista actual" } : PERSONAL_TARGET;
    }, [resolvedModule, moduleCode, homeEnabled, viewCode, viewLabel, path, search]);
    const effective = target ?? baseTarget;
    const key = JSON.stringify([resolvedModule, effective.context]);
    const available = visible;
    return (
        <NotesContext.Provider
            value={{
                visible,
                available,
                open: () => {
                    setOpen(true);
                },
                openNote,
                setTarget,
            }}
        >
            {children}
            {resolvedModule && visible && (
                <NotesWorkspace
                    key={key}
                    moduleCode={resolvedModule}
                    target={effective}
                    refreshVersion={refreshVersion}
                    canShare={allowed(permissions, resolvedModule, "share_own")}
                    canCreate={allowed(permissions, resolvedModule, "create")}
                    open={open}
                    onOpen={() => {
                        setOpen(true);
                    }}
                    onClose={() => {
                        setOpen(false);
                    }}
                />
            )}
            <NoteCollaborationDrawer
                noteId={selectedNoteId}
                open={threadOpen}
                onClose={() => {
                    setThreadOpen(false);
                }}
                onChanged={refreshNotes}
            />
        </NotesContext.Provider>
    );
}

interface WorkspaceProps {
    readonly refreshVersion: number;
    readonly canShare: boolean;
    readonly moduleCode: NoteModule;
    readonly target: NonNullable<Target>;
    readonly canCreate: boolean;
    readonly open: boolean;
    readonly onOpen: () => void;
    readonly onClose: () => void;
}
interface Attempt {
    request: () => Promise<NoteCommandResult>;
    after: (result: NoteCommandResult) => void;
}
/** Un contexto con clave es dueño de sus peticiones y borradores. Una respuesta vieja no aparece en otro registro. */
function NotesWorkspace({ moduleCode, target, canCreate, canShare, refreshVersion, open, onOpen, onClose }: WorkspaceProps) {
    const notesContext = useContext(NotesContext);
    const [mode, setMode] = useState<"context" | NotesInboxKind>("all");
    const [invitees, setInvitees] = useState<NoteParticipant[]>([]);
    const [relatedRecords, setRelatedRecords] = useState<NoteRelatedRecord[]>([]);
    const createdDraft = useRef<NoteCommandResult | null>(null);
    const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
    const [items, setItems] = useState<PersonalNote[]>([]);
    const placements = useNotePlacements(moduleCode, (id, placement) => {
        setItems((old) => old.map((row) => (row.id === id ? { ...row, myPlacements: [...row.myPlacements.filter((p) => p.viewportClass !== placement.viewportClass), placement] } : row)));
    });
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [query, setQuery] = useState("");
    const [personal, setPersonal] = useState(target.context.kind === "personal");
    const [linkCurrent, setLinkCurrent] = useState(false);
    const queryContext = personal ? PERSONAL_CONTEXT : target.context;
    const [status, setStatus] = useState<"open" | "completed" | "archived" | "all">("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState(false);
    const [editor, setEditor] = useState<{ note: PersonalNote | null; fields: NoteFields } | null>(null);
    const [screenSize, setScreenSize] = useState(() => `${viewport()}:${String(window.innerWidth)}:${String(window.innerHeight)}`);
    useEffect(() => {
        const resize = () => {
            setScreenSize(`${viewport()}:${String(window.innerWidth)}:${String(window.innerHeight)}`);
        };
        window.addEventListener("resize", resize);
        return () => {
            window.removeEventListener("resize", resize);
        };
    }, []);
    const inFlight = useRef(false);
    const alive = useRef(true);
    const generation = useRef(0);
    const attempt = useRef<Attempt | null>(null);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const load = useCallback(async () => {
        const version = ++generation.current;
        const isCurrent = () => alive.current && version === generation.current;
        try {
            const result = await getNotes(moduleCode, queryContext, status, page);
            if (!isCurrent()) return;
            setItems(result.items);
            setTotal(result.total);
            if (!attempt.current) setError("");
        } catch {
            if (isCurrent()) {
                setItems([]);
                setError("No se pudieron consultar tus notas. Reintenta para comprobar tu acceso y conexión.");
            }
        } finally {
            if (isCurrent()) setLoading(false);
        }
    }, [moduleCode, queryContext, status, page]);
    const background = useBackgroundNoteActions(items, () => {
        void load();
    });
    useEffect(() => {
        void Promise.resolve().then(load);
    }, [load, refreshVersion]);
    useNotesRealtime("revoke", (event) => {
        generation.current += 1;
        setItems((current) => current.filter((note) => note.id !== event?.noteId));
    });
    const handleFailure = (failure: unknown) => {
        if (!alive.current) return;
        setError(commandError(failure));
        if (!(failure instanceof ApiClientError) || failure.status >= 500) return;
        if (createdDraft.current) return;
        attempt.current = null;
        setPending(false);
        if ([401, 403, 404].includes(failure.status)) {
            setItems([]);
            setEditor(null);
        }
    };
    const execute = async (current: Attempt) => {
        if (inFlight.current) return;
        inFlight.current = true;
        attempt.current = current;
        setPending(true);
        setBusy(true);
        setNotice("");
        setError("");
        try {
            const result = await current.request();
            if (!alive.current) return;
            attempt.current = null;
            setPending(false);
            current.after(result);
            setNotice("Guardado");
        } catch (failure) {
            handleFailure(failure);
        } finally {
            inFlight.current = false;
            if (alive.current) setBusy(false);
        }
    };
    const mutate = (request: () => Promise<NoteCommandResult>, destination = personal, created = false) => {
        void execute({
            request,
            after: () => {
                setEditor(null);
                createdDraft.current = null;
                setCreatedDraftId(null);
                setInvitees([]);
                setRelatedRecords([]);
                if (created) {
                    setPage(1);
                    setStatus("all");
                }
                if (destination !== personal) {
                    setPersonal(destination);
                    return;
                }
                if (created && (page !== 1 || status !== "all")) return;
                void load();
            },
        });
    };
    const save = () => {
        if (!editor || busy || attempt.current) return;
        const fields = { ...editor.fields, title: editor.fields.title?.trim() || null };
        const operation = crypto.randomUUID();
        const note = editor.note;
        const context = linkCurrent ? target.context : PERSONAL_CONTEXT;
        const shareOperation = crypto.randomUUID();
        const participants = invitees.map(({ userId, access }) => ({ userId, access }));
        const recordReferences = relatedRecords.flatMap((record) => (record.reference ? [record.reference] : []));
        const request = async () => {
            if (note) return editNote(note.moduleCode ?? moduleCode, note.id, fields, note.version, operation);
            const result = createdDraft.current ?? (recordReferences.length ? await createNote(moduleCode, context, fields, operation, recordReferences) : await createNote(moduleCode, context, fields, operation));
            createdDraft.current = result;
            if (alive.current) setCreatedDraftId(result.noteId);
            if (participants.length) await replaceNoteParticipants(result.noteId, { operationId: shareOperation, expectedCollaborationVersion: 1, participants });
            return result;
        };
        mutate(request, note ? personal : context.kind === "personal", !note);
    };
    const saveLayout = (note: PersonalNote, placement: NotePlacement) => {
        placements.save(note.id, placement, note.moduleCode ?? moduleCode);
    };
    const edit = (note: PersonalNote) => {
        setEditor({ note, fields: { title: note.title, text: note.content.text, color: note.color, priority: note.priority } });
    };
    const state = (note: PersonalNote, action: "complete" | "reopen" | "archive") => {
        const operation = crypto.randomUUID();
        const nextStatus = action === "complete" ? "completed" : action === "reopen" ? "open" : "archived";
        const project = (rows: PersonalNote[]) => rows.map((row) => (row.id === note.id ? projectNoteState(row, nextStatus) : row));
        background.run({
            key: note.id,
            label: `${action === "complete" ? "Completar" : action === "reopen" ? "Reabrir" : "Archivar"} nota`,
            request: () => setNoteState(note.moduleCode ?? moduleCode, note.id, action, note.version, operation),
            project,
            commit: (result) => {
                setItems((rows) => project(rows).map((row) => (row.id === note.id ? { ...row, version: result.version } : row)));
            },
        });
    };
    const locked = busy || pending;
    const pageLocked = loading || locked;
    return (
        <>
            <NoteCanvas
                items={background.value}
                loading={loading}
                screenSize={screenSize}
                locked={locked}
                saveLayout={saveLayout}
                placementStates={placements.states}
                retryPlacement={placements.retry}
                edit={(note) => {
                    edit(note);
                    onOpen();
                }}
            />
            <Drawer {...ADMINISTRATION_DRAWER_PROPS} rootClassName="user-detail-drawer personal-notes-drawer" title={<NotesIdentity target={target} />} open={open} onClose={onClose} closable={{ placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }} destroyOnHidden={false}>
                <div className="personal-notes-panel">
                    {background.feedback}
                    <NotesFeedback
                        error={error}
                        pending={pending}
                        busy={busy}
                        notice={notice}
                        retry={() => {
                            if (attempt.current) void execute(attempt.current);
                        }}
                        reload={() => {
                            setEditor(null);
                            void load();
                        }}
                    />
                    <ConfirmedDraftNotice
                        id={createdDraftId}
                        pending={pending}
                        busy={busy}
                        onKeep={() => {
                            if (!createdDraftId) return;
                            createdDraft.current = null;
                            setCreatedDraftId(null);
                            attempt.current = null;
                            setPending(false);
                            setEditor(null);
                            setInvitees([]);
                            notesContext?.openNote(createdDraftId);
                            void load();
                        }}
                    />
                    {editor ? (
                        <NoteEditor
                            relatedRecords={relatedRecords}
                            onRelatedRecords={setRelatedRecords}
                            invitees={invitees}
                            onInvitees={setInvitees}
                            moduleCode={moduleCode}
                            canShare={canShare}
                            onConversation={() => {
                                if (editor.note) notesContext?.openNote(editor.note.id);
                            }}
                            fields={editor.fields}
                            linkCurrent={linkCurrent}
                            onLinkChange={setLinkCurrent}
                            destination={target}
                            note={editor.note}
                            canCreate={canCreate}
                            locked={locked}
                            onChange={(fields) => {
                                setEditor({ ...editor, fields });
                            }}
                            onSave={save}
                            onCancel={() => {
                                setEditor(null);
                            }}
                        />
                    ) : (
                        <>
                            <nav className="personal-notes-inboxes" aria-label="Bandejas de notas">
                                {NOTE_INBOXES.map((item) => (
                                    <button
                                        key={item.code}
                                        type="button"
                                        aria-current={mode === item.code ? "page" : undefined}
                                        disabled={locked}
                                        onClick={() => {
                                            setMode(item.code);
                                            setPage(1);
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </nav>
                            <div className="personal-notes-controls">
                                <NotesScope
                                    visible={mode === "context"}
                                    personal={personal}
                                    target={target}
                                    locked={locked}
                                    onChange={(value) => {
                                        setPersonal(value);
                                        setPage(1);
                                    }}
                                />
                                <NotesSearch value={query} onChange={setQuery} disabled={locked} />
                                <NotesListTools
                                    canCreate={canCreate}
                                    locked={locked}
                                    status={status}
                                    onNew={() => {
                                        setNotice("");
                                        setLinkCurrent(false);
                                        setInvitees([]);
                                        setRelatedRecords([]);
                                        createdDraft.current = null;
                                        setCreatedDraftId(null);
                                        setEditor({ note: null, fields: { ...emptyFields } });
                                    }}
                                    onStatus={(value) => {
                                        setStatus(value);
                                        setPage(1);
                                    }}
                                />
                            </div>
                            {mode !== "context" ? (
                                <NotesInbox key={`${mode}:${status}`} kind={mode} status={status} query={query} refreshVersion={refreshVersion} onOpenNote={(id) => notesContext?.openNote(id)} />
                            ) : loading ? (
                                <NotesLoading label="Cargando tus notas…" />
                            ) : (
                                <NoteList
                                    query={query}
                                    where={whereLabel(personal, target)}
                                    items={background.value.filter((note) => status === "all" || note.status === status)}
                                    statePending={background.pending}
                                    locked={locked}
                                    onEdit={edit}
                                    onConversation={(note) => notesContext?.openNote(note.id)}
                                    onState={state}
                                    onShow={(note) => {
                                        saveLayout(note, { ...placementFor(note), hidden: false, collapsed: false });
                                    }}
                                />
                            )}
                            {mode === "context" && <NotesPager page={page} total={total} locked={pageLocked} onPage={setPage} />}
                        </>
                    )}
                </div>
            </Drawer>
        </>
    );
}
function ConfirmedDraftNotice({ id, pending, busy, onKeep }: { readonly id: string | null; readonly pending: boolean; readonly busy: boolean; readonly onKeep: () => void }) {
    if (!id || !pending || busy) return null;
    return (
        <div role="status">
            <p>La nota ya fue creada. La invitación todavía no está confirmada. Reintentar conserva la misma nota y operación.</p>
            <button type="button" disabled={busy} onClick={onKeep}>
                Conservar nota y revisar conversación
            </button>
        </div>
    );
}
function commandError(error: unknown): string {
    if (!(error instanceof ApiClientError)) return "No pudimos confirmar el guardado. Reintenta la misma operación para evitar duplicarla.";
    if (error.status >= 500) return "No pudimos confirmar el guardado. Reintenta la misma operación para evitar duplicarla.";
    if (error.status === 409) return "La nota cambió en otra ventana. Recarga las notas antes de volver a editar.";
    if ([401, 403, 404].includes(error.status)) return "La nota o tu acceso ya no están disponibles. Vuelve a consultar tus notas.";
    return "No se pudo guardar la nota. Revisa los datos y vuelve a intentarlo.";
}
/** Para quién es el panel y dónde está abierto, en el mismo bloque de identidad que los otros paneles laterales. */
function NotesIdentity({ target }: { readonly target: NonNullable<Target> }) {
    return (
        <div className="user-detail-drawer__identity">
            <span className="personal-notes-drawer__avatar" aria-hidden="true">
                <FileTextOutlined />
            </span>
            <div className="user-detail-drawer__identity-copy">
                <Typography.Title level={4}>Mis notas</Typography.Title>
                <Typography.Text type="secondary">Personales y compartidas · {target.label}</Typography.Text>
            </div>
        </div>
    );
}
function NotesPager({ page, total, locked, onPage }: { readonly page: number; readonly total: number; readonly locked: boolean; readonly onPage: (update: (page: number) => number) => void }) {
    return (
        <div className="personal-notes-panel__pages">
            <button
                type="button"
                disabled={page === 1 || locked}
                onClick={() => {
                    onPage((value) => value - 1);
                }}
            >
                Anterior
            </button>
            <span>
                {total} {total === 1 ? "nota" : "notas"} · Página {page}
            </span>
            <button
                type="button"
                disabled={page * 100 >= total || locked}
                onClick={() => {
                    onPage((value) => value + 1);
                }}
            >
                Siguiente
            </button>
        </div>
    );
}
interface EditorProps {
    readonly relatedRecords: NoteRelatedRecord[];
    readonly onRelatedRecords: (value: NoteRelatedRecord[]) => void;
    readonly invitees: NoteParticipant[];
    readonly onInvitees: (value: NoteParticipant[]) => void;
    readonly moduleCode: NoteModule;
    readonly canShare: boolean;
    readonly onConversation: () => void;
    readonly linkCurrent: boolean;
    readonly onLinkChange: (value: boolean) => void;
    readonly destination: NonNullable<Target>;
    readonly fields: NoteFields;
    readonly note: PersonalNote | null;
    readonly canCreate: boolean;
    readonly locked: boolean;
    readonly onChange: (fields: NoteFields) => void;
    readonly onSave: () => void;
    readonly onCancel: () => void;
}
const NOTE_COLORS: readonly (readonly [color: string, name: string])[] = [
    ["#FFF3B0", "Amarillo suave"],
    ["#DFF3E7", "Verde suave"],
    ["#DFECFA", "Azul suave"],
    ["#EEE4F7", "Lila suave"],
];
/** El color de la nota en cuatro muestras. Lo que se elige es el color que tendrá la nota. */
function ColorChoice({ value, disabled, onChange }: { readonly value: string; readonly disabled: boolean; readonly onChange: (color: string) => void }) {
    const options = NOTE_COLORS.some(([color]) => color === value) ? NOTE_COLORS : [...NOTE_COLORS, [value, "Color guardado"] as const];
    return (
        <div className="personal-notes-colors" role="radiogroup" aria-label="Color de la nota">
            {options.map(([color, name]) => (
                <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={value === color}
                    aria-label={name}
                    title={name}
                    disabled={disabled}
                    style={{ background: color }}
                    onClick={() => {
                        onChange(color);
                    }}
                />
            ))}
        </div>
    );
}
function EditorOptions({ fields, readonly, onChange }: { readonly fields: NoteFields; readonly readonly: boolean; readonly onChange: (fields: NoteFields) => void }) {
    return (
        <div className="personal-notes-editor__options">
            <div className="personal-notes-field">
                <NoteCaption icon={<BgColorsOutlined />}>Color</NoteCaption>
                <ColorChoice
                    value={fields.color}
                    disabled={readonly}
                    onChange={(color) => {
                        onChange({ ...fields, color });
                    }}
                />
            </div>
            <label>
                <NoteCaption icon={<FlagOutlined />}>Prioridad</NoteCaption>
                <select
                    value={fields.priority}
                    disabled={readonly}
                    onChange={(e) => {
                        onChange({ ...fields, priority: e.target.value as NoteFields["priority"] });
                    }}
                >
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                </select>
            </label>
        </div>
    );
}
function NoteCaption({ icon, children }: { readonly icon: ReactNode; readonly children: ReactNode }) {
    return (
        <span className="note-caption">
            <i aria-hidden="true">{icon}</i>
            {children}
        </span>
    );
}
function editorTitle(canEdit: boolean, note: PersonalNote | null): string {
    if (!canEdit) return "Ver nota";
    return note ? "Editar nota" : "Nueva nota";
}
function EditorActions({ canEdit, locked, canSave, onCancel }: { readonly canEdit: boolean; readonly locked: boolean; readonly canSave: boolean; readonly onCancel: () => void }) {
    return (
        <div className="personal-notes-panel__tools">
            <button type="button" disabled={locked} onClick={onCancel}>
                Volver a mis notas
            </button>
            {canEdit && (
                <button className="personal-notes-primary" type="submit" disabled={locked || !canSave}>
                    Guardar nota
                </button>
            )}
        </div>
    );
}
function NoteEditor({ relatedRecords, onRelatedRecords, invitees, onInvitees, moduleCode, canShare, onConversation, fields, note, canCreate, locked, linkCurrent, onLinkChange, destination, onChange, onSave, onCancel }: EditorProps) {
    const canEdit = note?.capabilities.canEdit ?? canCreate;
    const readonly = locked || !canEdit;
    return (
        <form
            className="personal-notes-editor"
            onSubmit={(event) => {
                event.preventDefault();
                onSave();
            }}
        >
            <h3 className="personal-notes-editor__band">{editorTitle(canEdit, note)}</h3>
            <label>
                <NoteCaption icon={<EditOutlined />}>Título</NoteCaption>
                <input
                    maxLength={200}
                    value={fields.title ?? ""}
                    disabled={readonly}
                    onChange={(e) => {
                        onChange({ ...fields, title: e.target.value });
                    }}
                />
            </label>
            <label>
                <NoteCaption icon={<AlignLeftOutlined />}>Texto de la nota</NoteCaption>
                <textarea
                    autoFocus
                    required
                    rows={4}
                    maxLength={10000}
                    aria-label="Texto de la nota"
                    style={{ "--note": fields.color } as React.CSSProperties}
                    value={fields.text}
                    disabled={readonly}
                    onChange={(e) => {
                        onChange({ ...fields, text: e.target.value });
                    }}
                />
            </label>
            <span className="personal-notes-editor__count">{fields.text.length} / 10.000</span>
            <EditorOptions fields={fields} readonly={readonly} onChange={onChange} />
            <NoteLinkChoice existing={Boolean(note)} destination={destination} value={linkCurrent} locked={locked} onChange={onLinkChange} />
            <NoteEditorRelatedRecords note={note} moduleCode={moduleCode} selected={relatedRecords} onChange={onRelatedRecords} disabled={readonly} onConversation={onConversation} />
            <NoteCollaborationOptions note={note} canShare={canShare} moduleCode={moduleCode} context={linkCurrent ? destination.context : PERSONAL_CONTEXT} invitees={invitees} onInvitees={onInvitees} locked={locked} onConversation={onConversation} />
            <EditorActions canEdit={canEdit} locked={locked} canSave={Boolean(fields.text.trim())} onCancel={onCancel} />
            <p className="personal-notes-editor__foot">Privada: solo tú y las personas que invites la ven.</p>
        </form>
    );
}
interface CollaborationOptionsProps {
    readonly note: PersonalNote | null;
    readonly canShare: boolean;
    readonly moduleCode: NoteModule;
    readonly context: NoteContext;
    readonly invitees: NoteParticipant[];
    readonly onInvitees: (value: NoteParticipant[]) => void;
    readonly locked: boolean;
    readonly onConversation: () => void;
}
function NoteCollaborationOptions({ note, canShare, moduleCode, context, invitees, onInvitees, locked, onConversation }: CollaborationOptionsProps) {
    if (note)
        return (
            <button type="button" disabled={locked} onClick={onConversation}>
                Abrir conversación y participantes
            </button>
        );
    if (!canShare) return null;
    return (
        <details>
            <summary>Invitar personas (opcional)</summary>
            <p className="note-section-intro">
                <span>Se avisa por la campana</span>
                <FormHelp text="Verán la nota y su historial y recibirán un aviso en la campana. Sin invitados, solo tú la ves." />
            </p>
            <NoteParticipantsPicker draft={{ moduleCode, context }} value={invitees} onChange={onInvitees} disabled={locked} />
        </details>
    );
}
interface ListProps {
    readonly onConversation: (note: PersonalNote) => void;
    readonly items: PersonalNote[];
    readonly locked: boolean;
    readonly onEdit: (note: PersonalNote) => void;
    readonly onState: (note: PersonalNote, action: "complete" | "reopen" | "archive") => void;
    readonly onShow: (note: PersonalNote) => void;
}
function NoteList({ items, query, where, locked, onEdit, onState, onShow, onConversation, statePending }: ListProps & { readonly query: string; readonly where: string; readonly statePending: (id: string) => boolean }) {
    if (items.length === 0)
        return (
            <div className="personal-notes-panel__empty">
                <FileTextOutlined aria-hidden="true" />
                <h3>Tu espacio para recordar</h3>
                <p>No hay notas en este contexto y estado. Crea una para tener a mano tu próximo pendiente.</p>
            </div>
        );
    const shown = items.filter((note) => matchesNote(note, query));
    if (shown.length === 0) return <p className="personal-notes-panel__nomatch">Ninguna nota coincide con «{query.trim()}».</p>;
    return (
        <ul className="personal-notes-list">
            {shown.map((note) => (
                <NoteCard
                    key={note.id}
                    note={note}
                    where={where}
                    locked={locked}
                    onOpen={() => {
                        onEdit(note);
                    }}
                    actions={<ListActions note={note} locked={locked} stateLocked={statePending(note.id)} onConversation={onConversation} onShow={onShow} onState={onState} />}
                />
            ))}
        </ul>
    );
}
function whereLabel(personal: boolean, target: NonNullable<Target>): string {
    if (personal) return "Personal";
    return target.context.kind === "sales_order" ? "Orden" : "Vista";
}
function ListActions({ note, locked, stateLocked, onConversation, onShow, onState }: { readonly note: PersonalNote; readonly locked: boolean; readonly stateLocked: boolean; readonly onConversation: (note: PersonalNote) => void; readonly onShow: (note: PersonalNote) => void; readonly onState: ListProps["onState"] }) {
    return (
        <>
            <CardAction
                label="Conversación y participantes"
                icon={<MessageOutlined />}
                disabled={locked}
                onClick={() => {
                    onConversation(note);
                }}
            />
            {note.capabilities.canMove && (
                <CardAction
                    label="Mostrar en la vista"
                    icon={<PushpinOutlined />}
                    disabled={locked}
                    onClick={() => {
                        onShow(note);
                    }}
                />
            )}
            <NoteLifecycleActions
                note={note}
                disabled={locked || stateLocked}
                onState={(action) => {
                    onState(note, action);
                }}
            />
        </>
    );
}

interface CanvasProps {
    readonly loading: boolean;
    readonly items: PersonalNote[];
    readonly screenSize: string;
    readonly locked: boolean;
    readonly saveLayout: (note: PersonalNote, placement: NotePlacement) => void;
    readonly edit: (note: PersonalNote) => void;
    readonly placementStates: Record<string, PlacementSaveState>;
    readonly retryPlacement: (id: string, viewport: NotePlacement["viewportClass"]) => void;
}
function NoteCanvas({ loading, items, screenSize, locked, saveLayout, edit, placementStates, retryPlacement }: CanvasProps) {
    if (loading) return null;
    return (
        <>
            {items
                .filter((note) => note.status === "open")
                .map((note, index) => {
                    const placement = placementFor(note, index);
                    if (placement.hidden) return null;
                    return (
                        <NoteSheet
                            key={`${note.id}:${screenSize}`}
                            note={note}
                            placement={placement}
                            busy={locked}
                            saveState={placementStates[`${note.id}:${placement.viewportClass}`] ?? "saved"}
                            onRetry={() => {
                                retryPlacement(note.id, placement.viewportClass);
                            }}
                            onSave={(value) => {
                                saveLayout(note, value);
                            }}
                            onEdit={() => {
                                edit(note);
                            }}
                        />
                    );
                })}
        </>
    );
}
interface FeedbackProps {
    readonly error: string;
    readonly pending: boolean;
    readonly busy: boolean;
    readonly notice: string;
    readonly retry: () => void;
    readonly reload: () => void;
}
function NotesFeedback({ error, pending, busy, notice, retry, reload }: FeedbackProps) {
    return (
        <>
            {(error || (pending && !busy)) && (
                <div role="alert" className="personal-notes-panel__error">
                    <p>{error || "El guardado sigue pendiente de confirmación. Reintenta la misma operación."}</p>
                    <button type="button" disabled={busy} onClick={pending ? retry : reload}>
                        {pending ? "Reintentar el mismo guardado" : "Recargar notas y descartar cambios"}
                    </button>
                </div>
            )}
            {busy ? (
                <NotesSavingOverlay />
            ) : (
                <p className="personal-notes-panel__save" role="status">
                    {notice}
                </p>
            )}
        </>
    );
}

interface ListToolsProps {
    readonly canCreate: boolean;
    readonly locked: boolean;
    readonly status: "open" | "completed" | "archived" | "all";
    readonly onNew: () => void;
    readonly onStatus: (status: ListToolsProps["status"]) => void;
}
function NotesListTools({ canCreate, locked, status, onNew, onStatus }: ListToolsProps) {
    return (
        <div className="personal-notes-panel__tools">
            <button type="button" className="personal-notes-primary" disabled={!canCreate || locked} onClick={onNew}>
                <PlusOutlined aria-hidden="true" />
                Nueva nota
            </button>
            <label>
                Mostrar
                <select
                    aria-label="Estado de las notas"
                    value={status}
                    disabled={locked}
                    onChange={(event) => {
                        onStatus(event.target.value as ListToolsProps["status"]);
                    }}
                >
                    <option value="open">Pendientes</option>
                    <option value="completed">Completadas</option>
                    <option value="archived">Archivadas</option>
                    <option value="all">Todas</option>
                </select>
            </label>
        </div>
    );
}

interface ScopeProps {
    readonly visible: boolean;
    readonly personal: boolean;
    readonly target: NonNullable<Target>;
    readonly locked: boolean;
    readonly onChange: (value: boolean) => void;
}
function NotesScope({ personal, target, locked, onChange, visible }: ScopeProps) {
    if (!visible) return null;
    return (
        <label>
            Notas que quieres ver
            <select
                aria-label="Ubicación de las notas"
                value={personal ? "personal" : "current"}
                disabled={locked}
                onChange={(event) => {
                    onChange(event.target.value === "personal");
                }}
            >
                <option value="personal">Mis notas personales</option>
                {target.context.kind !== "personal" && <option value="current">En esta vista · {target.label}</option>}
            </select>
        </label>
    );
}
interface LinkChoiceProps {
    readonly existing: boolean;
    readonly destination: NonNullable<Target>;
    readonly value: boolean;
    readonly locked: boolean;
    readonly onChange: (value: boolean) => void;
}
function NoteLinkChoice({ existing, destination, value, locked, onChange }: LinkChoiceProps) {
    if (existing) return <p>La relación de esta nota se conserva al editarla.</p>;
    if (destination.context.kind === "personal") return <p>Esta será una nota personal, sin relación con una vista o transacción.</p>;
    return (
        <div className="personal-notes-link" data-linked={value}>
            <FormSwitch icon={<LinkOutlined />} label="Vincular esta nota a la vista actual" hint={value ? "Aparecerá aquí cuando vuelvas. No se comparte con nadie." : "Sin vincular, queda solo en tus notas personales."} checked={value} disabled={locked} onChange={onChange} />
            <strong className="personal-notes-link__target">{destination.label}</strong>
        </div>
    );
}

function NoteEditorRelatedRecords({ note, moduleCode, selected, onChange, disabled, onConversation }: { readonly note: PersonalNote | null; readonly moduleCode: NoteModule; readonly selected: NoteRelatedRecord[]; readonly onChange: (value: NoteRelatedRecord[]) => void; readonly disabled: boolean; readonly onConversation: () => void }) {
    const [expanded, setExpanded] = useState(false);
    if (note)
        return (
            <section className="note-related-records">
                <h4>Registros relacionados</h4>
                <NoteRelatedRecordsSummary records={note.relatedRecords ?? []} />
                <button type="button" disabled={disabled} onClick={onConversation}>
                    Gestionar vínculos en la conversación
                </button>
            </section>
        );
    return (
        <details
            className="note-related-records"
            onToggle={(event) => {
                setExpanded(event.currentTarget.open);
            }}
        >
            <summary>Relacionar con cliente u orden (opcional)</summary>
            {expanded && <NoteRelatedRecordsPicker moduleCode={moduleCode} selected={selected} onChange={onChange} disabled={disabled} />}
        </details>
    );
}
