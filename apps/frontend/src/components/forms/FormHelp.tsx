import "./form-controls.css";

import QuestionCircleOutlined from "@ant-design/icons/QuestionCircleOutlined";
import Tooltip from "antd/es/tooltip";

/**
 * La explicación larga queda detrás del ícono para no ensuciar el formulario.
 * El aviso se abre al pasar el puntero o al enfocar. Un toque enfoca el botón, así que también lo muestra.
 * `type="button"` evita que, dentro de un formulario, el clic envíe los datos.
 * Si no llega otra etiqueta, el nombre accesible es el mismo texto del aviso.
 */
export function FormHelp({ text, label = text }: { readonly text: string; readonly label?: string }) {
    return (
        <Tooltip title={text} placement="top" trigger={["hover", "focus"]} classNames={{ root: "event-help__tip" }}>
            <button type="button" className="event-help" aria-label={label}>
                <QuestionCircleOutlined aria-hidden="true" />
            </button>
        </Tooltip>
    );
}
