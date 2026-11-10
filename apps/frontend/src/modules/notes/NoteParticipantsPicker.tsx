import Select from "antd/es/select";
import { useEffect, useId, useMemo, useState } from "react";

import { getEligibleNoteUsers, getEligibleUsersForNoteDraft, type NoteEligibleUsers, type NoteParticipant } from "../../services/notes/note-collaboration-service";
import type { NoteContext, NoteModule } from "../../services/notes/notes-service";
interface Props {
    readonly noteId?: string;
    readonly draft?: { moduleCode: NoteModule; context: NoteContext };
    readonly value: NoteParticipant[];
    readonly onChange: (value: NoteParticipant[]) => void;
    readonly disabled: boolean;
}
const accountStatus = { active: "Activo", inactive: "Inactivo", pending: "Pendiente de activación" };
const personLabel = (person: { displayName: string; status?: keyof typeof accountStatus }) => (person.status ? `${person.displayName} · ${accountStatus[person.status]}` : person.displayName);
/** Carga el directorio autorizado antes de elegir. Las identidades siguen siendo ids públicos y los nombres son etiquetas. */
export function NoteParticipantsPicker({ noteId, draft, value, onChange, disabled }: Props) {
    const selectId = useId();
    const [items, setItems] = useState<NoteEligibleUsers["items"]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const draftKey = JSON.stringify(draft);
    const stableDraft = useMemo(() => (draftKey ? (JSON.parse(draftKey) as NonNullable<Props["draft"]>) : undefined), [draftKey]);
    useEffect(() => {
        let active = true;
        const timer = window.setTimeout(() => {
            setLoading(true);
            setError("");
            setItems([]);
            const request = noteId ? getEligibleNoteUsers(noteId, "") : stableDraft ? getEligibleUsersForNoteDraft(stableDraft.moduleCode, stableDraft.context, "") : Promise.resolve({ items: [] });
            void request
                .then(
                    (result) => {
                        if (active) setItems(result.items);
                    },
                    () => {
                        if (active) {
                            setItems([]);
                            setError("No se pudo cargar la lista de personas. Reintenta.");
                        }
                    },
                )
                .finally(() => {
                    if (active) setLoading(false);
                });
        }, 0);
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [noteId, stableDraft, retry]);
    const options = Array.from(new Map([...items.map((person) => ({ value: person.publicId, label: personLabel(person) })), ...value.map((person) => ({ value: person.userId, label: personLabel(person) }))].map((person) => [person.value, person])).values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
    return (
        <div className="note-people-picker">
            <div className="note-people-picker__head">
                <label htmlFor={selectId}>Personas para invitar</label>
            </div>
            <Select
                id={selectId}
                aria-label="Personas para invitar"
                mode="multiple"
                getPopupContainer={(trigger: HTMLElement) => trigger.closest<HTMLElement>(".ant-drawer-body") ?? trigger.parentElement ?? trigger}
                showSearch={{ optionFilterProp: "label" }}
                options={options}
                value={value.map((person) => person.userId)}
                loading={loading}
                disabled={disabled || loading || Boolean(error)}
                maxCount={100}
                maxTagCount={0}
                maxTagPlaceholder={(omitted) => `${String(omitted.length)} ${omitted.length === 1 ? "persona" : "personas"}`}
                placeholder="Selecciona una o varias personas"
                notFoundContent="No hay personas disponibles con ese nombre"
                onChange={(ids: string[]) => {
                    onChange(
                        ids.flatMap((id) => {
                            const existing = value.find((person) => person.userId === id);
                            if (existing) return [existing];
                            const person = items.find((item) => item.publicId === id);
                            return person ? [{ userId: person.publicId, displayName: person.displayName, access: "reply" as const, ...(person.status ? { status: person.status } : {}) }] : [];
                        }),
                    );
                }}
            />
            {loading ? <span role="status">Cargando personas…</span> : !error && <small>{items.length} personas disponibles · puedes seleccionar varias.</small>}
            {error && (
                <div role="alert">
                    <p>{error}</p>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                            setRetry((n) => n + 1);
                        }}
                    >
                        Reintentar lista de personas
                    </button>
                </div>
            )}
            {value.length > 0 && (
                <>
                    <div className="note-people-picker__count">
                        <span>{value.length === 1 ? "1 persona invitada" : `${String(value.length)} personas invitadas`}</span>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                                onChange([]);
                            }}
                        >
                            Quitar a todas
                        </button>
                    </div>
                    <ul className="note-people-picker__selected" aria-label="Personas invitadas">
                        {value.map((person) => (
                            <li key={person.userId}>
                                <span className="note-person-initial" aria-hidden="true">
                                    {person.displayName.slice(0, 1)}
                                </span>
                                <strong title={person.displayName}>{personLabel(person)}</strong>
                                <select
                                    aria-label={`Permiso de ${person.displayName}`}
                                    value={person.access}
                                    disabled={disabled}
                                    onChange={(event) => {
                                        onChange(value.map((p) => (p.userId === person.userId ? { ...p, access: event.target.value as "read" | "reply" } : p)));
                                    }}
                                >
                                    <option value="reply">Puede responder</option>
                                    <option value="read">Solo lectura</option>
                                </select>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    aria-label={`Quitar a ${person.displayName}`}
                                    onClick={() => {
                                        onChange(value.filter((p) => p.userId !== person.userId));
                                    }}
                                >
                                    Quitar
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <small>Las cuentas inactivas o pendientes verán la nota y el aviso al activar su cuenta. Invitar no da acceso a la orden o vista; eso se valida aparte.</small>
        </div>
    );
}
