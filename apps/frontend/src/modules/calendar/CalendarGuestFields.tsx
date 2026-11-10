import MailOutlined from "@ant-design/icons/MailOutlined";
import { useEffect, useState } from "react";

import { confirmAction } from "../../components/feedback/confirm-action";
import { FormHelp } from "../../components/forms/FormHelp";
import { type CalendarLink, type CalendarLookupItem, type CalendarLookupKind, type CalendarModule, getCalendarLookup } from "../../services/calendar/calendar-service";
import type { useCalendarEventForm } from "./useCalendarEventForm";

type Model = ReturnType<typeof useCalendarEventForm>;
const MAX_OPTIONS = 30;
const lookupPlaceholders = { users: "Nombre o correos separados por coma…", notes: "Buscar para agregar…", leads: "Buscar para agregar…", orders: "Buscar para agregar…" };
const entityTypes = { notes: "note", leads: "lead", orders: "sales_order" } as const;
const guestCount = (model: Model) => model.fields.userIds.length + model.fields.externalEmails.split(/[,;\s]+/).filter(Boolean).length;
/** El formulario registra participantes CRM y solicita invitaciones/Teams al guardar el evento en Outlook. */
export function CalendarGuestFields({ model, locked, moduleCode, outlookConnected: _outlookConnected = false }: { readonly outlookConnected?: boolean; readonly model: Model; readonly locked: boolean; readonly moduleCode: CalendarModule }) {
    return (
        <>
            <section className="event-card" aria-label="Participantes">
                <details>
                    <summary className="event-card__head">
                        <span>Participantes</span>
                        <em>{guestCount(model)}</em>
                    </summary>
                    <div className="event-split">
                        <Lookup kind="users" label="Colaboradores de la empresa" model={model} locked={locked} moduleCode={moduleCode} />
                        <div className="event-externals">
                            <span className="event-field__help">
                                <FormHelp text="Separa los correos con coma. Al guardar en Outlook se enviarán invitaciones a los participantes." />
                            </span>
                            <label>
                                <span className="event-caption">
                                    <i aria-hidden="true">
                                        <MailOutlined />
                                    </i>
                                    Invitados externos (clientes o terceros)
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
                        </div>
                    </div>
                </details>
            </section>
            {model.linksEditable ? (
                <section className="event-card" aria-label="Relaciones">
                    <details open={model.orderContextLocked || model.requiresOrder || undefined}>
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
                            <Lookup kind="leads" label="Leads vinculados" model={model} locked={locked || model.orderContextLocked} moduleCode={moduleCode} />
                            <Lookup kind="orders" label="Órdenes de venta vinculadas" model={model} locked={locked || model.orderContextLocked} moduleCode={moduleCode} />
                        </div>
                    </details>
                </section>
            ) : (
                <p className="event-form__note">Relaciones restringidas; se conservan sin cambios</p>
            )}
        </>
    );
}
function lookupStatus(kind: CalendarLookupKind, search: string, leads: string, count: number): string {
    if (count) return "";
    if (["leads", "orders"].includes(kind) && search.trim().length === 1) return "Escribe al menos 2 caracteres para buscar.";
    if (kind === "orders" && leads === "[]" && !search.trim()) return "Selecciona un lead o busca una orden por su número.";
    return "Sin resultados autorizados.";
}
/** La unicidad se comprueba con el listado sin búsqueda, nunca con una coincidencia filtrada. */
function singleLeadOrder(kind: CalendarLookupKind, search: string, leadFilter: string, results: readonly CalendarLookupItem[]) {
    if (kind !== "orders" || search.trim()) return;
    const leads = JSON.parse(leadFilter) as CalendarLink[];
    if (leads.length !== 1 || results.length !== 1) return;
    const lead = leads[0];
    const order = results[0];
    return lead && order ? { lead, order } : undefined;
}
function Lookup({ kind, label, model, locked, moduleCode }: { readonly kind: CalendarLookupKind; readonly label: string; readonly model: Model; readonly locked: boolean; readonly moduleCode: CalendarModule }) {
    const addUsers = model.addUsers;
    const autoSelectOnlyOrder = model.autoSelectOnlyOrder;

    const [search, setSearch] = useState("");
    const [items, setItems] = useState<CalendarLookupItem[]>([]);
    const [status, setStatus] = useState("");
    // Caché de presentación de este formulario. El comando sigue llevando solo identidades.
    const [labels, setLabels] = useState(() => new Map<string, CalendarLookupItem>(model.initialSelectionOptions[kind].map((item) => [`${item.source}:${item.id}`, item] as const)));
    const leadFilter = kind === "orders" ? JSON.stringify(model.fields.links.filter((link) => link.entityType === "lead")) : "[]";
    useEffect(() => {
        if (locked) return;
        let current = true;
        const timer = setTimeout(() => {
            setStatus("Buscando…");
            void getCalendarLookup(kind, search, moduleCode, JSON.parse(leadFilter) as CalendarLink[])
                .then((results) => {
                    if (!current) return;
                    setItems(results);
                    setLabels((previous) => {
                        const next = new Map(previous);
                        for (const item of results) next.set(`${item.source}:${item.id}`, item);
                        return next;
                    });
                    setStatus(lookupStatus(kind, search, leadFilter, results.length));
                    const unique = singleLeadOrder(kind, search, leadFilter, results);
                    if (unique) autoSelectOnlyOrder(unique.order, unique.lead);
                    if (kind === "users" && search.includes(",")) {
                        const tokens = search
                            .split(",")
                            .map((value) => value.trim().toLowerCase())
                            .filter(Boolean);
                        const matches = tokens.map((token) => results.filter((item) => item.secondary?.toLowerCase() === token || item.label.toLowerCase() === token));
                        if (matches.length && matches.every((items) => items.length === 1)) {
                            addUsers(matches.flat().map((item) => item.id));
                            setSearch("");
                        } else setStatus("Revisa los correos o nombres separados por coma; cada colaborador debe coincidir con una cuenta.");
                    }
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
    }, [kind, search, locked, moduleCode, leadFilter, addUsers, autoSelectOnlyOrder]);
    const selected = kind === "users" ? model.fields.userIds.map((id) => ({ id, source: "native" as const })) : model.fields.links.filter((link) => link.entityType === entityTypes[kind]);
    const isSelected = (item: { readonly id: string; readonly source: string }) => selected.some((entry) => entry.id === item.id && entry.source === item.source);
    const addOrder = (item: CalendarLookupItem, remaining: CalendarLink[]) => {
        if (!item.lead) {
            setStatus("No se pudo identificar un lead único y autorizado para esta orden. Revisa su relación antes de vincularla.");
            return;
        }
        const lead = item.lead;
        const selectedLeads = model.requiresOrder ? [] : model.fields.links.filter((link) => link.entityType === "lead");
        if (selectedLeads.length && !selectedLeads.some((link) => link.source === lead.source && link.id === lead.id)) {
            setStatus("La orden no corresponde a los leads seleccionados. Actualiza la búsqueda.");
            return;
        }
        model.rememberLead(lead);
        model.rememberOrder(item);
        const retained = model.requiresOrder ? remaining.filter((link) => link.entityType === "note") : remaining;
        const links = [...retained, { entityType: "sales_order" as const, source: item.source, id: item.id }];
        if (!links.some((link) => link.entityType === "lead" && link.source === lead.source && link.id === lead.id)) links.push({ entityType: "lead", source: lead.source, id: lead.id });
        model.change("links", links);
        return;
    };
    const removeLead = (lead: CalendarLookupItem, remaining: CalendarLink[]) => {
        const related = model.fields.links
            .filter((link) => link.entityType === "sales_order")
            .filter((order) => {
                const owner = model.orderOptions.find((item) => item.source === order.source && item.id === order.id)?.lead;
                return !owner || (owner.source === lead.source && owner.id === lead.id);
            });
        const apply = () => {
            model.change(
                "links",
                remaining.filter((link) => !related.some((order) => order.entityType === link.entityType && order.source === link.source && order.id === link.id)),
            );
        };
        if (!related.length) {
            apply();
            return;
        }
        void confirmAction({ title: "Quitar lead", content: "Al quitar este lead se retirarán sus órdenes vinculadas y las que no tienen relación confirmada.", okText: "Quitar lead" }).then((accepted) => {
            if (accepted) apply();
        });
    };
    const toggleLead = (item: CalendarLookupItem, checked: boolean, remaining: CalendarLink[]) => {
        if (!checked) {
            removeLead(item, remaining);
            return;
        }
        model.rememberLead(item);
        const retained = model.requiresOrder ? remaining.filter((link) => link.entityType === "note") : remaining;
        model.change("links", [...retained, { entityType: "lead", source: item.source, id: item.id }]);
    };
    const toggle = (item: CalendarLookupItem, checked: boolean) => {
        if (kind === "users") {
            model.change("userIds", checked ? [...model.fields.userIds, item.id] : model.fields.userIds.filter((id) => id !== item.id));
            return;
        }
        const remaining = model.fields.links.filter((link) => !(link.entityType === entityTypes[kind] && link.source === item.source && link.id === item.id));
        if (kind === "leads") {
            toggleLead(item, checked, remaining);
            return;
        }
        if (kind === "orders" && checked) {
            addOrder(item, remaining);
            return;
        }
        model.change("links", checked ? [...remaining, { entityType: entityTypes[kind], source: item.source, id: item.id }] : remaining);
    };
    const chips = selected.map((identity) => labels.get(`${identity.source}:${identity.id}`) ?? (kind === "leads" ? model.leadOptions.find((item) => item.source === identity.source && item.id === identity.id) : undefined) ?? { ...identity, label: identity.id });
    const shown = items.slice(0, MAX_OPTIONS);
    // Un registro ya elegido sigue disponible aunque la búsqueda actual ya no lo liste.
    for (const item of chips) if (!shown.some((entry) => entry.id === item.id && entry.source === item.source)) shown.push(item);
    return (
        <fieldset className="event-lookup" disabled={locked}>
            <legend>
                {label}
                <span className="event-required" aria-hidden="true" hidden={![model.requiresOrder, ["orders", "leads"].includes(kind)].every(Boolean)}>
                    {" "}
                    *
                </span>
            </legend>
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
                        placeholder={lookupPlaceholders[kind]}
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
