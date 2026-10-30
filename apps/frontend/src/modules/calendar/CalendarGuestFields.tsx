import MailOutlined from "@ant-design/icons/MailOutlined";
import VideoCameraOutlined from "@ant-design/icons/VideoCameraOutlined";
import { useEffect, useState } from "react";

import { type CalendarLookupItem, type CalendarLookupKind, type CalendarModule, getCalendarLookup } from "../../services/calendar/calendar-service";
import { FormHelp } from "../../components/forms/FormHelp";
import { FormSwitch } from "../../components/forms/FormSwitch";
import type { useCalendarEventForm } from "./useCalendarEventForm";

type Model = ReturnType<typeof useCalendarEventForm>;
const MAX_OPTIONS = 30;
const entityTypes = { notes: "note", leads: "lead", orders: "sales_order" } as const;
const guestCount = (model: Model) => model.fields.userIds.length + model.fields.externalEmails.split(/[,;\s]+/).filter(Boolean).length;
/** Only CRM participation is recorded; no invitations or Teams meetings are sent. */
export function CalendarGuestFields({ model, locked, moduleCode }: { readonly model: Model; readonly locked: boolean; readonly moduleCode: CalendarModule }) {
    return (
        <>
            <section className="event-card" aria-label="Participantes">
                <details>
                    <summary className="event-card__head">
                        <span>Participantes</span>
                        <em>{guestCount(model)}</em>
                    </summary>
                    <div className="event-split">
                        <Lookup kind="users" label="Invitados internos" model={model} locked={locked} moduleCode={moduleCode} />
                        <div className="event-externals">
                            <span className="event-field__help">
                                <FormHelp text="Separa los correos con coma. Solo se guardan en el evento; no se envía ninguna invitación." />
                            </span>
                            <label>
                                <span className="event-caption">
                                    <i aria-hidden="true">
                                        <MailOutlined />
                                    </i>
                                    Correos de invitados externos
                                </span>
                                <input
                                    value={model.fields.externalEmails}
                                    placeholder="correo@empresa.com, otro@empresa.com"
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") event.preventDefault();
                                    }}
                                    disabled={locked}
                                    maxLength={4000}
                                    onChange={(event) => {
                                        model.change("externalEmails", event.target.value);
                                    }}
                                />
                            </label>
                            <FormSwitch
                                icon={<VideoCameraOutlined />}
                                label="Solicitar reunión de Teams"
                                hint="Solo deja anotado que se necesita Teams. La reunión no se crea automáticamente."
                                checked={model.fields.teamsRequested}
                                disabled={locked}
                                onChange={(checked) => {
                                    model.change("teamsRequested", checked);
                                }}
                            />
                        </div>
                    </div>
                </details>
            </section>
            {model.linksEditable ? (
                <section className="event-card" aria-label="Relaciones">
                    <details>
                        <summary className="event-card__head">
                            <span>Relaciones</span>
                            <em>{model.fields.links.length}</em>
                        </summary>
                        <p className="event-card__intro">
                            Vincula registros al evento
                            <FormHelp text="Vincular solo relaciona el evento con el registro; no da acceso a nadie." />
                        </p>
                        <div className="event-triple">
                            <Lookup kind="notes" label="Notas vinculadas" model={model} locked={locked} moduleCode={moduleCode} />
                            <Lookup kind="leads" label="Leads vinculados" model={model} locked={locked} moduleCode={moduleCode} />
                            <Lookup kind="orders" label="Órdenes de venta vinculadas" model={model} locked={locked} moduleCode={moduleCode} />
                        </div>
                    </details>
                </section>
            ) : (
                <p className="event-form__note">Relaciones restringidas; se conservan sin cambios</p>
            )}
        </>
    );
}
function Lookup({ kind, label, model, locked, moduleCode }: { readonly kind: CalendarLookupKind; readonly label: string; readonly model: Model; readonly locked: boolean; readonly moduleCode: CalendarModule }) {
    const [search, setSearch] = useState("");
    const [items, setItems] = useState<CalendarLookupItem[]>([]);
    const [status, setStatus] = useState("");
    // Presentation-only cache for this mounted form; commands still contain identities alone.
    const [labels, setLabels] = useState(() => new Map<string, CalendarLookupItem>(model.initialSelectionOptions[kind].map((item) => [`${item.source}:${item.id}`, item] as const)));
    useEffect(() => {
        if (locked) return;
        let current = true;
        const timer = setTimeout(() => {
            setStatus("Buscando…");
            void getCalendarLookup(kind, search, moduleCode)
                .then((results) => {
                    if (!current) return;
                    setItems(results);
                    setLabels((previous) => {
                        const next = new Map(previous);
                        for (const item of results) next.set(`${item.source}:${item.id}`, item);
                        return next;
                    });
                    setStatus(results.length ? "" : "Sin resultados autorizados.");
                })
                .catch(() => {
                    if (!current) return;
                    setItems([]);
                    setStatus("No se pudo consultar. Cambia la búsqueda para reintentar.");
                });
        }, 300);
        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [kind, search, locked, moduleCode]);
    const selected = kind === "users" ? model.fields.userIds.map((id) => ({ id, source: "native" as const })) : model.fields.links.filter((link) => link.entityType === entityTypes[kind]);
    const isSelected = (item: { readonly id: string; readonly source: string }) => selected.some((entry) => entry.id === item.id && entry.source === item.source);
    const toggle = (item: CalendarLookupItem, checked: boolean) => {
        if (kind === "users") {
            model.change("userIds", checked ? [...model.fields.userIds, item.id] : model.fields.userIds.filter((id) => id !== item.id));
            return;
        }
        const remaining = model.fields.links.filter((link) => !(link.entityType === entityTypes[kind] && link.source === item.source && link.id === item.id));
        model.change("links", checked ? [...remaining, { entityType: entityTypes[kind], source: item.source, id: item.id }] : remaining);
    };
    const chips = selected.map((identity) => labels.get(`${identity.source}:${identity.id}`) ?? { ...identity, label: identity.id });
    const shown = items.slice(0, MAX_OPTIONS);
    // A chosen record stays reachable even when the current search no longer lists it.
    for (const item of chips) if (!shown.some((entry) => entry.id === item.id && entry.source === item.source)) shown.push(item);
    return (
        <fieldset className="event-lookup" disabled={locked}>
            <legend>{label}</legend>
            {chips.length > 0 && (
                <ul className="event-lookup__chips" aria-label={`${label} elegidos`}>
                    {chips.map((item) => (
                        <li key={`${item.source}:${item.id}`}>
                            <span title={item.label}>{item.label}</span>
                            <button
                                type="button"
                                aria-label={`Quitar ${item.label}`}
                                onClick={() => {
                                    toggle(item, false);
                                }}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="event-lookup__picker">
                <label>
                    <span className="event-sr">Buscar {label.toLowerCase()}</span>
                    <input
                        value={search}
                        placeholder="Buscar para agregar…"
                        onKeyDown={(event) => {
                            if (event.key === "Enter") event.preventDefault();
                        }}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setItems([]);
                        }}
                    />
                </label>
                <div className="event-lookup__menu">
                    {status && <p role="status">{status}</p>}
                    <div className="event-lookup__options">
                        {shown.map((item) => (
                            <label className="shared-calendar-form__checkbox" key={`${item.source}:${item.id}`}>
                                <input
                                    type="checkbox"
                                    checked={isSelected(item)}
                                    onChange={(event) => {
                                        toggle(item, event.target.checked);
                                    }}
                                />
                                {item.label}
                                {item.secondary ? ` · ${item.secondary}` : ""}
                            </label>
                        ))}
                    </div>
                    {items.length > MAX_OPTIONS && (
                        <p>
                            Se muestran {MAX_OPTIONS} de {items.length}. Escribe para filtrar.
                        </p>
                    )}
                </div>
            </div>
        </fieldset>
    );
}
