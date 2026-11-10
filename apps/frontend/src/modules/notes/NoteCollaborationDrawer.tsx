import "./NoteCollaboration.css";

import CommentOutlined from "@ant-design/icons/CommentOutlined";
import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import Drawer from "antd/es/drawer";
import Typography from "antd/es/typography";
import { useCallback, useEffect, useRef, useState } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import { ApiClientError } from "../../services/api/api-client";
import { addNoteReply, editNoteReply, getNoteThread, type NoteParticipant, type NoteReply, type NoteThread, replaceNoteParticipants, setNoteFollowing, withdrawNoteReply } from "../../services/notes/note-collaboration-service";
import { editNote, type NoteContext, setNoteState } from "../../services/notes/notes-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { projectNoteState } from "./note-state";
import { NoteMentionField } from "./NoteMentionField";
import { NoteParticipantsPicker } from "./NoteParticipantsPicker";
import { NoteRelatedRecordsSection } from "./NoteRelatedRecords";
import { NotesLoading } from "./NotesLoading";
import { NotesSavingOverlay } from "./NotesSavingOverlay";
import { NoteWorkflowPanel } from "./NoteWorkflowPanel";
import { type BackgroundNoteActions, useBackgroundNoteActions } from "./useBackgroundNoteActions";
import { useNotesRealtime } from "./useNotesRealtime";
import { useThreadScroll } from "./useThreadScroll";

interface Props {
    readonly noteId: string | null;
    readonly open: boolean;
    readonly onClose: () => void;
    readonly onChanged: () => void;
}
interface Pending {
    request: () => Promise<unknown>;
    after: () => void;
}
/** El mismo bloque de identidad que los otros paneles: ícono, nombre del panel y qué contiene. */
function ThreadIdentity() {
    return (
        <div className="user-detail-drawer__identity">
            <span className="personal-notes-drawer__avatar" aria-hidden="true">
                <FileTextOutlined />
            </span>
            <div className="user-detail-drawer__identity-copy">
                <Typography.Title level={4}>Nota y conversación</Typography.Title>
                <Typography.Text type="secondary">La nota, quién la ve y sus comentarios</Typography.Text>
            </div>
        </div>
    );
}
/** Mantiene la misma nota montada mientras está cerrado, para que una escritura incierta conserve su clave de reintento original. */
export function NoteCollaborationDrawer({ noteId, open, onClose, onChanged }: Props) {
    return (
        <Drawer {...ADMINISTRATION_DRAWER_PROPS} rootClassName="user-detail-drawer note-collaboration-drawer" closable={{ placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }} title={<ThreadIdentity />} open={open} onClose={onClose}>
            {noteId && <ThreadContent key={noteId} noteId={noteId} open={open} onChanged={onChanged} />}
        </Drawer>
    );
}
function useThread(noteId: string, open: boolean, page: number, onChanged: () => void) {
    const [data, setData] = useState<NoteThread | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState("");
    const alive = useRef(true);
    const generation = useRef(0);
    const attempt = useRef<Pending | null>(null);
    const flight = useRef(false);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const load = useCallback(async () => {
        const current = ++generation.current;
        const valid = () => alive.current && current === generation.current;
        setLoading(true);
        try {
            const result = await getNoteThread(noteId, page);
            if (!valid()) return;
            setData(result);
            if (!attempt.current) setError("");
        } catch (reason) {
            if (valid()) {
                if (reason instanceof ApiClientError && [401, 403, 404].includes(reason.status)) setData(null);
                setError("La nota no está disponible o ya no tienes acceso. Puedes volver a comprobarlo.");
            }
        } finally {
            if (valid()) setLoading(false);
        }
    }, [noteId, page]);
    const background = useBackgroundNoteActions(data, () => {
        void load();
        onChanged();
    });
    useEffect(() => {
        if (open) void Promise.resolve().then(load);
    }, [load, open]);
    const realtime = useNotesRealtime("snapshot", () => {
        if (open && !flight.current && !attempt.current) return load();
    });
    useNotesRealtime("revoke", (event) => {
        if (event?.noteId === noteId) {
            generation.current += 1;
            setData(null);
            attempt.current = null;
            setPending(false);
            setError("Ya no tienes acceso a esta nota.");
        }
    });
    useEffect(() => (open ? realtime?.watch(noteId) : undefined), [realtime, noteId, open]);
    const fail = (reason: unknown) => {
        if (!alive.current) return;
        setNotice("");
        setError(mutationError(reason));
        if (reason instanceof ApiClientError && reason.status < 500) {
            attempt.current = null;
            setPending(false);
            if ([401, 403, 404].includes(reason.status)) setData(null);
        }
    };
    const execute = async (command: Pending) => {
        if (flight.current) return;
        flight.current = true;
        attempt.current = command;
        setBusy(true);
        setPending(true);
        setError("");
        setNotice("Guardando…");
        try {
            await command.request();
            if (!alive.current) return;
            attempt.current = null;
            setPending(false);
            setNotice("Guardado. Actualizando conversación…");
            command.after();
            await load();
            setNotice("Guardado");
            onChanged();
        } catch (reason) {
            fail(reason);
        } finally {
            flight.current = false;
            if (alive.current) setBusy(false);
        }
    };
    return {
        data: background.value,
        background,
        update: setData,
        loading,
        error,
        busy,
        pending,
        notice,
        locked: busy || pending,
        load,
        perform: (request: () => Promise<unknown>, after: () => void = () => {}) => {
            void execute({ request, after });
        },
        retry: () => {
            if (attempt.current) void execute(attempt.current);
        },
    };
}
function mutationError(error: unknown): string {
    if (!(error instanceof ApiClientError)) return "No pudimos confirmar el guardado. Reintenta la misma operación para evitar duplicarla.";
    if (error.status >= 500) return "El guardado no está confirmado. Reintenta la misma operación.";
    if (error.status === 409) return "Otra persona actualizó la nota. Recarga y revisa los cambios antes de guardar.";
    if ([401, 403, 404].includes(error.status)) return "Tu acceso a la nota o al registro ya no está disponible.";
    return "No se pudo guardar. Revisa los datos y los participantes autorizados.";
}
interface ThreadProps {
    readonly noteId: string;
    readonly open: boolean;
    readonly onChanged: () => void;
}
function ThreadContent({ noteId, open, onChanged }: ThreadProps) {
    const [page, setPage] = useState(1);
    const [membershipReset, setMembershipReset] = useState(0);
    const controller = useThread(noteId, open, page, onChanged);
    const { contentRef, hasNewReplies, jumpToLatest } = useThreadScroll(controller.data, page, open, setPage);
    const [comment, setComment] = useState("");
    const [mentions, setMentions] = useState<string[]>([]);
    const [editing, setEditing] = useState<NoteReply | null>(null);
    const canCompose = replyComposerAllowed(editing, controller.data);
    const clear = () => {
        setComment("");
        setMentions([]);
        setEditing(null);
    };
    const submit = () => {
        if (!comment.trim() || controller.locked) return;
        const operationId = crypto.randomUUID();
        const command = { operationId, text: comment, mentionUserIds: mentions };
        controller.perform(() => (editing ? editNoteReply(noteId, editing.id, { ...command, expectedVersion: editing.version }) : addNoteReply(noteId, command)), clear);
    };
    return (
        <div className="note-collaboration" ref={contentRef}>
            {hasNewReplies && (
                <button
                    className="note-new-replies"
                    type="button"
                    onClick={() => {
                        setPage(Math.max(1, Math.ceil((controller.data?.replyPage.total ?? 0) / (controller.data?.replyPage.size ?? 25))));
                        jumpToLatest();
                    }}
                >
                    Nuevas respuestas
                </button>
            )}
            <CommandFeedback
                {...controller}
                onReload={() => {
                    clear();
                    setMembershipReset((version) => version + 1);
                    void controller.load();
                }}
            />
            {controller.background.feedback}
            {controller.loading && !controller.data && <NotesLoading label="Cargando nota y conversación…" />}
            {controller.data && (
                <>
                    <ThreadBar key={membershipReset} thread={controller.data} locked={controller.locked} perform={controller.perform} background={controller.background} update={controller.update} />
                    <NoteRelatedRecordsSection
                        noteId={controller.data.note.id}
                        moduleCode={controller.data.note.moduleCode}
                        records={controller.data.note.relatedRecords ?? []}
                        canEdit={controller.data.note.capabilities.canEdit && controller.data.note.status === "open"}
                        onChanged={() => {
                            void controller.load();
                            onChanged();
                        }}
                    />
                    <NoteWorkflowPanel
                        thread={controller.data}
                        open={open}
                        onChanged={() => {
                            void controller.load();
                            onChanged();
                        }}
                    />
                    <section className="note-thread" aria-label="Conversación de la nota">
                        <ol className="note-feed">
                            <OriginPost key={membershipReset} thread={controller.data} locked={controller.locked} perform={controller.perform} background={controller.background} update={controller.update} />
                            <ReplyList
                                thread={controller.data}
                                locked={controller.locked}
                                onEdit={(reply) => {
                                    setEditing(reply);
                                    setComment(reply.text ?? "");
                                    setMentions(reply.mentionUserIds);
                                }}
                                onWithdraw={(reply) => {
                                    const operationId = crypto.randomUUID();
                                    const project = (current: NoteThread | null): NoteThread | null => (current ? { ...current, replies: current.replies.map((item) => (item.id === reply.id ? { ...item, text: null, withdrawn: true, canEdit: false, canWithdraw: false, mentionUserIds: [] } : item)) } : null);
                                    controller.background.run({
                                        key: `withdraw:${reply.id}`,
                                        label: "Retirar comentario",
                                        request: () => withdrawNoteReply(noteId, reply.id, { operationId, expectedVersion: reply.version }),
                                        project,
                                        commit: (result) => {
                                            controller.update((current) => {
                                                const next = project(current);
                                                return next ? { ...next, collaborationVersion: result.collaborationVersion } : null;
                                            });
                                        },
                                    });
                                }}
                            />
                            {controller.data.replies.length === 0 && <li className="note-feed__empty">Todavía no hay comentarios. Escribe el primero abajo.</li>}
                        </ol>
                        <ThreadPager page={page} thread={controller.data} locked={controller.locked} onPage={setPage} />
                        <ReplyDock canCompose={canCompose} thread={controller.data} text={comment} mentions={mentions} editing={Boolean(editing)} locked={controller.locked} onText={setComment} onMentions={setMentions} onSubmit={submit} onCancel={clear} />
                    </section>
                </>
            )}
        </div>
    );
}
function ThreadPager({ page, thread, locked, onPage }: { readonly page: number; readonly thread: NoteThread; readonly locked: boolean; readonly onPage: (update: (page: number) => number) => void }) {
    if (page === 1 && thread.replyPage.total <= thread.replyPage.size) return null;
    return (
        <div className="note-pagination">
            <button
                type="button"
                disabled={page === 1 || locked}
                onClick={() => {
                    onPage((value) => value - 1);
                }}
            >
                Comentarios anteriores
            </button>
            <span>Página {page}</span>
            <button
                type="button"
                disabled={page * thread.replyPage.size >= thread.replyPage.total || locked}
                onClick={() => {
                    onPage((value) => value + 1);
                }}
            >
                Comentarios siguientes
            </button>
        </div>
    );
}
function ReplyDock({ canCompose, ...composer }: ComposerProps & { readonly canCompose: boolean }) {
    return <div className="note-reply-dock">{canCompose ? <ReplyComposer {...composer} /> : <p className="note-collaboration-muted">Esta nota está en modo lectura o ya está completada.</p>}</div>;
}
interface FeedbackProps {
    readonly error: string;
    readonly busy: boolean;
    readonly pending: boolean;
    readonly notice: string;
    readonly retry: () => void;
    readonly onReload: () => void;
}
/** Mientras guarda, el preloader flotante. Después, la línea de estado simple. */
function CommandStatus({ busy, notice }: { readonly busy: boolean; readonly notice: string }) {
    if (busy) return <NotesSavingOverlay label={notice || "Guardando…"} />;
    return (
        <p className="note-command-status" role="status">
            {notice}
        </p>
    );
}
function CommandFeedback({ error, busy, pending, notice, retry, onReload }: FeedbackProps) {
    return (
        <>
            {(error || (pending && !busy)) && (
                <div className="note-collaboration-error" role="alert">
                    <p>{error || "Hay un guardado pendiente de confirmación."}</p>
                    <button type="button" disabled={busy} onClick={pending ? retry : onReload}>
                        {pending ? "Reintentar el mismo guardado" : "Recargar y descartar borrador"}
                    </button>
                </div>
            )}
            <CommandStatus busy={busy} notice={notice} />
        </>
    );
}
type Perform = (request: () => Promise<unknown>, after?: () => void) => void;
interface SectionProps {
    readonly thread: NoteThread;
    readonly locked: boolean;
    readonly perform: Perform;
    readonly background: BackgroundNoteActions<NoteThread | null>;
    readonly update: (project: (current: NoteThread | null) => NoteThread | null) => void;
}
function OriginPost({ thread, locked, perform, background, update }: SectionProps) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(thread.note.title ?? "");
    const [text, setText] = useState(thread.note.content.text);
    const [baseVersion, setBaseVersion] = useState(thread.note.version);
    const note = thread.note;
    return (
        <li className="note-post note-post--origin" style={{ "--note": note.color } as React.CSSProperties}>
            <span className="note-person-initial" aria-hidden="true">
                {note.author.displayName.slice(0, 1)}
            </span>
            <div className="note-post__body">
                <div className="note-post__head">
                    <strong>{note.author.displayName}</strong>
                    <span className="note-role">Autor</span>
                    <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })}</time>
                </div>
                <h2>{note.title ?? "Sin título"}</h2>
                <p className="note-context-caption">{contextLabel(note.context)}</p>
                <NoteContextLink context={note.context} />
                {editing ? (
                    <form
                        className="note-edit-original"
                        onSubmit={(event) => {
                            event.preventDefault();
                            const operationId = crypto.randomUUID();
                            perform(
                                () => editNote(note.moduleCode, note.id, { title: title.trim() || null, text, color: note.color, priority: note.priority }, baseVersion, operationId),
                                () => {
                                    setEditing(false);
                                },
                            );
                        }}
                    >
                        <label>
                            Título de la nota
                            <input
                                value={title}
                                maxLength={200}
                                disabled={locked}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                }}
                            />
                        </label>
                        <label>
                            Contenido de la nota
                            <textarea
                                value={text}
                                required
                                maxLength={10000}
                                disabled={locked}
                                onChange={(e) => {
                                    setText(e.target.value);
                                }}
                            />
                        </label>
                        <button type="submit" disabled={locked || !text.trim()}>
                            Guardar contenido
                        </button>
                        <button
                            type="button"
                            disabled={locked}
                            onClick={() => {
                                setEditing(false);
                            }}
                        >
                            Cancelar edición
                        </button>
                    </form>
                ) : (
                    <p className="note-thread-original__text">{note.content.text}</p>
                )}
                <div className="note-thread-actions">
                    {note.capabilities.canEdit && (
                        <button
                            type="button"
                            disabled={locked}
                            onClick={() => {
                                setTitle(note.title ?? "");
                                setText(note.content.text);
                                setBaseVersion(note.version);
                                setEditing(true);
                            }}
                        >
                            Editar nota
                        </button>
                    )}
                    <LifecycleActions thread={thread} locked={locked} perform={perform} background={background} update={update} />
                </div>
            </div>
        </li>
    );
}
/** Seguir trata de la conversación, así que queda junto a la conversación. */
function FollowToggle({ thread, locked, background, update }: SectionProps) {
    return (
        <button
            type="button"
            className="note-follow"
            title="Seguir activa avisos de respuestas. Silenciar respuestas conserva los avisos de menciones y asignaciones."
            disabled={locked || background.pending("following")}
            aria-pressed={!thread.following}
            onClick={() => {
                const operationId = crypto.randomUUID();
                const following = !thread.following;
                const project = (current: NoteThread | null): NoteThread | null => (current ? { ...current, following } : null);
                background.run({
                    key: "following",
                    label: following ? "Seguir respuestas" : "Silenciar respuestas",
                    request: () => setNoteFollowing(thread.note.id, { operationId, following }),
                    project,
                    commit: (result) => {
                        update((current) => {
                            const next = project(current);
                            return next ? { ...next, collaborationVersion: result.collaborationVersion } : null;
                        });
                    },
                });
            }}
        >
            {thread.following ? "Silenciar respuestas" : "Seguir respuestas"}
        </button>
    );
}
function contextLabel(context: NoteContext | null): string {
    if (context === null) return "Vínculo restringido · Sin acceso al registro";
    if (context.kind === "personal") return "Nota personal · Sin vínculo con una vista";
    if (context.kind === "sales_order") return context.source === "legacy" ? `Vinculada a orden de venta ${context.id}` : "Vinculada a una orden de venta de Habita";
    return "Vinculada a una vista de Habita";
}
function ParticipantSummary({ thread }: { readonly thread: NoteThread }) {
    const shown = thread.participants.slice(0, 4);
    const more = thread.participants.length - shown.length;
    return (
        <div className="note-thread-bar__people">
            {shown.length > 0 && (
                <span className="note-avatars" aria-hidden="true">
                    {shown.map((person) => (
                        <span key={person.userId} className="note-person-initial" title={`${person.displayName} · ${accessLabel(person.access)}`}>
                            {person.displayName.slice(0, 1)}
                        </span>
                    ))}
                    {more > 0 && <span className="note-person-initial">+{more}</span>}
                </span>
            )}
            <span className="note-thread-bar__text">{thread.participants.length === 0 ? "Privada · solo tú la ves" : `Compartida con ${String(thread.participants.length)} ${thread.participants.length === 1 ? "persona" : "personas"}`}</span>
            {thread.participants.length > 0 && (
                <ul className="note-sr" aria-label="Participantes de la nota">
                    {thread.participants.map((person) => (
                        <li key={person.userId}>
                            {person.displayName} · {accessLabel(person.access)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
const accessLabel = (access: NoteParticipant["access"]): string => (access === "reply" ? "Puede responder" : "Solo lectura");
/** Quién puede ver la nota, en una línea: una pila de caras, una frase y las dos acciones que conciernen a todo el hilo. */
function ThreadBar({ thread, locked, perform, background, update }: SectionProps) {
    const [editing, setEditing] = useState(false);
    const [people, setPeople] = useState<NoteParticipant[]>(thread.participants);
    // Se conserva la versión de cuando empezó la edición. Una foto remota no convierte un borrador viejo en una sobrescritura.
    const [baseVersion, setBaseVersion] = useState(thread.collaborationVersion);
    return (
        <section className="note-thread-bar" aria-label="Participantes">
            <div className="note-thread-bar__row">
                <ParticipantSummary thread={thread} />
                <div className="note-thread-bar__actions">
                    {thread.note.capabilities.canShare && (
                        <button
                            type="button"
                            aria-expanded={editing}
                            disabled={locked}
                            onClick={() => {
                                if (!editing) {
                                    setPeople(thread.participants);
                                    setBaseVersion(thread.collaborationVersion);
                                }
                                setEditing((value) => !value);
                            }}
                        >
                            Compartir con personas
                        </button>
                    )}
                    <FollowToggle thread={thread} locked={locked} perform={perform} background={background} update={update} />
                </div>
            </div>
            {thread.note.capabilities.canShare && editing && (
                <div className="note-thread-bar__panel">
                    <p className="note-section-intro">
                        <span>Invita a otras personas a la conversación</span>
                        <FormHelp text="Quienes invites podrán leer la nota y todos los comentarios, y recibirán un aviso. Al quitarlas pierden el acceso." />
                    </p>
                    <NoteParticipantsPicker noteId={thread.note.id} value={people} onChange={setPeople} disabled={locked} />
                    <button
                        type="button"
                        className="note-primary"
                        disabled={locked}
                        onClick={() => {
                            const operationId = crypto.randomUUID();
                            perform(
                                () => replaceNoteParticipants(thread.note.id, { operationId, expectedCollaborationVersion: baseVersion, participants: people.map(({ userId, access }) => ({ userId, access })) }),
                                () => {
                                    setEditing(false);
                                },
                            );
                        }}
                    >
                        Guardar participantes
                    </button>
                </div>
            )}
        </section>
    );
}
function mentionOptions(thread: NoteThread) {
    return [{ value: thread.note.author.publicId, label: thread.note.author.displayName }, ...thread.participants.map((person) => ({ value: person.userId, label: person.displayName }))].filter((person, index, array) => array.findIndex((row) => row.value === person.value) === index);
}
interface ReplyListProps {
    readonly thread: NoteThread;
    readonly locked: boolean;
    readonly onEdit: (reply: NoteReply) => void;
    readonly onWithdraw: (reply: NoteReply) => void;
}
function roleOf(thread: NoteThread, publicId: string): string | null {
    if (publicId === thread.note.author.publicId) return "Autor";
    const person = thread.participants.find((row) => row.userId === publicId);
    return person ? accessLabel(person.access) : null;
}
function ReplyActions({ reply, locked, onEdit, onWithdraw }: { readonly reply: NoteReply; readonly locked: boolean; readonly onEdit: (reply: NoteReply) => void; readonly onWithdraw: (reply: NoteReply) => void }) {
    if (!reply.canEdit && !reply.canWithdraw) return null;
    return (
        <div className="note-thread-actions">
            {reply.canEdit && (
                <button
                    type="button"
                    disabled={locked}
                    aria-label={`Editar comentario de ${reply.author.displayName}`}
                    onClick={() => {
                        onEdit(reply);
                    }}
                >
                    Editar mi comentario
                </button>
            )}
            {reply.canWithdraw && (
                <button
                    type="button"
                    disabled={locked}
                    aria-label={`Retirar comentario de ${reply.author.displayName}`}
                    onClick={() => {
                        onWithdraw(reply);
                    }}
                >
                    Retirar mi comentario
                </button>
            )}
        </div>
    );
}
function ReplyPost({ thread, reply, locked, onEdit, onWithdraw }: { readonly thread: NoteThread; readonly reply: NoteReply; readonly locked: boolean; readonly onEdit: (reply: NoteReply) => void; readonly onWithdraw: (reply: NoteReply) => void }) {
    const role = roleOf(thread, reply.author.publicId);
    return (
        <li className="note-post">
            <span className="note-person-initial" aria-hidden="true">
                {reply.author.displayName.slice(0, 1)}
            </span>
            <div className="note-post__body">
                <div className="note-post__head">
                    <strong>{reply.author.displayName}</strong>
                    {role && <span className="note-role">{role}</span>}
                    <time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })}</time>
                </div>
                <p>{reply.withdrawn ? "Comentario retirado por su autor" : reply.text}</p>
                {reply.version > 1 && !reply.withdrawn && <small>Editado</small>}
                <ReplyActions reply={reply} locked={locked} onEdit={onEdit} onWithdraw={onWithdraw} />
            </div>
        </li>
    );
}
function ReplyList({ thread, locked, onEdit, onWithdraw }: ReplyListProps) {
    return (
        <>
            {thread.replies.map((reply) => (
                <ReplyPost key={reply.id} thread={thread} reply={reply} locked={locked} onEdit={onEdit} onWithdraw={onWithdraw} />
            ))}
        </>
    );
}
interface ComposerProps {
    readonly thread: NoteThread;
    readonly text: string;
    readonly mentions: string[];
    readonly editing: boolean;
    readonly locked: boolean;
    readonly onText: (text: string) => void;
    readonly onMentions: (ids: string[]) => void;
    readonly onSubmit: () => void;
    readonly onCancel: () => void;
}
function ReplyComposer({ thread, text, mentions, editing, locked, onText, onMentions, onSubmit, onCancel }: ComposerProps) {
    return (
        <form
            className="note-reply-composer"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <label>
                <span className="note-caption">
                    <i aria-hidden="true">
                        <CommentOutlined />
                    </i>
                    {editing ? "Editar tu comentario" : "Responder a esta nota"}
                </span>
                <NoteMentionField value={text} onChange={onText} options={mentionOptions(thread)} mentions={mentions} onMentions={onMentions} disabled={locked} />
            </label>
            <div className="note-reply-composer__row">
                <small>Escribe @ para avisar a alguien que ya participa.</small>
                <div className="note-thread-actions">
                    {editing && (
                        <button type="button" disabled={locked} onClick={onCancel}>
                            Cancelar edición de comentario
                        </button>
                    )}
                    <button type="submit" className="note-primary" disabled={locked || !text.trim()}>
                        {editing ? "Guardar comentario" : "Enviar comentario"}
                    </button>
                </div>
            </div>
        </form>
    );
}

function LifecycleActions({ thread, locked, background, update }: SectionProps) {
    const note = thread.note;
    const lifecycle = (action: "complete" | "reopen" | "archive") => {
        const op = crypto.randomUUID();
        const status = action === "complete" ? "completed" : action === "reopen" ? "open" : "archived";
        const project = (current: NoteThread | null): NoteThread | null => (current ? { ...current, note: projectNoteState(current.note, status) } : null);
        background.run({
            key: "lifecycle",
            label: `${action === "complete" ? "Completar" : action === "reopen" ? "Reabrir" : "Archivar"} nota`,
            request: () => setNoteState(note.moduleCode, note.id, action, note.version, op),
            project,
            commit: (result) => {
                update((current) => {
                    const next = project(current);
                    return next ? { ...next, note: { ...next.note, version: result.version } } : null;
                });
            },
        });
    };
    return (
        <>
            {" "}
            {note.capabilities.canComplete && (
                <button
                    type="button"
                    disabled={locked || background.pending("lifecycle")}
                    onClick={() => {
                        lifecycle("complete");
                    }}
                >
                    Completar nota
                </button>
            )}
            {note.capabilities.canReopen && (
                <button
                    type="button"
                    disabled={locked || background.pending("lifecycle")}
                    onClick={() => {
                        lifecycle("reopen");
                    }}
                >
                    Reabrir nota
                </button>
            )}
            {note.capabilities.canArchive && (
                <button
                    type="button"
                    disabled={locked || background.pending("lifecycle")}
                    onClick={() => {
                        lifecycle("archive");
                    }}
                >
                    Archivar nota
                </button>
            )}
        </>
    );
}

function NoteContextLink({ context }: { readonly context: NoteContext | null }) {
    if (context?.kind !== "sales_order") return null;
    const query = new URLSearchParams({ orderSource: context.source, orderId: context.id });
    return <a href={`/home/formalization?${query.toString()}`}>Abrir orden de venta vinculada</a>;
}

/** Las respuestas propias ya existentes conservan su permiso de edición, aparte del permiso para publicar respuestas nuevas. */
function replyComposerAllowed(reply: NoteReply | null, thread: NoteThread | null): boolean {
    if (reply) return thread?.replies.some((current) => current.id === reply.id && current.canEdit) ?? false;
    return thread?.note.capabilities.canReply ?? false;
}
