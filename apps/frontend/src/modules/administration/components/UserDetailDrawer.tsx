import "./UserDetailDrawer.css";

import CopyOutlined from "@ant-design/icons/CopyOutlined";
import EllipsisOutlined from "@ant-design/icons/EllipsisOutlined";
import IdcardOutlined from "@ant-design/icons/IdcardOutlined";
import KeyOutlined from "@ant-design/icons/KeyOutlined";
import LeftOutlined from "@ant-design/icons/LeftOutlined";
import LockOutlined from "@ant-design/icons/LockOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import Button from "antd/es/button";
import Card from "antd/es/card";
import type { DescriptionsProps } from "antd/es/descriptions";
import Descriptions from "antd/es/descriptions";
import Drawer from "antd/es/drawer";
import Dropdown from "antd/es/dropdown";
import type { MenuProps } from "antd/es/menu";
import Space from "antd/es/space";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import { useEffect, useState } from "react";

import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration-theme";
import { copyTextToClipboard, getDrawerPrimaryActionLabel, getDrawerRiskActionLabel, getPrimaryActionIcon, getRelativeActivityLabel, type SystemUserListItem } from "../system-users.model";
import { SystemUserAvatar } from "./SystemUserAvatar";
import { SystemUserMfaTag, SystemUserProviderBadge, SystemUserStatusBadge } from "./SystemUserBadges";

interface UserDetailDrawerProps {
    readonly onClose: () => void;
    readonly onSelectNext: () => void;
    readonly onSelectPrevious: () => void;
    readonly position: number;
    readonly total: number;
    readonly user: SystemUserListItem | null;
}

/** Las flechas recorren usuarios salvo cuando el foco está en un campo o un menú abierto. */
const KEYBOARD_NAVIGATION_IGNORED_SELECTOR = "input, textarea, select, [role='menu'], [role='listbox'], .ant-dropdown";

const DESCRIPTIONS_PROPS = { colon: false, column: 1, layout: "horizontal", size: "small" } as const satisfies DescriptionsProps;
function UserDrawerHeader({ user }: { readonly user: SystemUserListItem }) {
    return (
        <div className="user-detail-drawer__identity">
            <SystemUserAvatar user={user} />
            <div className="user-detail-drawer__identity-copy">
                <Typography.Title level={4}>{user.name}</Typography.Title>
                <Typography.Text type="secondary" ellipsis={{ tooltip: user.email }} copyable={{ text: user.email, tooltips: ["Copiar correo", "Correo copiado"] }}>
                    {user.email}
                </Typography.Text>
                <span className="user-detail-drawer__identity-meta">
                    <SystemUserStatusBadge status={user.status} />
                    {user.isCurrentUser ? (
                        <Tag className="administration-users-tag" variant="filled">
                            Tu cuenta
                        </Tag>
                    ) : null}
                </span>
            </div>
        </div>
    );
}

/**
 * Acciones de baja frecuencia en el menú del encabezado.
 *
 * Bloquear solo aplica a activo y bloqueado, y nunca a la cuenta propia.
 * Copiar actúa hoy; el resto todavía no llama al API.
 */
const buildOverflowItems = (user: SystemUserListItem): NonNullable<MenuProps["items"]> => {
    const items: NonNullable<MenuProps["items"]> = [{ icon: <TeamOutlined />, key: "roles", label: "Cambiar roles" }, { icon: <KeyOutlined />, key: "reset", label: "Restablecer acceso" }, { type: "divider" }, { icon: <CopyOutlined />, key: "copy-email", label: "Copiar correo" }, { icon: <IdcardOutlined />, key: "copy-id", label: "Copiar ID de usuario" }];

    if (user.status === "active" || user.status === "blocked") {
        items.push({ type: "divider" }, { danger: true, disabled: Boolean(user.isCurrentUser), icon: <LockOutlined />, key: "risk", label: user.isCurrentUser ? "No puedes bloquear tu propia cuenta" : getDrawerRiskActionLabel(user) });
    }

    return items;
};

function UserOverflowMenu({ user }: { readonly user: SystemUserListItem }) {
    const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
        if (key === "copy-email") {
            copyTextToClipboard(user.email);
        }

        if (key === "copy-id") {
            copyTextToClipboard(user.publicId);
        }
    };

    return (
        <Dropdown menu={{ items: buildOverflowItems(user), onClick: handleMenuClick }} trigger={["click"]} placement="bottomRight">
            <Tooltip title="Más acciones" placement="bottom">
                <Button className="user-detail-drawer__header-button" type="text" icon={<EllipsisOutlined aria-hidden="true" />} aria-label={`Más acciones para ${user.name}`} />
            </Tooltip>
        </Dropdown>
    );
}

function LastActivityValue({ user }: { readonly user: SystemUserListItem }) {
    if (!user.lastActivityIso) {
        return <Typography.Text type="secondary">{user.lastActivityLabel}</Typography.Text>;
    }

    return (
        <span className="user-detail-drawer__activity">
            {getRelativeActivityLabel(user.lastActivityIso)}
            <Typography.Text type="secondary">{user.lastActivityLabel}</Typography.Text>
        </span>
    );
}

function UserRoleTags({ roles }: { readonly roles: readonly string[] }) {
    if (roles.length === 0) {
        return <Typography.Text type="secondary">Sin rol asignado</Typography.Text>;
    }

    return (
        <span className="administration-users-roles administration-users-roles--wrap">
            {roles.map((role) => (
                <Tag key={role} className="administration-users-tag">
                    {role}
                </Tag>
            ))}
        </span>
    );
}

/**
 * Cuerpo del detalle, de lo más consultado a lo menos.
 *
 * Primero qué puede hacer y dónde, luego cómo entra, y al final los datos de
 * registro que solo se buscan para soporte o auditoría.
 */
function UserDetailSections({ user }: { readonly user: SystemUserListItem }) {
    const recordItems: NonNullable<DescriptionsProps["items"]> = [
        {
            children: (
                <Typography.Text className="user-detail-drawer__public-id" code copyable={{ text: user.publicId, tooltips: ["Copiar ID de usuario", "ID copiado"] }}>
                    {user.publicId}
                </Typography.Text>
            ),
            key: "publicId",
            label: "ID de usuario",
        },
        { children: user.roleChangedAtLabel, key: "roleChangedAt", label: "Cambio de rol" },
    ];

    if (user.invitedBy) {
        recordItems.push({ children: user.invitedBy, key: "invitedBy", label: "Invitado por" });
    }

    return (
        <div className="user-detail-drawer__sections">
            <Card size="small" title="Rol y área">
                <Descriptions
                    {...DESCRIPTIONS_PROPS}
                    items={[
                        { children: <UserRoleTags roles={user.roles} />, key: "roles", label: user.roles.length === 1 ? "Rol" : "Roles" },
                        { children: user.orgUnit, key: "orgUnit", label: "Área" },
                    ]}
                />
            </Card>
            <Card size="small" title="Seguridad">
                <Descriptions
                    {...DESCRIPTIONS_PROPS}
                    items={[
                        { children: <SystemUserProviderBadge provider={user.provider} />, key: "provider", label: "Acceso" },
                        { children: <SystemUserMfaTag status={user.mfaStatus} />, key: "mfa", label: "MFA" },
                        { children: <LastActivityValue user={user} />, key: "lastActivity", label: "Última actividad" },
                    ]}
                />
            </Card>
            <Card size="small" title="Registro">
                <Descriptions {...DESCRIPTIONS_PROPS} items={recordItems} />
            </Card>
        </div>
    );
}

interface UserDrawerFooterProps {
    readonly canSelectNext: boolean;
    readonly canSelectPrevious: boolean;
    readonly onSelectNext: () => void;
    readonly onSelectPrevious: () => void;
    readonly position: number;
    readonly total: number;
    readonly user: SystemUserListItem | null;
}

/**
 * Pie del panel: posición como contexto a la izquierda; navegación y acción
 * principal agrupadas a la derecha, todas con la misma altura.
 */
function UserDrawerFooter({ canSelectNext, canSelectPrevious, onSelectNext, onSelectPrevious, position, total, user }: UserDrawerFooterProps) {
    const primaryActionLabel = user ? getDrawerPrimaryActionLabel(user) : null;

    return (
        <div className="user-detail-drawer__footer">
            <Typography.Text type="secondary" className="user-detail-drawer__position">
                Usuario {position} de {total}
            </Typography.Text>
            <Space size={8}>
                <Space.Compact>
                    <Tooltip title="Usuario anterior (↑)">
                        <Button icon={<LeftOutlined aria-hidden="true" />} aria-label="Usuario anterior" disabled={!canSelectPrevious} onClick={onSelectPrevious} />
                    </Tooltip>
                    <Tooltip title="Usuario siguiente (↓)">
                        <Button icon={<RightOutlined aria-hidden="true" />} aria-label="Usuario siguiente" disabled={!canSelectNext} onClick={onSelectNext} />
                    </Tooltip>
                </Space.Compact>
                {user && primaryActionLabel ? (
                    <Button type="primary" icon={getPrimaryActionIcon(user)} aria-label={primaryActionLabel}>
                        {primaryActionLabel}
                    </Button>
                ) : null}
            </Space>
        </div>
    );
}

/**
 * Detalle del usuario en el mismo panel lateral que el alta.
 *
 * Conserva el último usuario mientras el panel se cierra para que la
 * animación no muestre un panel vacío. Flecha arriba y abajo recorren la
 * página visible; Escape o clic en la máscara cierran.
 */
export function UserDetailDrawer({ onClose, onSelectNext, onSelectPrevious, position, total, user }: UserDetailDrawerProps) {
    const [displayedUser, setDisplayedUser] = useState(user);
    const canSelectPrevious = position > 1;
    const canSelectNext = position > 0 && position < total;

    if (user && user !== displayedUser) {
        setDisplayedUser(user);
    }

    useEffect(() => {
        if (!user) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.target instanceof Element && event.target.closest(KEYBOARD_NAVIGATION_IGNORED_SELECTOR)) {
                return;
            }

            if (event.key === "ArrowUp" && canSelectPrevious) {
                event.preventDefault();
                onSelectPrevious();
            }

            if (event.key === "ArrowDown" && canSelectNext) {
                event.preventDefault();
                onSelectNext();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [canSelectNext, canSelectPrevious, onSelectNext, onSelectPrevious, user]);

    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName="user-detail-drawer"
            open={user !== null}
            closable={{ "aria-label": "Cerrar detalle", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            title={displayedUser ? <UserDrawerHeader user={displayedUser} /> : null}
            extra={displayedUser ? <UserOverflowMenu user={displayedUser} /> : null}
            footer={<UserDrawerFooter canSelectNext={canSelectNext} canSelectPrevious={canSelectPrevious} position={position} total={total} user={displayedUser} onSelectNext={onSelectNext} onSelectPrevious={onSelectPrevious} />}
            onClose={onClose}
        >
            {displayedUser ? <UserDetailSections user={displayedUser} /> : null}
        </Drawer>
    );
}
