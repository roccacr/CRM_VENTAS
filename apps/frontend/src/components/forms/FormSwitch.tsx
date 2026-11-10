import "./form-controls.css";

import { type ReactNode, useId } from "react";

import { FormHelp } from "./FormHelp";

interface Props {
    readonly icon: ReactNode;
    readonly label: string;
    readonly hint?: string | undefined;
    readonly checked: boolean;
    readonly disabled: boolean;
    readonly onChange: (checked: boolean) => void;
}

/**
 * Fila con ícono, título, ayuda opcional e interruptor.
 * Sigue siendo un checkbox nativo: el teclado, el formulario y el lector de pantalla lo usan sin un control propio.
 * El `id` generado une la etiqueta con el input. El valor lo guarda quien llama; aquí solo se reenvía el booleano.
 * El ícono es decorativo. `data-checked` pinta el estado y no sustituye al checkbox. Una ayuda vacía no muestra el ícono de ayuda.
 */
export function FormSwitch({ icon, label, hint, checked, disabled, onChange }: Props) {
    const id = useId();
    return (
        <div className="event-switch" data-checked={checked}>
            <i className="event-switch__icon" aria-hidden="true">
                {icon}
            </i>
            <div className="event-switch__text">
                <span className="event-switch__title">
                    <label htmlFor={id}>{label}</label>
                    {hint && <FormHelp text={hint} />}
                </span>
            </div>
            <input
                id={id}
                className="event-switch__input"
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(action) => {
                    onChange(action.target.checked);
                }}
            />
        </div>
    );
}
