import "../administration/components/UserDetailDrawer.css";

import AlignLeftOutlined from "@ant-design/icons/AlignLeftOutlined";
import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import EditOutlined from "@ant-design/icons/EditOutlined";
import EnvironmentOutlined from "@ant-design/icons/EnvironmentOutlined";
import LinkOutlined from "@ant-design/icons/LinkOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import TagOutlined from "@ant-design/icons/TagOutlined";
import Button from "antd/es/button";
import Drawer from "antd/es/drawer";
import type { ReactNode } from "react";

import type { CalendarDescriptor, CalendarEvent, CalendarModule } from "../../services/calendar/calendar-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { CALENDAR_CONTEXT } from "./calendar-config";
import { utcToLocal } from "./calendar-time";
import { CalendarDayPanel } from "./CalendarDayPanel";
import { FormHelp } from "../../components/forms/FormHelp";
import { CalendarGuestFields } from "./CalendarGuestFields";
import { FormSwitch } from "../../components/forms/FormSwitch";
import { calendarEditAccess, type CalendarFields, useCalendarEventForm } from "./useCalendarEventForm";

interface Props {
    readonly event: CalendarEvent | null;
    readonly date: string;
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
    const model = useCalendarEventForm(event, calendar, date, onSaved);
    const locked = [!access.editable, model.busy, model.failure?.stale, model.failure?.uncertain].some(Boolean);
    const context = CALENDAR_CONTEXT[calendar.moduleCode];
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            size="min(1180px, 100vw)"
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
            <div className="shared-calendar-editor">
                <form
                    className="shared-calendar-form event-form"
                    onSubmit={(action) => {
                        action.preventDefault();
                        if (access.editable && !model.failure?.stale) void model.save();
                    }}
                >
                    <div className="event-form__toolbar">
                        <DrawerActions model={model} editable={access.editable} />
                        <OriginNavigation {...props} />
                        <span className="event-form__origin">
                            Origen: <strong>{context.label}</strong>
                        </span>
                    </div>
                    <FailureNotice model={model} onRefresh={props.onRefresh} />
                    <EventNotice event={event} supported={access.supported} />
                    <section className="event-card event-card--main" aria-label="Datos del evento">
                        <div className="event-grid">
                            <TypeField access={access} model={model} event={event} locked={locked} />
                            <TitleField fields={model.fields} change={model.change} locked={locked} />
                            <DateFields model={model} locked={locked} />
                            <LocationField fields={model.fields} change={model.change} locked={locked} />
                            <ReferenceField fields={model.fields} change={model.change} locked={locked} referenceLabel={context.referenceLabel} />
                        </div>
                    </section>
                    {access.editable ? <CalendarGuestFields model={model} locked={locked} moduleCode={calendar.moduleCode} /> : <TeamsPreference requested={model.fields.teamsRequested} />}
                    <section className="event-card event-card--body">
                        <DescriptionField fields={model.fields} change={model.change} locked={locked} />
                    </section>
                </form>
                <CalendarDayPanel events={events} calendars={calendars} start={model.fields.start} end={model.fields.end} allDay={model.fields.allDay} selfKey={event ? `${event.source}:${event.id}` : null} />
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
function Caption({ icon, children }: { readonly icon: ReactNode; readonly children: ReactNode }) {
    return (
        <span className="event-caption">
            <i aria-hidden="true">{icon}</i>
            {children}
        </span>
    );
}
function TypeField({ access, model, event, locked }: { readonly access: ReturnType<typeof calendarEditAccess>; readonly model: Model; readonly event: CalendarEvent | null; readonly locked: boolean }) {
    return (
        <Field>
            <label>
                <Caption icon={<TagOutlined />}>Tipo</Caption>
                <select
                    required
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
        <Button htmlType="submit" type="primary" icon={<SaveOutlined aria-hidden="true" />} aria-label="Guardar evento" aria-busy={model.busy} loading={model.busy} disabled={Boolean(model.busy || model.failure?.stale)}>
            Guardar evento
        </Button>
    );
}
function FailureNotice({ model, onRefresh }: { readonly model: Model; readonly onRefresh: () => void }) {
    if (!model.failure) return null;
    return (
        <div className="event-form__failure">
            <p role="alert">{model.failure.message}</p>
            {model.failure.stale && <Button onClick={onRefresh}>Recargar calendario</Button>}
        </div>
    );
}
function EventNotice({ event, supported }: { readonly event: CalendarEvent | null; readonly supported: boolean }) {
    return (
        <>
            {event && <p className="event-form__note">Estado: {{ scheduled: "Programado", completed: "Completado", cancelled: "Cancelado" }[event.status]}</p>}
            {event?.source === "legacy" && <p className="event-form__note">Evento de solo lectura.</p>}
            {!supported && (
                <p className="event-form__note" role="alert">
                    Formulario no disponible para este tipo de evento.
                </p>
            )}
        </>
    );
}
function TitleField({ fields, change, locked }: FieldsProps) {
    return (
        <Field>
            <label>
                <Caption icon={<EditOutlined />}>Nombre del evento</Caption>
                <input
                    className="event-title-input"
                    required
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
function LocationField({ fields, change, locked }: FieldsProps) {
    return (
        <Field>
            <label>
                <Caption icon={<EnvironmentOutlined />}>Lugar</Caption>
                <input
                    maxLength={500}
                    placeholder="Agregar una sala o ubicación"
                    value={fields.location}
                    disabled={locked}
                    onChange={(action) => {
                        change("location", action.target.value);
                    }}
                />
            </label>
        </Field>
    );
}
function ReferenceField({ fields, change, locked, referenceLabel }: FieldsProps & { readonly referenceLabel: string }) {
    return (
        <Field help="Opcional. Código o número para ubicar el trámite (por ejemplo, el número de orden). Es solo texto: no abre ni enlaza ningún registro.">
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
function DescriptionField({ fields, change, locked }: FieldsProps) {
    return (
        <Field wide>
            <label>
                <Caption icon={<AlignLeftOutlined />}>Descripción</Caption>
                <textarea
                    maxLength={4000}
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
                    <Caption icon={<ClockCircleOutlined />}>Inicio</Caption>
                    <input
                        required
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
                    <Caption icon={<ClockCircleOutlined />}>Fin</Caption>
                    <input
                        required
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
    if (!event || event.source !== "native" || calendar.moduleCode === currentModule || !calendar.canUpdate || !onNavigate) return null;
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
