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

/** Row with icon, title, optional hint and a switch. It stays a native checkbox so keyboard, forms and assistive tech keep working. */
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
