import InfoCircleOutlined from "@ant-design/icons/InfoCircleOutlined";
import Tooltip from "antd/es/tooltip";

/**
 * Definition on demand: the screen shows only figures and short labels, and the explanation
 * (what is counted, which periods are compared) opens on hover or keyboard focus.
 * It is a focusable button, not a bare icon, so keyboard and screen-reader users reach the same text.
 */
export function InfoHint({ label, children }: { readonly label: string; readonly children: string }) {
    return (
        <Tooltip title={children} placement="top" mouseEnterDelay={0.15}>
            <button type="button" className="marketing-info" aria-label={`Qué significa: ${label}`}>
                <InfoCircleOutlined aria-hidden="true" />
            </button>
        </Tooltip>
    );
}
