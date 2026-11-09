import "../administration/components/UserDetailDrawer.css";

import AlignLeftOutlined from "@ant-design/icons/AlignLeftOutlined";
import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import CheckCircleFilled from "@ant-design/icons/CheckCircleFilled";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import EnvironmentOutlined from "@ant-design/icons/EnvironmentOutlined";
import LinkOutlined from "@ant-design/icons/LinkOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import TagOutlined from "@ant-design/icons/TagOutlined";
import VideoCameraOutlined from "@ant-design/icons/VideoCameraOutlined";
import AutoComplete from "antd/es/auto-complete";
import Button from "antd/es/button";
import Drawer from "antd/es/drawer";
import Input from "antd/es/input";
import Spin from "antd/es/spin";
import type { ReactNode } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import { FormSwitch } from "../../components/forms/FormSwitch";
import type { CalendarDescriptor, CalendarEvent, CalendarModule } from "../../services/calendar/calendar-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { CALENDAR_CONTEXT } from "./calendar-config";
import { CALENDAR_TIME_ZONE, localToUtc, utcToLocal } from "./calendar-time";
import { CalendarCrmDetails } from "./CalendarCrmDetails";
import { CalendarDayPanel } from "./CalendarDayPanel";
import { CalendarEventActions } from "./CalendarEventActions";
import { CalendarGuestFields } from "./CalendarGuestFields";
import { calendarEditAccess, type CalendarFields, type CalendarOrderContext, useCalendarEventForm } from "./useCalendarEventForm";
import { useCalendarOutlook } from "./useCalendarOutlook";

interface Props {
    readonly orderContext?: CalendarOrderContext;
    readonly event: CalendarEvent | null;
    readonly date: string;
    /** Start and end picked on the time grid; used to preload a new event. */
    readonly range?: { readonly start: string; readonly end: string } | undefined;
    readonly calendar: CalendarDescriptor;
    readonly currentModule: CalendarModule;
    readonly onClose: () => void;
    readonly onSaved: () => void;
    readonly onRefresh: () => void;
    readonly onNavigate?: ((path: string) => void) | undefined;
    readonly events?: readonly CalendarEvent[] | undefined;
    readonly calendars?: readonly CalendarDescriptor[] | undefined;
}
type Model = ReturnType<typeof useCalendarEventForm>;
type Change = <K extends keyof CalendarFields>(key: K, value: CalendarFields[K]) => void;
interface FieldsProps {
    readonly fields: CalendarFields;
    readonly change: Change;
    readonly locked: boolean;
}

/** Origin is immutable. An overlay never borrows the destination module's form or write capabilities. */
export function CalendarEventDrawer(props: Props) {
    const { event, date, calendar, currentModule, onClose, onSaved, events = [], calendars = [] } = props;
    const access = calendarEditAccess(event, calendar, currentModule);
    const model = useCalendarEventForm(event, calendar, date, { onSaved, orderContext: props.orderContext, range: props.range });
    const typeLocked = [!access.editable, model.busy, model.failure?.stale, model.failure?.uncertain, model.receipt].some(Boolean);
    const locked = [typeLocked, !model.fields.typeId].some(Boolean);
    const outlook = useCalendarOutlook(model.fields, calendar.moduleCode, event?.id, access.editable);
    const context = CALENDAR_CONTEXT[calendar.moduleCode];
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            size={drawerSize(Boolean(model.receipt))}
            closable={{ placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            className="user-detail-drawer shared-calendar-drawer"
            open
            title={`${event ? "Evento" : "Nuevo evento"} de ${context.label}`}
            onClose={() => {
                if (!model.pending.current) onClose();
            }}
            mask={{ closable: !model.busy }}
            keyboard={!model.busy}
        >
            <DeliveryNotice model={model} />
            <CalendarEventActions event={event} onChanged={onSaved} />
            <div className="shared-calendar-editor" hidden={Boolean(model.receipt)}>
                <form
                    className="shared-calendar-form event-form"
                    onSubmit={(action) => {
                        action.preventDefault();
                        if ([access.editable, !model.failure?.stale].every(Boolean)) void model.save();
                    }}
                >
                    <div className="event-form__toolbar">
                        <DrawerActions model={model} editable={access.editable} />
                        <OriginNavigation {...props} />
                        <span className="event-form__origin">
                            Origen: <strong>{context.label}</strong>
                        </span>
                    </div>
                    <p className="event-form__note">Los campos con asterisco (*) son obligatorios.</p>
                    <FailureNotice model={model} onRefresh={props.onRefresh} />
                    <AddendumConflictNotice model={model} />
                    <EventNotice event={event} supported={access.supported} editable={access.editable} />
                    <section className="event-card event-card--main" aria-label="Datos del evento">
                        <div className="event-grid">
                            <TypeField access={access} model={model} event={event} locked={typeLocked} />
                            <TitleField fields={model.fields} change={model.change} locked={locked} />
                            <DateFields model={model} locked={locked} />
                            <LocationField fields={model.fields} change={model.change} locked={locked} outlook={outlook} />
                            <ReferenceField fields={model.fields} change={model.change} locked={locked} referenceLabel={context.referenceLabel} />
                        </div>
                    </section>
                    <FormSwitch
                        icon={<VideoCameraOutlined />}
                        label="Reunión de Microsoft Teams"
                        hint="Al guardar se enviará el enlace a los participantes con la invitación de Outlook."
                        checked={model.fields.teamsRequested}
                        disabled={locked}
                        onChange={(checked) => {
                            model.change("teamsRequested", checked);
                        }}
                    />
                    <EventParticipants editable={access.editable} model={model} locked={locked} moduleCode={calendar.moduleCode} connected={Boolean(connectedData(outlook.result))} />
                    <section className="event-card event-card--body">
                        <DescriptionField fields={model.fields} change={model.change} locked={locked} addendum={model.requiresOrder} required={model.requiresAddendumReason} />
                    </section>
                </form>
                <CalendarDayPanel
                    suggestionsDisabled={locked}
                    outlook={connectedData(outlook.result)}
                    onSuggest={(slot) => {
                        if (locked) return;
                        model.change("start", utcToLocal(slot.start));
                        model.change("end", utcToLocal(slot.end));
                    }}
                    events={events}
                    calendars={calendars}
                    start={model.fields.start}
                    end={model.fields.end}
                    allDay={model.fields.allDay}
                    selfKey={eventKey(event)}
                />
            </div>
        </Drawer>
    );
}
function Field({ children, wide, help }: { readonly children: ReactNode; readonly wide?: boolean; readonly help?: string }) {
    return (
        <div className="event-field" data-wide={wide}>
            {children}
            {help && (
                <span className="event-field__help">
                    <FormHelp text={help} />
                </span>
            )}
        </div>
    );
}
function Caption({ icon, children, required }: { readonly icon: ReactNode; readonly children: ReactNode; readonly required?: boolean }) {
    return (
        <span className="event-caption">
            <i aria-hidden="true">{icon}</i>
            {children}
            {required && (
                <span className="event-required" aria-hidden="true">
                    *
                </span>
            )}
        </span>
    );
}
function TypeField({ access, model, event, locked }: { readonly access: ReturnType<typeof calendarEditAccess>; readonly model: Model; readonly event: CalendarEvent | null; readonly locked: boolean }) {
    return (
        <Field>
            <label>
                <Caption icon={<TagOutlined />} required>
                    Tipo
                </Caption>
                <select
                    required
                    aria-label="Tipo"
                    value={model.fields.typeId}
                    disabled={locked}
                    onChange={(action) => {
                        model.change("typeId", action.target.value);
                    }}
                >
                    <option value="">Selecciona un tipo</option>
                    {Boolean(model.fields.typeId) && !access.types.some((type) => type.id === model.fields.typeId) && <option value={model.fields.typeId}>{event?.typeCode ?? "Sin tipos disponibles"}</option>}
                    {access.types.map((type) => (
                        <option key={type.id} value={type.id}>
                            {type.label}
                        </option>
                    ))}
                </select>
            </label>
        </Field>
    );
}
function DrawerActions({ model, editable }: { readonly model: Model; readonly editable: boolean }) {
    if (!editable) return null;
    return (
        <Button htmlType="submit" type="primary" icon={<SaveOutlined aria-hidden="true" />} aria-label="Guardar evento" aria-busy={model.busy} loading={model.busy} disabled={[model.busy, model.failure?.stale === true, model.receipt !== null, !model.fields.typeId, Boolean(model.orderError), model.addendumConflict.blocked].some(Boolean)}>
            Guardar evento
        </Button>
    );
}
function AddendumConflictNotice({ model }: { readonly model: Model }) {
    const conflict = model.addendumConflict;
    if (!conflict.message) return null;
    return (
        <>
            <p role={conflict.checking ? "status" : "alert"}>{conflict.message}</p>
            {conflict.failed && (
                <Button disabled={model.busy || model.failure?.uncertain === true} onClick={conflict.retry}>
                    Reintentar verificación de adéndum
                </Button>
            )}
        </>
    );
}
function FailureNotice({ model, onRefresh }: { readonly model: Model; readonly onRefresh: () => void }) {
    if (!model.failure) return model.orderError ? <p role="alert">{model.orderError}</p> : null;
    return (
        <div className="event-form__failure">
            <p role="alert">{model.failure.message}</p>
            {model.confirmedId && (
                <button type="button" onClick={model.finishCrmOnly}>
                    Cerrar con evento guardado en Habita
                </button>
            )}
            {model.failure.stale && <Button onClick={onRefresh}>Recargar calendario</Button>}
        </div>
    );
}
function EventNotice({ event, supported, editable }: { readonly event: CalendarEvent | null; readonly supported: boolean; readonly editable: boolean }) {
    return (
        <>
            {event && <p className="event-form__note">Estado: {{ scheduled: "Programado", completed: "Completado", cancelled: "Cancelado" }[event.status]}</p>}
            {event?.source === "legacy" && <p className="event-form__note">Evento de solo lectura.</p>}
            {!supported && (
                <p className="event-form__note" role="alert">
                    Formulario no disponible para este tipo de evento.
                </p>
            )}
            {event && !editable && <CalendarCrmDetails event={event} />}
        </>
    );
}
function TitleField({ fields, change, locked }: FieldsProps) {
    return (
        <Field>
            <label>
                <Caption icon={<EditOutlined />} required>
                    Nombre del evento
                </Caption>
                <input
                    className="event-title-input"
                    required
                    aria-label="Nombre del evento"
                    maxLength={250}
                    placeholder="Ej. Reunión de seguimiento con el cliente"
                    value={fields.title}
                    disabled={locked}
                    onChange={(action) => {
                        change("title", action.target.value);
                    }}
                />
            </label>
        </Field>
    );
}
const roomAvailabilityOrder = { available: 0, busy: 1, unknown: 2 };
function LocationField({ fields, change, locked, outlook }: FieldsProps & { readonly outlook: ReturnType<typeof useCalendarOutlook> }) {
    const rooms = [...outlook.rooms].sort((left, right) => roomAvailabilityOrder[left.availability ?? "unknown"] - roomAvailabilityOrder[right.availability ?? "unknown"]);
    return (
        <Field>
            <label>
                <Caption icon={<EnvironmentOutlined />}>Lugar</Caption>
                <AutoComplete
                    className="calendar-location-select"
                    placeholder="Agregar una sala o ubicación"
                    value={fields.location}
                    disabled={locked}
                    options={rooms.map((room) => ({
                        value: room.address,
                        searchLabel: room.label,
                        label: (
                            <span className="calendar-room-option">
                                <span aria-hidden="true" className="calendar-room-dot" data-availability={room.availability ?? "unknown"} />
                                <span>{room.capacity === null ? room.label : `${room.label} · ${String(room.capacity)} personas`}</span>
                                <span className="calendar-room-status">{room.availability === "available" ? "Disponible" : room.availability === "busy" ? "No disponible" : "Sin confirmar"}</span>
                            </span>
                        ),
                    }))}
                    showSearch={{ filterOption: (input, option) => (option?.searchLabel ?? "").toLowerCase().includes(input.toLowerCase()) }}
                    notFoundContent={outlook.roomsLoading ? "Cargando salas…" : outlook.roomsStatus || "Puedes escribir otra ubicación."}
                    onChange={(value: string) => {
                        const room = outlook.rooms.find((room) => room.address === value);
                        change("location", room?.label ?? value);
                        change("roomAddress", room?.address ?? "");
                    }}
                >
                    <Input aria-label="Lugar" maxLength={500} styles={{ input: { height: 28, padding: 0, border: 0, outline: 0, boxShadow: "none" } }} suffix={<span aria-hidden="true">{outlook.roomsLoading ? <Spin size="small" /> : null}</span>} />
                </AutoComplete>
            </label>
        </Field>
    );
}
function ReferenceField({ fields, change, locked, referenceLabel }: FieldsProps & { readonly referenceLabel: string }) {
    return (
        <Field help="Texto breve para identificar este evento. Para asociar una nota, lead u orden, utiliza Relaciones.">
            <label>
                <Caption icon={<LinkOutlined />}>{referenceLabel}</Caption>
                <input
                    maxLength={160}
                    placeholder="Ej. Orden 208"
                    value={fields.reference}
                    disabled={locked}
                    onChange={(action) => {
                        change("reference", action.target.value);
                    }}
                />
            </label>
        </Field>
    );
}
function DescriptionField({ fields, change, locked, addendum, required }: FieldsProps & { readonly addendum: boolean; readonly required: boolean }) {
    return (
        <Field wide>
            <label>
                <Caption icon={<AlignLeftOutlined />}>
                    {addendum ? "Motivo del adéndum" : "Descripción"}
                    {required ? " *" : ""}
                </Caption>
                <textarea
                    required={required}
                    minLength={required ? 3 : undefined}
                    maxLength={required ? 2000 : 4000}
                    placeholder="Agrega detalles, objetivo o acuerdos del evento"
                    value={fields.description}
                    disabled={locked}
                    onChange={(action) => {
                        change("description", action.target.value);
                    }}
                />
            </label>
        </Field>
    );
}
function DateFields({ model, locked }: { readonly model: Model; readonly locked: boolean }) {
    const { fields, change } = model;
    const type = fields.allDay ? "date" : "datetime-local";
    return (
        <>
            <Field>
                <label>
                    <Caption icon={<ClockCircleOutlined />} required>
                        Inicio
                    </Caption>
                    <input
                        required
                        aria-label="Inicio"
                        type={type}
                        step="0.001"
                        value={fields.allDay ? fields.start.slice(0, 10) : fields.start}
                        disabled={locked}
                        onChange={(action) => {
                            change("start", fields.allDay ? `${action.target.value}T00:00` : action.target.value);
                        }}
                    />
                </label>
            </Field>
            <Field>
                <label>
                    <Caption icon={<ClockCircleOutlined />} required>
                        Fin
                    </Caption>
                    <input
                        required
                        aria-label="Fin"
                        type={type}
                        step="0.001"
                        value={fields.allDay ? fields.end.slice(0, 10) : fields.end}
                        disabled={locked}
                        onChange={(action) => {
                            change("end", fields.allDay ? `${action.target.value}T00:00` : action.target.value);
                        }}
                    />
                </label>
            </Field>
            <Field wide>
                <FormSwitch icon={<CalendarOutlined />} label="Día completo" hint={fields.allDay ? "El día de fin no se incluye." : undefined} checked={fields.allDay} disabled={locked} onChange={model.changeAllDay} />
            </Field>
        </>
    );
}
function OriginNavigation({ event, calendar, currentModule, onNavigate }: Props) {
    // Overlay canEdit is context-bound; the origin must revalidate this resource before editing.
    if (!event?.originModule || event.source !== "native" || calendar.moduleCode === currentModule || !calendar.canUpdate || !onNavigate) return null;
    const context = CALENDAR_CONTEXT[event.originModule];
    return (
        <Button
            onClick={() => {
                onNavigate(`${context.path}?date=${utcToLocal(event.start).slice(0, 10)}&event=${encodeURIComponent(event.id)}`);
            }}
        >
            Ir a {context.label}
        </Button>
    );
}

function TeamsPreference({ requested }: { readonly requested: boolean }) {
    return <p>Teams: {requested ? "Solicitado" : "No solicitado"}</p>;
}

function connectedData(result: ReturnType<typeof useCalendarOutlook>["result"]) {
    return result?.status === "connected" ? result.data : undefined;
}

function EventParticipants({ editable, model, locked, moduleCode, connected }: { readonly editable: boolean; readonly model: Model; readonly locked: boolean; readonly moduleCode: CalendarModule; readonly connected: boolean }) {
    return editable ? <CalendarGuestFields model={model} locked={locked} moduleCode={moduleCode} outlookConnected={connected} /> : <TeamsPreference requested={model.fields.teamsRequested} />;
}

/** The saved confirmation needs a narrow panel; the form needs the wide one. */
const drawerSize = (saved: boolean): string => (saved ? "min(520px, 100vw)" : "min(1180px, 100vw)");

function DeliveryNotice({ model }: { readonly model: Model }) {
    if (!model.receipt) return null;
    return (
        <section className="calendar-save-result" aria-label="Resultado de sincronización">
            <div className="calendar-save-result__head">
                <span className="calendar-save-result__icon" aria-hidden="true">
                    <CheckCircleFilled />
                </span>
                <div>
                    <p className="calendar-save-result__eyebrow">Sincronización completada</p>
                    <h2>Evento guardado</h2>
                </div>
            </div>
            <p role="status" className="calendar-save-result__intro">
                Ya está disponible en Habita y en tu calendario de Outlook.
            </p>
            <div className="calendar-save-result__summary">
                <h3>{model.fields.title}</h3>
                <p>
                    <CalendarOutlined aria-hidden="true" /> {new Date(localToUtc(model.fields.start)).toLocaleString("es-CR", { timeZone: CALENDAR_TIME_ZONE, dateStyle: "medium", timeStyle: "short" })} — {new Date(localToUtc(model.fields.end)).toLocaleTimeString("es-CR", { timeZone: CALENDAR_TIME_ZONE, timeStyle: "short" })}
                </p>
                {model.fields.location && (
                    <p>
                        <EnvironmentOutlined aria-hidden="true" /> {model.fields.location}
                    </p>
                )}
            </div>
            <RoomDelivery status={model.receipt.roomStatus} />
            <div className="calendar-save-result__actions">
                <Button type="primary" icon={<CalendarOutlined aria-hidden="true" />} onClick={model.finishCrmOnly} autoFocus>
                    Volver al calendario
                </Button>
                {model.receipt.joinUrl && (
                    <Button icon={<VideoCameraOutlined aria-hidden="true" />} href={model.receipt.joinUrl} target="_blank" rel="noopener noreferrer">
                        Abrir Teams
                    </Button>
                )}
            </div>
        </section>
    );
}
function RoomDelivery({ status }: { readonly status: string | null | undefined }) {
    if (!status) return null;
    if (status === "accepted") return <p>Reserva de sala confirmada por Exchange.</p>;
    if (status === "declined") return <p role="alert">Exchange rechazó la sala. El evento existe en Outlook, pero la sala no está reservada.</p>;
    return <p>Solicitud de sala enviada. La confirmación está pendiente en Outlook.</p>;
}

function eventKey(event: CalendarEvent | null): string | null {
    return event ? `${event.source}:${event.id}` : null;
}
