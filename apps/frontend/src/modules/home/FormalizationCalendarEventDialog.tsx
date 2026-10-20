import ArrowRightOutlined from "@ant-design/icons/ArrowRightOutlined";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { useId, useState } from "react";

import { EVENT_KIND_LABELS, EVENT_STATUS_LABELS, type FormalizationCalendarEvent } from "./formalization-calendar.model";
import { FORMALIZATION_EXAMPLES } from "./formalization-preview.model";

/** Formulario de evento ficticio: nunca envía invitaciones ni recordatorios. */
export function FormalizationCalendarEventDialog({ initial, onSave, onClose, onOpenOrder }: { readonly initial: FormalizationCalendarEvent; readonly onSave: (event: FormalizationCalendarEvent) => void; readonly onClose: () => void; readonly onOpenOrder: (id: string) => void }) {
    const id = useId();
    const [event, setEvent] = useState(initial);
    const [error, setError] = useState("");
    const update = (name: keyof FormalizationCalendarEvent, value: string) => {
        setEvent((current) => ({ ...current, [name]: value }));
    };
    return (
        <Modal
            open
            centered
            className="formalization-modal"
            width={760}
            title={initial.id ? "Detalle del evento" : "Nuevo evento"}
            onCancel={onClose}
            footer={
                <>
                    <Button onClick={onClose}>Cancelar</Button>
                    <Button type="primary" htmlType="submit" form={id}>
                        Guardar
                    </Button>
                </>
            }
        >
            <form
                id={id}
                className="formalization-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    try {
                        onSave(event);
                    } catch (caught) {
                        setError(caught instanceof Error ? caught.message : "Revisa los datos del evento.");
                    }
                }}
            >
                <div className="formalization-form__fields">
                    <label className="formalization-form__field">
                        Título *
                        <input
                            required
                            maxLength={120}
                            value={event.title}
                            onChange={(e) => {
                                update("title", e.target.value);
                            }}
                        />
                    </label>
                    <label className="formalization-form__field">
                        Tipo *
                        <select
                            value={event.kind}
                            onChange={(e) => {
                                update("kind", e.target.value);
                            }}
                        >
                            {Object.entries(EVENT_KIND_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="formalization-form__field">
                        Fecha *
                        <input
                            required
                            type="date"
                            value={event.date}
                            onChange={(e) => {
                                update("date", e.target.value);
                            }}
                        />
                    </label>
                    <label className="formalization-form__field">
                        Estado *
                        <select
                            value={event.status}
                            onChange={(e) => {
                                update("status", e.target.value);
                            }}
                        >
                            {Object.entries(EVENT_STATUS_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="formalization-form__field">
                        Inicio *
                        <input
                            required
                            type="time"
                            value={event.start}
                            onChange={(e) => {
                                update("start", e.target.value);
                            }}
                        />
                    </label>
                    <label className="formalization-form__field">
                        Fin *
                        <input
                            required
                            type="time"
                            value={event.end}
                            onChange={(e) => {
                                update("end", e.target.value);
                            }}
                        />
                    </label>
                    <label className="formalization-form__field">
                        Orden de venta *
                        <select
                            required
                            value={event.orderId}
                            onChange={(e) => {
                                update("orderId", e.target.value);
                            }}
                        >
                            <option value="">Seleccionar orden</option>
                            {FORMALIZATION_EXAMPLES.map((order) => (
                                <option key={order.id} value={order.id}>
                                    {order.id} · {order.client} · {order.project}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="formalization-form__field">
                        Responsable *
                        <select
                            value={event.owner}
                            onChange={(e) => {
                                update("owner", e.target.value);
                            }}
                        >
                            <option>Gestor de ejemplo 1</option>
                            <option>Gestor de ejemplo 2</option>
                        </select>
                    </label>
                    <label className="formalization-form__field">
                        <span>
                            Participantes<span className="formalization-form__optional"> · Opcional</span>
                        </span>
                        <input
                            maxLength={250}
                            value={event.participants}
                            onChange={(e) => {
                                update("participants", e.target.value);
                            }}
                        />
                    </label>
                    <label className="formalization-form__field">
                        <span>
                            Lugar o enlace de reunión<span className="formalization-form__optional"> · Opcional</span>
                        </span>
                        <input
                            maxLength={250}
                            value={event.location}
                            onChange={(e) => {
                                update("location", e.target.value);
                            }}
                        />
                    </label>
                    <label className="formalization-form__field">
                        <span>
                            Notas<span className="formalization-form__optional"> · Opcional</span>
                        </span>
                        <textarea
                            rows={3}
                            maxLength={1000}
                            value={event.notes}
                            onChange={(e) => {
                                update("notes", e.target.value);
                            }}
                        />
                    </label>
                </div>
                <Button
                    aria-label="Ver orden de venta"
                    icon={<ArrowRightOutlined />}
                    disabled={!event.orderId}
                    onClick={() => {
                        onOpenOrder(event.orderId);
                    }}
                >
                    Ver orden de venta
                </Button>
                {error && (
                    <p role="alert" className="formalization-form__error">
                        {error}
                    </p>
                )}
            </form>
            <details className="formalization-calendar-history">
                <summary>Historial del evento</summary>
                <ul>
                    {(initial.history ?? []).map((entry, index) => (
                        <li key={`${entry.at}-${String(index)}`}>
                            <strong>
                                {entry.at} · {entry.actor}
                            </strong>
                            <p>{entry.detail}</p>
                        </li>
                    ))}
                </ul>
                {!initial.history?.length && <p>Sin cambios registrados.</p>}
            </details>
        </Modal>
    );
}
