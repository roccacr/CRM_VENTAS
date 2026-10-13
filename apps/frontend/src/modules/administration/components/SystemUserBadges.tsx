/**
 * Indicadores compartidos del directorio de usuarios.
 *
 * Estado, proveedor y MFA usan las mismas etiquetas en la tabla, el detalle
 * y el alta para que un mismo código del API se lea igual en todas las vistas.
 */
import KeyOutlined from "@ant-design/icons/KeyOutlined";
import Badge from "antd/es/badge";
import Tag from "antd/es/tag";

import { MFA_LABELS, MFA_TAG_COLORS, PROVIDER_LABELS, STATUS_BADGE_STATUS, STATUS_LABELS, type SystemUserMfaStatus, type SystemUserProvider, type SystemUserStatus } from "../system-users.model";

/** Estado con el mismo color semántico en la tabla, el detalle y la vista previa del alta. */
export function SystemUserStatusBadge({ status }: { readonly status: SystemUserStatus }) {
    return <Badge className="administration-users-status" status={STATUS_BADGE_STATUS[status]} text={STATUS_LABELS[status]} />;
}

/** Píldora de estado del directorio; misma marca que la celda Estado de la tabla. */
export function SystemUserStatusPill({ status }: { readonly status: SystemUserStatus }) {
    return (
        <span className={`administration-users-dt-status administration-users-dt-status--${status}`}>
            <span aria-hidden="true" />
            {STATUS_LABELS[status]}
        </span>
    );
}

/**
 * Método de acceso.
 *
 * Microsoft y mixto muestran la marca de Microsoft. Local y mixto muestran
 * la llave. El texto sale de `PROVIDER_LABELS`, no del código crudo.
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

/** Etiqueta MFA. El color acompaña al texto; no es el único indicador del estado. */
export function SystemUserMfaTag({ status }: { readonly status: SystemUserMfaStatus }) {
    return (
        <Tag className="administration-users-tag" color={MFA_TAG_COLORS[status]} variant="filled">
            {MFA_LABELS[status]}
        </Tag>
    );
}
