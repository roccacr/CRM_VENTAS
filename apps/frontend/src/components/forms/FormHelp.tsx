import "./form-controls.css";

import QuestionCircleOutlined from "@ant-design/icons/QuestionCircleOutlined";
import Tooltip from "antd/es/tooltip";

/** Secondary explanations live behind a help icon so the form stays clean; hover, focus or tap reveals them. */
export function FormHelp({ text, label = text }: { readonly text: string; readonly label?: string }) {
    return (
        <Tooltip title={text} placement="top" trigger={["hover", "focus"]} classNames={{ root: "event-help__tip" }}>
            <button type="button" className="event-help" aria-label={label}>
                <QuestionCircleOutlined aria-hidden="true" />
            </button>
        </Tooltip>
    );
}
