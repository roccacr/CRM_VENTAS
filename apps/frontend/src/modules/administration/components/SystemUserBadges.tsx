import KeyOutlined from "@ant-design/icons/KeyOutlined";
import Badge from "antd/es/badge";
import Tag from "antd/es/tag";

import { MFA_LABELS, MFA_TAG_COLORS, PROVIDER_LABELS, STATUS_BADGE_STATUS, STATUS_LABELS, type SystemUserMfaStatus, type SystemUserProvider, type SystemUserStatus } from "../system-users.model";

/** Estado con el mismo color semántico en la tabla, el detalle y la vista previa del alta. */
export function SystemUserStatusBadge({ status }: { readonly status: SystemUserStatus }) {
    return <Badge className="administration-users-status" status={STATUS_BADGE_STATUS[status]} text={STATUS_LABELS[status]} />;
}

/**
 *
 */
export function SystemUserProviderBadge({ provider }: { readonly provider: SystemUserProvider }) {
    const showMicrosoftMark = provider === "microsoft" || provider === "mixed";

    return (
        <span className="administration-users-provider">
            {showMicrosoftMark ? (
                <span className="administration-users-provider__microsoft-mark" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                </span>
            ) : null}
            {provider === "local" || provider === "mixed" ? <KeyOutlined aria-hidden="true" /> : null}
            {PROVIDER_LABELS[provider]}
        </span>
    );
}

/**
 *
 */
export function SystemUserMfaTag({ status }: { readonly status: SystemUserMfaStatus }) {
    return (
        <Tag className="administration-users-tag" color={MFA_TAG_COLORS[status]} variant="filled">
            {MFA_LABELS[status]}
        </Tag>
    );
}
