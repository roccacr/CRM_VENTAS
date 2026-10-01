import CopyOutlined from "@ant-design/icons/CopyOutlined";
import EllipsisOutlined from "@ant-design/icons/EllipsisOutlined";
import EyeOutlined from "@ant-design/icons/EyeOutlined";
import IdcardOutlined from "@ant-design/icons/IdcardOutlined";
import KeyOutlined from "@ant-design/icons/KeyOutlined";
import LockOutlined from "@ant-design/icons/LockOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import Button from "antd/es/button";
import Dropdown from "antd/es/dropdown";
import Empty from "antd/es/empty";
import type { MenuProps } from "antd/es/menu";
import Skeleton from "antd/es/skeleton";
import type { ColumnsType, TableProps } from "antd/es/table";
import Table from "antd/es/table";
import type { SortOrder } from "antd/es/table/interface";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

import { copyTextToClipboard, getPrimaryActionIcon, getPrimaryActionLabel, getRelativeActivityLabel, STATUS_HELP_TEXT, type SystemUserDensity, type SystemUserListItem, type SystemUsersLoadState, type SystemUserSortDirection, type SystemUserSortKey } from "../system-users.model";
import { SystemUserProviderBadge, SystemUserStatusBadge } from "./SystemUserBadges";

/** El cuerpo de la tabla hace scroll; el encabezado de la página y los filtros quedan fijos. */
const TABLE_SCROLL_Y = "max(320px, calc(100svh - var(--global-home-header-height) - 350px))";
const TABLE_SCROLL_X = 920;
const SORT_DIRECTIONS: SortOrder[] = ["ascend", "descend", "ascend"];
const SORTABLE_COLUMNS: ReadonlySet<string> = new Set<SystemUserSortKey>(["lastActivity", "name", "status"]);

interface SystemUsersTableProps {
    readonly density: SystemUserDensity;
    readonly highlightedPublicId: string | null;
    readonly loadState: SystemUsersLoadState;
    readonly onClearFilters: () => void;
    readonly onOpenUser: (user: SystemUserListItem) => void;
    readonly onSelectionChange: (emails: readonly string[]) => void;
    readonly onSortChange: (sortKey: SystemUserSortKey, direction: SystemUserSortDirection) => void;
    readonly selectedEmails: readonly string[];
    readonly selectedUserEmail: string | null;
    readonly sortDirection: SystemUserSortDirection;
    readonly sortKey: SystemUserSortKey;
    readonly users: readonly SystemUserListItem[];
}

/** Los menús y el copiado viven dentro de la fila; sin esto, abrirían también el detalle. */
const stopRowClick = (event: ReactMouseEvent): void => {
    event.stopPropagation();
};

const isSortKey = (value: unknown): value is SystemUserSortKey => typeof value === "string" && SORTABLE_COLUMNS.has(value);

/**
 * Acciones de la fila en un menú.
 *
 * Bloquear queda deshabilitado en la cuenta propia. Solo "Ver detalle" y las
 * copias actúan hoy; las demás todavía no llaman al API.
 */
const buildUserActionItems = (user: SystemUserListItem): NonNullable<MenuProps["items"]> => [
    { icon: <EyeOutlined />, key: "open", label: "Ver detalle" },
    { icon: getPrimaryActionIcon(user), key: "primary", label: getPrimaryActionLabel(user) },
    { icon: <TeamOutlined />, key: "roles", label: "Cambiar roles" },
    { icon: <KeyOutlined />, key: "reset", label: "Restablecer acceso" },
    { type: "divider" },
    { icon: <CopyOutlined />, key: "copy-email", label: "Copiar correo" },
    { icon: <IdcardOutlined />, key: "copy-id", label: "Copiar ID de usuario" },
    { type: "divider" },
    { danger: true, disabled: Boolean(user.isCurrentUser), icon: <LockOutlined />, key: "risk", label: user.status === "blocked" ? "Desbloquear" : "Bloquear" },
];

function UserActionsMenu({ onOpenUser, user }: { readonly onOpenUser: (user: SystemUserListItem) => void; readonly user: SystemUserListItem }) {
    const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
        if (key === "open") {
            onOpenUser(user);
        }

        if (key === "copy-email") {
            copyTextToClipboard(user.email);
        }

        if (key === "copy-id") {
            copyTextToClipboard(user.publicId);
        }
    };

    return (
        <span className="administration-users-row-menu" onClick={stopRowClick}>
            <Dropdown menu={{ items: buildUserActionItems(user), onClick: handleMenuClick }} trigger={["click"]} placement="bottomRight">
                <Button type="text" size="small" icon={<EllipsisOutlined aria-hidden="true" />} aria-label={`Más acciones para ${user.name}`} />
            </Dropdown>
        </span>
    );
}

function UserIdentityCell({ onOpenUser, user }: { readonly onOpenUser: (user: SystemUserListItem) => void; readonly user: SystemUserListItem }) {
    return (
        <div className="administration-users-person">
            <div className="administration-users-person__copy">
                <button
                    className="administration-users-person__name"
                    type="button"
                    aria-label={`Abrir detalle de ${user.name}`}
                    title={user.name}
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpenUser(user);
                    }}
                >
                    <span>{user.name}</span>
                    {user.isCurrentUser ? (
                        <Tag className="administration-users-tag administration-users-current-user" variant="filled">
                            Tú
                        </Tag>
                    ) : null}
                </button>
                <span className="administration-users-person__email" onClick={stopRowClick}>
                    <Typography.Text type="secondary" ellipsis={{ tooltip: user.email }} copyable={{ text: user.email, tooltips: ["Copiar correo", "Correo copiado"] }}>
                        {user.email}
                    </Typography.Text>
                </span>
            </div>
        </div>
    );
}

/** Rol (qué puede hacer) y área (dónde aplica) en una sola celda de dos líneas, igual que Usuario. */
/** Con un solo rol que se llama igual que el área (rol Ventas en Ventas), el área no agrega información. */
const isAreaRepeatedByRole = (user: SystemUserListItem): boolean => user.roles.length === 1 && user.roles[0]?.localeCompare(user.orgUnit, "es", { sensitivity: "base" }) === 0;

function UserAccessScopeCell({ user }: { readonly user: SystemUserListItem }) {
    const [firstRole] = user.roles;

    return (
        <div className="administration-users-scope">
            {firstRole ? (
                <span className="administration-users-roles">
                    <Tag className="administration-users-tag">{firstRole}</Tag>
                    {user.roles.length > 1 ? (
                        <Tooltip title={user.roles.join(", ")}>
                            <Tag className="administration-users-tag" aria-label={`Roles: ${user.roles.join(", ")}`}>
                                +{user.roles.length - 1}
                            </Tag>
                        </Tooltip>
                    ) : null}
                </span>
            ) : (
                <Typography.Text type="secondary">Sin rol</Typography.Text>
            )}
            {isAreaRepeatedByRole(user) ? null : (
                <Typography.Text className="administration-users-scope__area" type="secondary" ellipsis={{ tooltip: user.orgUnit }}>
                    {user.orgUnit}
                </Typography.Text>
            )}
        </div>
    );
}

function UserActivityCell({ user }: { readonly user: SystemUserListItem }) {
    if (!user.lastActivityIso) {
        return (
            <Tooltip title={user.lastActivityLabel}>
                <Typography.Text className="administration-users-muted" type="secondary">
                    <span aria-hidden="true">—</span>
                    <span className="administration-users-visually-hidden">{user.lastActivityLabel}</span>
                </Typography.Text>
            </Tooltip>
        );
    }

    return (
        <Tooltip title={`${user.lastActivityLabel} · hora de Costa Rica`}>
            <span className="administration-users-activity">{getRelativeActivityLabel(user.lastActivityIso)}</span>
        </Tooltip>
    );
}

function SystemUsersTableEmptyState({ loadState, onClearFilters }: { readonly loadState: SystemUsersLoadState; readonly onClearFilters: () => void }) {
    if (loadState === "loading") {
        return (
            <div className="administration-users-empty" role="status" aria-live="polite">
                <Skeleton active avatar title={false} paragraph={{ rows: 3 }} />
                <strong>Cargando información de usuarios</strong>
                <span>Preparando el directorio antes de mostrar resultados.</span>
            </div>
        );
    }

    const isError = loadState === "error";

    return (
        <Empty
            className="administration-users-empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
                <span role="status">
                    <strong>{isError ? "No pudimos cargar usuarios" : "Sin resultados"}</strong>
                    {isError ? <span>Intenta actualizar la pantalla.</span> : null}
                </span>
            }
        >
            <Button size="small" onClick={onClearFilters}>
                Limpiar filtros
            </Button>
        </Empty>
    );
}

/**
 * Directorio de usuarios con `Table` de AntD.
 *
 * El orden se resuelve en el BFF: la tabla solo informa la columna y la
 * dirección. Clic o Enter en la fila abre el detalle; la selección múltiple
 * alimenta la barra de acciones masivas.
 */
export function SystemUsersTable({ density, highlightedPublicId, loadState, onClearFilters, onOpenUser, onSelectionChange, onSortChange, selectedEmails, selectedUserEmail, sortDirection, sortKey, users }: SystemUsersTableProps) {
    const getSortOrder = (columnKey: SystemUserSortKey): SortOrder => (sortKey === columnKey ? (sortDirection === "asc" ? "ascend" : "descend") : null);
    const columns: ColumnsType<SystemUserListItem> = [
        { key: "name", render: (_, user) => <UserIdentityCell user={user} onOpenUser={onOpenUser} />, sortDirections: SORT_DIRECTIONS, sortOrder: getSortOrder("name"), sorter: true, title: "Usuario", width: 280 },
        {
            key: "status",
            onHeaderCell: () => ({ "aria-label": "Estado" }),
            render: (_, user) => <SystemUserStatusBadge status={user.status} />,
            sortDirections: SORT_DIRECTIONS,
            sortOrder: getSortOrder("status"),
            sorter: true,
            title: <span title={STATUS_HELP_TEXT}>Estado</span>,
            width: 120,
        },
        { key: "scope", render: (_, user) => <UserAccessScopeCell user={user} />, title: "Rol y área", width: 220 },
        { key: "provider", render: (_, user) => <SystemUserProviderBadge provider={user.provider} />, responsive: ["lg"], title: "Acceso", width: 150 },
        { key: "lastActivity", render: (_, user) => <UserActivityCell user={user} />, sortDirections: SORT_DIRECTIONS, sortOrder: getSortOrder("lastActivity"), sorter: true, title: "Última actividad", width: 150 },
        { align: "center", fixed: "right", key: "actions", render: (_, user) => <UserActionsMenu user={user} onOpenUser={onOpenUser} />, title: <span className="administration-users-visually-hidden">Acciones</span>, width: 56 },
    ];

    const handleTableChange: TableProps<SystemUserListItem>["onChange"] = (_, __, sorter) => {
        const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;

        if (activeSorter && isSortKey(activeSorter.columnKey)) {
            onSortChange(activeSorter.columnKey, activeSorter.order === "descend" ? "desc" : "asc");
        }
    };

    const getRowClassName = (user: SystemUserListItem): string => {
        const classNames: string[] = [];

        if (user.email === selectedUserEmail) {
            classNames.push("administration-users-table__row--selected");
        }

        if (user.publicId === highlightedPublicId) {
            classNames.push("administration-users-table__row--new");
        }

        return classNames.join(" ");
    };

    return (
        <Table<SystemUserListItem>
            className={`administration-users-table administration-users-table--${density}`}
            rowKey="email"
            size={density === "compact" ? "small" : "middle"}
            columns={columns}
            dataSource={[...users]}
            pagination={false}
            loading={loadState === "loading" && users.length > 0}
            scroll={{ x: TABLE_SCROLL_X, y: TABLE_SCROLL_Y }}
            showSorterTooltip={false}
            locale={{ emptyText: <SystemUsersTableEmptyState loadState={loadState} onClearFilters={onClearFilters} /> }}
            rowClassName={getRowClassName}
            rowSelection={{
                columnWidth: 44,
                getCheckboxProps: (user) => ({ "aria-label": `Seleccionar ${user.name}` }),
                getTitleCheckboxProps: () => ({ "aria-label": "Seleccionar usuarios visibles" }),
                selectedRowKeys: [...selectedEmails],
                onChange: (selectedRowKeys) => {
                    onSelectionChange(selectedRowKeys.map(String));
                },
            }}
            onChange={handleTableChange}
            onRow={(user) => ({
                tabIndex: 0,
                onClick: () => {
                    onOpenUser(user);
                },
                onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                    if (event.key === "Enter" && event.target === event.currentTarget) {
                        onOpenUser(user);
                    }
                },
            })}
        />
    );
}
