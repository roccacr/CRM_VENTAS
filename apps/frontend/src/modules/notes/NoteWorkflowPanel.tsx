import BellOutlined from "@ant-design/icons/BellOutlined";
import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import HomeOutlined from "@ant-design/icons/HomeOutlined";
import UserOutlined from "@ant-design/icons/UserOutlined";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import { FormSwitch } from "../../components/forms/FormSwitch";
import { ApiClientError } from "../../services/api/api-client";
import type { NoteThread } from "../../services/notes/note-collaboration-service";
import { getNoteLocations, getNoteWorkflow, type NoteLocations, type NoteWorkflow, saveNoteLocations, saveNoteReminder, saveNoteTask } from "../../services/notes/note-workflow-service";
import type { NoteModule } from "../../services/notes/notes-service";
import { NotesSavingOverlay } from "./NotesSavingOverlay";
import { useNotesRealtime } from "./useNotesRealtime";

const HOMES: { moduleCode: NoteModule; code: string; label: string }[] = [
    { moduleCode: "ventas", code: "sales-home", label: "Ventas" },
    { moduleCode: "mercadeo", code: "marketing-home", label: "Mercadeo" },
    { moduleCode: "formalizacion", code: "formalization-home", label: "Formalización" },
    { moduleCode: "contabilidad", code: "accounting-home", label: "Contabilidad" },
    { moduleCode: "administration", code: "admin-home", label: "Administración" },
];
const localTime = (iso: string | null): string => {
    if (!iso) return "";
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const utc = (value: string): string | null => (value ? new Date(value).toISOString() : null);
/** Los cambios de tarea usan la versión que se muestra. Los recordatorios pertenecen solo a quien está leyendo. */
export function NoteWorkflowPanel({ thread, open, onChanged }: { readonly thread: NoteThread; readonly open: boolean; readonly onChanged: () => void }) {
    const [data, setData] = useState<NoteWorkflow | null>(null);
    const [locations, setLocations] = useState<NoteLocations | null>(null);
    const [assignee, setAssignee] = useState("");
    const [due, setDue] = useState("");
    const [remind, setRemind] = useState("");
    const [homes, setHomes] = useState<string[]>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState("");
    const [reloadVersion, setReloadVersion] = useState(0);
    const attempt = useRef<(() => Promise<void>) | null>(null);
    const flight = useRef(false);
    const sequence = useRef(0);
    const dirty = useRef(false);
    const [remoteChanges, setRemoteChanges] = useState(false);
    const discardAndReload = () => {
        dirty.current = false;
        setReloadVersion((value) => value + 1);
    };
    const markDirty = () => {
        dirty.current = true;
        sequence.current += 1;
    };
    useNotesRealtime(
        "snapshot",
        (event) => {
            if (event?.noteId && event.noteId !== thread.note.id) return;
            setRemoteChanges(true);
            if (dirty.current || flight.current || attempt.current) return;
            setReloadVersion((value) => value + 1);
        },
        open,
    );
    useEffect(() => {
        if (!open || attempt.current || dirty.current) return;
        const current = ++sequence.current;
        void Promise.allSettled([getNoteWorkflow(thread.note.id), getNoteLocations(thread.note.id)]).then(([workflow, places]) => {
            if (current !== sequence.current) return;
            setRemoteChanges(false);
            if (workflow.status === "fulfilled") {
                setData(workflow.value);
                setAssignee(selectedAssignee(workflow.value));
                setDue(localTime(workflow.value.dueAt));
                setRemind(reminderTime(workflow.value));
            }
            if (places.status === "fulfilled") {
                setLocations(places.value);
                setHomes(places.value.locations.map((location) => location.code));
            }
            setError([workflow, places].some((result) => result.status === "rejected") ? "No se pudo cargar toda la información de seguimiento." : "");
        });
        return () => {
            sequence.current += 1;
        };
    }, [thread.note.id, open, reloadVersion]);
    const execute = async (request: () => Promise<void>) => {
        if (flight.current) return;
        flight.current = true;
        attempt.current = request;
        setBusy(true);
        setPending(true);
        setError("");
        setNotice("");
        try {
            await request();
            attempt.current = null;
            dirty.current = false;
            setPending(false);
            setNotice("Seguimiento guardado");
            onChanged();
        } catch (reason) {
            if (workflowAccessLost(reason)) {
                setData(null);
                setLocations(null);
            }
            if (reason instanceof ApiClientError && reason.status < 500) {
                attempt.current = null;
                setPending(false);
            }
            setError(attempt.current ? "No se confirmó el guardado. Reintenta la misma operación." : "No se pudo actualizar el seguimiento. Vuelve a abrir la nota para revisar tu acceso y la versión actual.");
        } finally {
            flight.current = false;
            setBusy(false);
            if (!attempt.current) setReloadVersion((value) => value + 1);
        }
    };
    const locked = busy || pending;
    const availableHomes = HOMES.filter((home) => locations?.availableLocations.some((location) => location.moduleCode === home.moduleCode && location.code === home.code));
    const people = [{ userId: thread.note.author.publicId, displayName: thread.note.author.displayName }, ...thread.participants].filter((person, index, all) => all.findIndex((item) => item.userId === person.userId) === index);
    return (
        <details className="note-workflow" onChangeCapture={markDirty}>
            <summary>Responsable y recordatorio</summary>
            <WorkflowRemoteChanges visible={remoteChanges} locked={locked} onReload={discardAndReload} />
            <WorkflowFeedback
                busy={busy}
                pending={pending}
                error={error}
                notice={notice}
                onReload={() => {
                    discardAndReload();
                }}
                onRetry={() => {
                    if (attempt.current) void execute(attempt.current);
                }}
            />
            {data && (
                <>
                    <form
                        hidden={thread.note.status !== "open"}
                        onSubmit={(event) => {
                            event.preventDefault();
                            const body = { operationId: crypto.randomUUID(), expectedVersion: data.version, assigneeUserId: assignee || null, dueAt: utc(due) };
                            void execute(() => saveNoteTask(thread.note.id, body));
                        }}
                    >
                        <WorkflowReadOnlyNotice canManage={data.canManage} author={thread.note.author.displayName} kind="task" />
                        <fieldset disabled={locked || !data.canManage}>
                            <legend>Responsable y vencimiento</legend>
                            <div className="note-workflow__grid">
                                <div className="note-field">
                                    <label>
                                        <Caption icon={<UserOutlined />}>Responsable</Caption>
                                        <select
                                            value={assignee}
                                            onChange={(event) => {
                                                setAssignee(event.target.value);
                                            }}
                                        >
                                            <option value="">Sin responsable</option>
                                            {people.map((person) => (
                                                <option key={person.userId} value={person.userId}>
                                                    {person.displayName}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <span className="note-field__help">
                                        <FormHelp text="Asignar no comparte la nota. El responsable debe ser autor o participante existente." />
                                    </span>
                                </div>
                                <div className="note-field">
                                    <label>
                                        <Caption icon={<CalendarOutlined />}>Vencimiento (hora local)</Caption>
                                        <input
                                            type="datetime-local"
                                            value={due}
                                            onChange={(event) => {
                                                setDue(event.target.value);
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                            <button type="submit">Guardar responsable y vencimiento</button>
                        </fieldset>
                    </form>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            const body = { operationId: crypto.randomUUID(), remindAt: utc(remind) };
                            void execute(() => saveNoteReminder(thread.note.id, body));
                        }}
                    >
                        <fieldset disabled={locked}>
                            <legend>Mi recordatorio personal</legend>
                            <div className="note-field">
                                <label>
                                    <Caption icon={<BellOutlined />}>Avisarme (hora local)</Caption>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={remind}
                                        onChange={(event) => {
                                            setRemind(event.target.value);
                                        }}
                                    />
                                </label>
                                <span className="note-field__help">
                                    <FormHelp text="Solo tú recibes este aviso. Puedes cambiar la hora para posponerlo. Elige la fecha y guarda para programar el aviso." />
                                </span>
                            </div>
                            <div className="note-workflow__quick-times" role="group" aria-label="Elegir hora del recordatorio">
                                <button
                                    type="button"
                                    onClick={() => {
                                        markDirty();
                                        setRemind(localTime(new Date(Date.now() + 3600000).toISOString()));
                                    }}
                                >
                                    En 1 hora
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        markDirty();
                                        const tomorrow = new Date();
                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                        setRemind(localTime(tomorrow.toISOString()));
                                    }}
                                >
                                    Mañana a esta hora
                                </button>
                            </div>
                            <p className="note-workflow__status">{reminderLabel(data)}</p>
                            <button type="submit">{data.reminder ? "Guardar nueva hora" : "Crear recordatorio"}</button>
                            {hasPendingReminder(data) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const body = { operationId: crypto.randomUUID(), remindAt: null };
                                        void execute(async () => {
                                            await saveNoteReminder(thread.note.id, body);
                                            setRemind("");
                                        });
                                    }}
                                >
                                    Cancelar mi recordatorio
                                </button>
                            )}
                        </fieldset>
                    </form>
                </>
            )}
            {locations && (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        const body = { operationId: crypto.randomUUID(), expectedCollaborationVersion: locations.version, locations: HOMES.filter((home) => homes.includes(home.code)).map(({ moduleCode, code }) => ({ moduleCode, code })) };
                        void execute(async () => {
                            await saveNoteLocations(thread.note.id, body);
                        });
                    }}
                >
                    <WorkflowReadOnlyNotice canManage={locations.canManage} author={thread.note.author.displayName} kind="locations" />
                    <fieldset disabled={locked || !locations.canManage}>
                        <legend>Mostrar también en Inicio</legend>
                        <span className="note-field__help">
                            <FormHelp text="Es la misma nota; conserva su vínculo original. Cada vista y persona necesita acceso." />
                        </span>
                        {availableHomes.map((home) => (
                            <FormSwitch
                                key={home.code}
                                icon={<HomeOutlined />}
                                label={home.label}
                                checked={homes.includes(home.code)}
                                disabled={locked || !locations.canManage}
                                onChange={(checked) => {
                                    markDirty();
                                    setHomes((current) => (checked ? [...current, home.code] : current.filter((code) => code !== home.code)));
                                }}
                            />
                        ))}
                        <button type="submit">Guardar ubicaciones</button>
                    </fieldset>
                </form>
            )}
        </details>
    );
}

function Caption({ icon, children }: { readonly icon: ReactNode; readonly children: ReactNode }) {
    return (
        <span className="note-caption">
            <i aria-hidden="true">{icon}</i>
            {children}
        </span>
    );
}
function WorkflowFeedback({ busy, pending, error, notice, onRetry, onReload }: { readonly busy: boolean; readonly pending: boolean; readonly error: string; readonly notice: string; readonly onRetry: () => void; readonly onReload: () => void }) {
    return (
        <>
            {busy && <NotesSavingOverlay label="Guardando seguimiento…" />}
            {notice && <p role="status">{notice}</p>}
            {error && (
                <div role="alert">
                    <p>{error}</p>
                    {pending ? (
                        <button type="button" disabled={busy} onClick={onRetry}>
                            Reintentar el mismo seguimiento
                        </button>
                    ) : (
                        <button type="button" disabled={busy} onClick={onReload}>
                            Recargar seguimiento
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
const selectedAssignee = (data: NoteWorkflow): string => data.assignee?.publicId ?? "";
const reminderTime = (data: NoteWorkflow): string => (data.reminder?.status === "pending" ? localTime(data.reminder.remindAt) : "");

const hasPendingReminder = (data: NoteWorkflow): boolean => data.reminder?.status === "pending";
function reminderLabel(data: NoteWorkflow): string {
    if (!data.reminder) return "Sin recordatorio activo";
    const labels = { pending: "Programado", delivered: "Aviso enviado", cancelled: "Cancelado", suppressed: "Aviso omitido; puedes elegir otra hora" };
    return labels[data.reminder.status];
}

function WorkflowRemoteChanges({ visible, locked, onReload }: { readonly visible: boolean; readonly locked: boolean; readonly onReload: () => void }) {
    if (!visible) return null;
    return (
        <div role="status">
            <p>Hay cambios de seguimiento disponibles. Tus cambios sin guardar se conservan.</p>
            <button type="button" disabled={locked} onClick={onReload}>
                Recargar seguimiento y descartar cambios
            </button>
        </div>
    );
}

function workflowAccessLost(reason: unknown): boolean {
    return reason instanceof ApiClientError && [401, 403, 404].includes(reason.status);
}

function WorkflowReadOnlyNotice({ canManage, author, kind }: { readonly canManage: boolean; readonly author: string; readonly kind: "task" | "locations" }) {
    if (canManage) return null;
    return (
        <div role="alert" className="note-workflow__access-alert">
            {kind === "locations" ? `Solo ${author} puede cambiar dónde se muestra esta nota, con permiso para compartirla.` : `Solo ${author}, quien creó esta nota, puede cambiar responsable y vencimiento con permiso de edición. El recordatorio personal se configura por separado.`}
        </div>
    );
}
