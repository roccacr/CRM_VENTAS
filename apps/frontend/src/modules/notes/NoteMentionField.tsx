import { type KeyboardEvent, useRef, useState } from "react";

export interface MentionOption {
    readonly value: string;
    readonly label: string;
}
interface Props {
    readonly value: string;
    readonly onChange: (text: string) => void;
    readonly options: readonly MentionOption[];
    readonly mentions: readonly string[];
    readonly onMentions: (ids: string[]) => void;
    readonly disabled: boolean;
}
interface Query {
    readonly start: number;
    readonly text: string;
}

const plain = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La arroba que se está escribiendo en el cursor, si existe. Empieza una palabra y todavía no tiene espacio. */
function queryAt(text: string, caret: number): Query | null {
    const before = text.slice(0, caret);
    const match = /(^|\s)@([^\s@]*)$/.exec(before);
    if (!match) return null;
    const typed = match[2] ?? "";
    return { start: before.length - typed.length - 1, text: typed };
}

/**
 * Una caja de comentario donde la arroba sugiere a las personas que ya están en la nota. Elegir una escribe @Nombre y agrega a esa persona
 * a las menciones que se envían. Borrar ese @Nombre del texto retira la mención, así que lo enviado es lo escrito.
 */
export function NoteMentionField({ value, onChange, options, mentions, onMentions, disabled }: Props) {
    const [query, setQuery] = useState<Query | null>(null);
    const [active, setActive] = useState(0);
    const field = useRef<HTMLTextAreaElement>(null);
    const picked = useRef(new Map<string, string>());
    const suggestions = query ? options.filter((option) => !mentions.includes(option.value) && plain(option.label).includes(plain(query.text))).slice(0, 6) : [];
    const change = (text: string, caret: number) => {
        onChange(text);
        const gone = [...picked.current].filter(([, name]) => !text.includes(`@${name}`)).map(([id]) => id);
        if (gone.length > 0) {
            for (const id of gone) picked.current.delete(id);
            onMentions(mentions.filter((id) => !gone.includes(id)));
        }
        setQuery(queryAt(text, caret));
        setActive(0);
    };
    const pick = (option: MentionOption) => {
        if (!query) return;
        const caret = field.current?.selectionStart ?? value.length;
        const next = `${value.slice(0, query.start)}@${option.label} ${value.slice(caret)}`;
        picked.current.set(option.value, option.label);
        onChange(next);
        onMentions([...mentions, option.value]);
        setQuery(null);
        field.current?.focus();
    };
    const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (suggestions.length === 0) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index + (event.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
        } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            const option = suggestions[active];
            if (option) pick(option);
        } else if (event.key === "Escape") {
            event.preventDefault();
            setQuery(null);
        }
    };
    return (
        <div className="note-mention-field">
            <textarea
                ref={field}
                rows={3}
                aria-label="Texto del comentario"
                aria-autocomplete="list"
                value={value}
                disabled={disabled}
                required
                maxLength={10000}
                placeholder="Escribe tu respuesta… usa @ para avisar a alguien"
                onChange={(event) => {
                    change(event.target.value, event.target.selectionStart);
                }}
                onKeyDown={keys}
                onBlur={() => {
                    setQuery(null);
                }}
            />
            {suggestions.length > 0 && (
                <ul className="note-mention-list" role="listbox" aria-label="Personas de la nota">
                    {suggestions.map((option, index) => (
                        <li
                            key={option.value}
                            role="option"
                            aria-selected={index === active}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                pick(option);
                            }}
                        >
                            <span className="note-person-initial" aria-hidden="true">
                                {option.label.slice(0, 1)}
                            </span>
                            {option.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
