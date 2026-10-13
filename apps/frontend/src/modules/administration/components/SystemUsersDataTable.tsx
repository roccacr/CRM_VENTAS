/**
 * Tabla del directorio con DataTables.
 *
 * Las celdas se pintan como HTML porque el plugin no acepta nodos de React.
 * Todo texto que viene del usuario pasa por `escapeHtml` antes de interpolarse.
 * Abrir el detalle o el menú no autoriza la acción: solo navega dentro de la página.
 */
import "datatables.net-dt/css/dataTables.dataTables.css";
import "datatables.net-select-dt/css/select.dataTables.css";
import "datatables.net-searchpanes-dt/css/searchPanes.dataTables.css";
import "datatables.net-searchpanes-dt";
import "datatables.net-select-dt";

import Button from "antd/es/button";
import Empty from "antd/es/empty";
import DT from "datatables.net-dt";
import DataTable, { type DataTableProps, type DataTableRef } from "datatables.net-react";
import { type CSSProperties, type Dispatch, type MouseEvent, type RefObject, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";

import { type DataTableSearchPaneField, type DataTableSearchPanesConfig, readDataTableState, SYSTEM_USERS_DATATABLE_STATE_KEY, useDataTableSearchPanes, writeDataTableState } from "../hooks/useDataTableSearchPanes";
import { copyTextToClipboard, getPrimaryActionLabel, getPrimaryStatusUpdateTarget, getRelativeActivityLabel, getRiskStatusUpdateTarget, PROVIDER_LABELS, STATUS_HELP_TEXT, STATUS_LABELS, type SystemUserListItem, type SystemUsersLoadState, type SystemUserStatusUpdateTarget } from "../system-users.model";

const registerDataTable = DataTable.use;

registerDataTable(DT);

interface SystemUsersDataTableProps {
    readonly highlightedPublicId: string | null;
    readonly loadState: SystemUsersLoadState;
    readonly onClearFilters: () => void;
    readonly onEditUser: (user: SystemUserListItem) => void;
    readonly onOpenUser: (user: SystemUserListItem) => void;
    readonly onStatusAction: (user: SystemUserListItem, status: SystemUserStatusUpdateTarget) => void;
    /** Correos en el orden y filtro aplicados, para que el detalle recorra lo mismo que se ve. */
    readonly onVisibleOrderChange?: ((emails: readonly string[]) => void) | undefined;
    readonly selectedUserEmail: string | null;
    readonly users: readonly SystemUserListItem[];
}

type SystemUserDataTableRow = SystemUserListItem & {
    readonly accessLabel: string;
    readonly activitySortValue: string;
    readonly primaryRole: string;
    readonly roleSearchValue: string;
    readonly statusLabel: string;
};

type DataTableColumn = NonNullable<DataTableProps["columns"]>[number];
type DataTableSettings = ConstructorParameters<typeof DT.Api>[0];
type DataTableApi = InstanceType<typeof DT.Api>;

interface DataTableClickContext {
    readonly onOpenUser: (user: SystemUserListItem) => void;
    readonly setActionMenu: Dispatch<SetStateAction<ActionMenuState | null>>;
    readonly userByEmail: ReadonlyMap<string, SystemUserDataTableRow>;
}

interface SystemUsersDataTableContentProps extends Omit<SystemUsersDataTableProps, "loadState" | "onClearFilters" | "users"> {
    readonly tableRows: readonly SystemUserDataTableRow[];
}

interface ActionMenuState {
    readonly email: string;
    readonly position: CSSProperties;
}

const SEARCH_PANE_FIELDS: readonly DataTableSearchPaneField[] = [{ columnIndex: 0 }, { columnIndex: 1 }, { columnIndex: 2 }];
const SEARCH_PANE_DISABLED_COLUMNS: readonly number[] = [3, 4, 5];
const MENU_OPEN_ROW_CLASS = "administration-users-table__row--menu-open";
const SELECTED_ROW_CLASS = "administration-users-table__row--selected";
const PAGE_LENGTH_OPTIONS = [10, 25, 50, 100];
const IS_TEST_RUNTIME = import.meta.env.MODE === "test";
const TOOLBAR_ROW_CLASS = "dt-layout-row projects-view-toolbar";
/** Etiquetas de cada celda en la tarjeta móvil, en el orden de las columnas. */
const COLUMN_FIELD_LABELS = ["Usuario", "Estado", "Rol", "Acceso", "Última actividad", "Acciones"];
const MOBILE_SORT_OPTIONS = [
    { label: "Usuario: A a Z", value: "0,asc" },
    { label: "Usuario: Z a A", value: "0,desc" },
    { label: "Estado: A a Z", value: "1,asc" },
    { label: "Estado: Z a A", value: "1,desc" },
    { label: "Rol: A a Z", value: "2,asc" },
    { label: "Rol: Z a A", value: "2,desc" },
    { label: "Acceso: A a Z", value: "3,asc" },
    { label: "Acceso: Z a A", value: "3,desc" },
    { label: "Última actividad: más reciente", value: "4,desc" },
    { label: "Última actividad: más antigua", value: "4,asc" },
];
/** Textos de lector de pantalla y tooltips que DataTables y SearchPanes anuncian en inglés por defecto. */
const ARIA_LANGUAGE = {
    orderable: ": activar para ordenar",
    orderableRemove: ": activar para quitar el orden",
    orderableReverse: ": activar para invertir el orden",
    paginate: { first: "Primera página", last: "Última página", next: "Página siguiente", previous: "Página anterior" },
};
const PANE_BUTTON_LANGUAGE = { clearPane: "Limpiar selección", clearSearch: "Limpiar búsqueda", collapse: "Mostrar u ocultar filtro", orderByCount: "Ordenar por cantidad", orderByLabel: "Ordenar por nombre" };
const ELLIPSIS_ICON = '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>';
const MICROSOFT_MARK = '<span class="administration-users-provider__microsoft-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span>';

/** Escapa texto de usuario antes de meterlo en el HTML de una celda de DataTables. */
const escapeHtml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const toDataTableRow = (user: SystemUserListItem): SystemUserDataTableRow => ({
    ...user,
    accessLabel: PROVIDER_LABELS[user.provider],
    activitySortValue: user.lastActivityIso ?? "",
    primaryRole: user.roles[0] ?? "Sin rol",
    roleSearchValue: user.roles.join(", ") || "Sin rol",
    statusLabel: STATUS_LABELS[user.status],
});

const isAreaRepeatedByRole = (user: SystemUserDataTableRow): boolean => user.roles.length === 1 && user.roles[0]?.localeCompare(user.orgUnit, "es", { sensitivity: "base" }) === 0;

const renderUserCell = (user: SystemUserDataTableRow): string => `
    <div class="administration-users-person">
        <button class="administration-users-person__name" type="button" aria-label="Abrir detalle de ${escapeHtml(user.name)}" title="${escapeHtml(user.name)}" data-user-open-email="${escapeHtml(user.email)}">
            <span>${escapeHtml(user.name)}</span>
            ${user.isCurrentUser ? '<span class="administration-users-current-user">Tú</span>' : ""}
        </button>
        <span class="administration-users-person__email">
            <span title="${escapeHtml(user.email)}">${escapeHtml(user.email)}</span>
            <button class="administration-users-copy-inline" type="button" aria-label="Copiar correo de ${escapeHtml(user.name)}" data-user-copy-email="${escapeHtml(user.email)}">Copiar</button>
        </span>
    </div>`;

const renderStatusCell = (user: SystemUserDataTableRow): string => `<span class="administration-users-dt-status administration-users-dt-status--${user.status}" title="${escapeHtml(STATUS_HELP_TEXT)}"><span aria-hidden="true"></span>${escapeHtml(user.statusLabel)}</span>`;

const renderScopeCell = (user: SystemUserDataTableRow): string => {
    const extraRoles = user.roles.length > 1 ? `<span class="administration-users-role-count" title="${escapeHtml(user.roles.join(", "))}" aria-label="Roles: ${escapeHtml(user.roles.join(", "))}">+${String(user.roles.length - 1)}</span>` : "";
    const area = isAreaRepeatedByRole(user) ? "" : `<span class="administration-users-scope__area">${escapeHtml(user.orgUnit)}</span>`;

    return `
        <div class="administration-users-scope">
            <span class="administration-users-roles">
                <span class="administration-users-role">${escapeHtml(user.primaryRole)}</span>
                ${extraRoles}
            </span>
            ${area}
        </div>`;
};

const renderProviderCell = (user: SystemUserDataTableRow): string => `<span class="administration-users-provider">${user.provider === "local" ? "" : MICROSOFT_MARK}<span>${escapeHtml(user.accessLabel)}</span></span>`;

const renderActivityCell = (user: SystemUserDataTableRow): string => {
    if (!user.lastActivityIso) {
        return `<span class="administration-users-muted" title="${escapeHtml(user.lastActivityLabel)}"><span aria-hidden="true">—</span><span class="administration-users-visually-hidden">${escapeHtml(user.lastActivityLabel)}</span></span>`;
    }

    return `<span class="administration-users-activity" title="${escapeHtml(user.lastActivityLabel)} · hora de Costa Rica">${escapeHtml(getRelativeActivityLabel(user.lastActivityIso))}</span>`;
};

const renderActionsCell = (user: SystemUserDataTableRow): string => `<button class="administration-users-row-menu" type="button" aria-label="Más acciones para ${escapeHtml(user.name)}" data-user-menu-email="${escapeHtml(user.email)}">${ELLIPSIS_ICON}</button>`;

const DATATABLE_COLUMNS: DataTableColumn[] = [
    { className: "administration-users-col-user", data: "name", render: (_name: string, type: string, user: SystemUserDataTableRow) => (type === "display" ? renderUserCell(user) : user.name) },
    { className: "administration-users-col-status", data: "statusLabel", render: (statusLabel: string, type: string, user: SystemUserDataTableRow) => (type === "display" ? renderStatusCell(user) : statusLabel) },
    { className: "administration-users-col-role", data: "roleSearchValue", render: (roleSearchValue: string, type: string, user: SystemUserDataTableRow) => (type === "display" ? renderScopeCell(user) : roleSearchValue) },
    { className: "administration-users-col-access", data: "accessLabel", render: (accessLabel: string, type: string, user: SystemUserDataTableRow) => (type === "display" ? renderProviderCell(user) : accessLabel) },
    { className: "administration-users-col-activity", data: "activitySortValue", render: (activitySortValue: string, type: string, user: SystemUserDataTableRow) => (type === "display" ? renderActivityCell(user) : activitySortValue || user.lastActivityLabel) },
    { className: "administration-users-col-actions", data: "email", render: (_email: string, type: string, user: SystemUserDataTableRow) => (type === "display" ? renderActionsCell(user) : "") },
];

function SystemUsersDataTableEmptyState({ loadState, onClearFilters }: { readonly loadState: SystemUsersLoadState; readonly onClearFilters: () => void }) {
    if (loadState === "loading") {
        return (
            <div className="projects-view-load-canvas" aria-busy="true">
                <div className="projects-view-loader" data-loading="true" role="status" aria-live="polite">
                    <span className="projects-view-loader__ring" aria-hidden="true" />
                    <span className="projects-view-loader__title">Cargando información de usuarios</span>
                    <span className="projects-view-loader__caption">Sincronizando directorio, roles y accesos</span>
                </div>
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
 * Búsqueda y filtros en una sola fila de herramientas sobre la tabla, sin los
 * botones de orden del plugin. jsdom no ejecuta SearchPanes: en pruebas la
 * misma fila lleva solo la búsqueda.
 */
const getTableLayout = (layout: DataTableSearchPanesConfig["layout"]) => {
    if (IS_TEST_RUNTIME) return { bottomEnd: ["pageLength", "paging"], bottomStart: "info", top: { features: ["search"], rowClass: TOOLBAR_ROW_CLASS }, topEnd: null, topStart: null };
    const top = (layout as { readonly top?: { readonly searchPanes?: Record<string, unknown> } }).top;
    return { ...layout, top: { features: ["search", { searchPanes: { ...top?.searchPanes, orderable: false } }], rowClass: TOOLBAR_ROW_CLASS }, top1Start: null };
};

const getDatatableOptions = (loadState: SystemUsersLoadState, highlightedPublicId: string | null, searchPanesConfig: DataTableSearchPanesConfig): NonNullable<DataTableProps["options"]> => {
    const options = {
        autoWidth: false,
        columnDefs: [{ orderable: false, targets: [5] }, ...(IS_TEST_RUNTIME ? [] : (searchPanesConfig.columnDefs ?? []))],
        createdRow: (row: HTMLTableRowElement, data: SystemUserDataTableRow) => {
            row.dataset.userEmail = data.email;
            row.classList.toggle("administration-users-table__row--new", data.publicId === highlightedPublicId);
            Array.from(row.cells).forEach((cell, index) => {
                cell.dataset.projectField = COLUMN_FIELD_LABELS[index] ?? "";
            });
        },
        destroy: true,
        language: {
            aria: ARIA_LANGUAGE,
            emptyTable: loadState === "error" ? "No pudimos cargar usuarios." : "Sin resultados.",
            info: "_START_–_END_ de _TOTAL_ usuarios",
            infoEmpty: "0 usuarios",
            infoFiltered: "· filtrado de _MAX_",
            lengthMenu: "Filas por página _MENU_",
            loadingRecords: "Cargando usuarios...",
            paginate: {
                first: "«",
                last: "»",
                next: "›",
                previous: "‹",
            },
            search: "Buscar:",
            searchPanes: {
                buttons: PANE_BUTTON_LANGUAGE,
                clearMessage: "Limpiar",
                collapse: {
                    0: "Filtros",
                    _: "Filtros (%d)",
                },
                collapseMessage: "Contraer",
                count: "{total}",
                countFiltered: "{shown} de {total}",
                emptyMessage: "Sin asignar",
                emptyPanes: "No hay filtros disponibles",
                loadMessage: "Cargando filtros...",
                showMessage: "Expandir",
                // Un título vacío oculta el contador hasta que haya un filtro activo.
                title: { 0: "", _: "Filtros activos: %d" },
            },
            searchPlaceholder: "Buscar usuarios",
            zeroRecords: "Sin usuarios para los filtros seleccionados.",
        },
        layout: getTableLayout(searchPanesConfig.layout),
        lengthMenu: PAGE_LENGTH_OPTIONS,
        order: [[0, "asc"]],
        pageLength: 10,
        stateDuration: -1,
        stateLoadCallback: () => readDataTableState(SYSTEM_USERS_DATATABLE_STATE_KEY),
        stateSave: true,
        stateSaveCallback: (_settings: unknown, data: Record<string, unknown>) => {
            writeDataTableState(SYSTEM_USERS_DATATABLE_STATE_KEY, data);
        },
    };

    return options as unknown as NonNullable<DataTableProps["options"]>;
};

const getDatasetButton = (eventTarget: EventTarget | null, selector: string): HTMLButtonElement | null => {
    const target = eventTarget instanceof Element ? eventTarget : null;

    return target?.closest<HTMLButtonElement>(selector) ?? null;
};

const openUserFromDataset = (email: string | undefined, userByEmail: ReadonlyMap<string, SystemUserDataTableRow>, onOpenUser: (user: SystemUserListItem) => void): boolean => {
    if (!email) {
        return false;
    }

    const user = userByEmail.get(email);

    if (!user) {
        return true;
    }

    onOpenUser(user);
    return true;
};

/** Cualquier celda abre el detalle; los botones y controles internos conservan su propia acción. */
const openUserFromRow = (eventTarget: EventTarget | null, userByEmail: ReadonlyMap<string, SystemUserDataTableRow>, onOpenUser: (user: SystemUserListItem) => void): void => {
    const target = eventTarget instanceof Element ? eventTarget : null;

    if (!target || target.closest("button, a, input, select, label")) {
        return;
    }

    const user = userByEmail.get(target.closest<HTMLTableRowElement>("tbody tr[data-user-email]")?.dataset.userEmail ?? "");

    if (user) {
        onOpenUser(user);
    }
};

const copyEmailFromDataset = (email: string | undefined): boolean => {
    if (!email) {
        return false;
    }

    copyTextToClipboard(email);
    return true;
};

const getActionMenuPosition = (menuButton: HTMLButtonElement, container: HTMLDivElement): CSSProperties => {
    const buttonRect = menuButton.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return {
        right: Math.max(containerRect.right - buttonRect.right, 16),
        top: Math.max(buttonRect.bottom - containerRect.top + 6, 8),
    };
};

const toggleMenuFromDataset = (menuButton: HTMLButtonElement | null, container: HTMLDivElement, setActionMenu: Dispatch<SetStateAction<ActionMenuState | null>>): boolean => {
    if (!menuButton) {
        return false;
    }

    const email = menuButton.dataset.userMenuEmail;

    if (!email) {
        return false;
    }

    const position = getActionMenuPosition(menuButton, container);
    setActionMenu((currentState) => (currentState?.email === email ? null : { email, position }));
    return true;
};

const handleDataTableClick = (event: MouseEvent<HTMLDivElement>, { onOpenUser, setActionMenu, userByEmail }: DataTableClickContext): void => {
    const openButton = getDatasetButton(event.target, "[data-user-open-email]");
    const copyButton = getDatasetButton(event.target, "[data-user-copy-email]");
    const menuButton = getDatasetButton(event.target, "[data-user-menu-email]");

    if (openUserFromDataset(openButton?.dataset.userOpenEmail, userByEmail, onOpenUser)) return;
    if (copyEmailFromDataset(copyButton?.dataset.userCopyEmail)) return;
    if (toggleMenuFromDataset(menuButton, event.currentTarget, setActionMenu)) return;

    setActionMenu(null);
    openUserFromRow(event.target, userByEmail, onOpenUser);
};

/** Marca en verde la fila con el menú abierto y la del detalle abierto, para saber sobre quién se actúa. */
const syncActiveRows = (container: HTMLElement | null, menuOpenEmail: string | null, selectedUserEmail: string | null): void => {
    container?.querySelectorAll<HTMLTableRowElement>("tbody tr[data-user-email]").forEach((row) => {
        row.classList.toggle(MENU_OPEN_ROW_CLASS, row.dataset.userEmail === menuOpenEmail);
        row.classList.toggle(SELECTED_ROW_CLASS, row.dataset.userEmail === selectedUserEmail);
    });
};

function SystemUsersActionMenu({ onClose, onEditUser, onOpenUser, onStatusAction, position, user }: { readonly onClose: () => void; readonly onEditUser: (user: SystemUserListItem) => void; readonly onOpenUser: (user: SystemUserListItem) => void; readonly onStatusAction: (user: SystemUserListItem, status: SystemUserStatusUpdateTarget) => void; readonly position: CSSProperties; readonly user: SystemUserDataTableRow }) {
    return (
        <div className="administration-users-datatable-menu" role="menu" style={position} aria-label={`Acciones para ${user.name}`}>
            <button
                type="button"
                role="menuitem"
                onClick={() => {
                    onOpenUser(user);
                    onClose();
                }}
            >
                Ver detalle
            </button>
            <button
                type="button"
                role="menuitem"
                disabled={Boolean(user.isCurrentUser)}
                onClick={() => {
                    onEditUser(user);
                    onClose();
                }}
            >
                Editar usuario
            </button>
            <button
                type="button"
                role="menuitem"
                disabled={Boolean(user.isCurrentUser)}
                onClick={() => {
                    onStatusAction(user, getPrimaryStatusUpdateTarget(user));
                    onClose();
                }}
            >
                {getPrimaryActionLabel(user)}
            </button>
            <button
                type="button"
                role="menuitem"
                onClick={() => {
                    copyTextToClipboard(user.email);
                    onClose();
                }}
            >
                Copiar correo
            </button>
            <button
                type="button"
                role="menuitem"
                onClick={() => {
                    copyTextToClipboard(user.publicId);
                    onClose();
                }}
            >
                Copiar ID de usuario
            </button>
            <span className="administration-users-datatable-menu__divider" role="separator" />
            <button
                className="administration-users-datatable-menu__danger"
                type="button"
                role="menuitem"
                disabled={Boolean(user.isCurrentUser)}
                onClick={() => {
                    onStatusAction(user, getRiskStatusUpdateTarget(user));
                    onClose();
                }}
            >
                {user.status === "blocked" ? "Desbloquear" : "Bloquear"}
            </button>
        </div>
    );
}

function SystemUsersOpenActionMenu({ actionMenu, onClose, onEditUser, onOpenUser, onStatusAction, userByEmail }: { readonly actionMenu: ActionMenuState | null; readonly onClose: () => void; readonly onEditUser: (user: SystemUserListItem) => void; readonly onOpenUser: (user: SystemUserListItem) => void; readonly onStatusAction: (user: SystemUserListItem, status: SystemUserStatusUpdateTarget) => void; readonly userByEmail: ReadonlyMap<string, SystemUserDataTableRow> }) {
    if (!actionMenu) {
        return null;
    }

    const actionMenuUser = userByEmail.get(actionMenu.email);

    if (!actionMenuUser) {
        return null;
    }

    return <SystemUsersActionMenu position={actionMenu.position} user={actionMenuUser} onEditUser={onEditUser} onOpenUser={onOpenUser} onStatusAction={onStatusAction} onClose={onClose} />;
}

/** La fila de filtros se anuncia como un grupo y su contador como región viva. */
const labelFilterToolbar = (container: HTMLElement | null): void => {
    const titleRow = container?.querySelector(".dtsp-titleRow");
    titleRow?.setAttribute("role", "group");
    titleRow?.setAttribute("aria-label", "Controles de filtros de usuarios");
    container?.querySelector(".dtsp-title")?.setAttribute("aria-live", "polite");
};

/** Sin encabezados visibles en móvil, este selector reemplaza el orden por columna. */
function SystemUsersMobileSort({ selectRef, tableRef }: { readonly selectRef: RefObject<HTMLSelectElement | null>; readonly tableRef: RefObject<DataTableRef | null> }) {
    return (
        <label className="projects-view-mobile-sort">
            Ordenar usuarios
            <select
                ref={selectRef}
                defaultValue="0,asc"
                onChange={(event) => {
                    const [column, direction] = event.currentTarget.value.split(",");
                    tableRef.current
                        ?.dt()
                        ?.order([Number(column), direction === "desc" ? "desc" : "asc"])
                        .draw();
                }}
            >
                <option value="" disabled>
                    Orden personalizado
                </option>
                {MOBILE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

/** Tabla de usuarios con DataTables, paginación local y SearchPanes en runtime real. */
export function SystemUsersDataTable({ highlightedPublicId, loadState, onClearFilters, onEditUser, onOpenUser, onStatusAction, onVisibleOrderChange, selectedUserEmail, users }: SystemUsersDataTableProps) {
    // Un arreglo nuevo hace que el wrapper borre y vuelva a crear todas las filas en cada render del padre.
    const tableRows = useMemo(() => users.map(toDataTableRow), [users]);

    if (tableRows.length === 0) {
        return <SystemUsersDataTableEmptyState loadState={loadState} onClearFilters={onClearFilters} />;
    }

    return <SystemUsersDataTableContent highlightedPublicId={highlightedPublicId} loadState={loadState} selectedUserEmail={selectedUserEmail} tableRows={tableRows} onEditUser={onEditUser} onOpenUser={onOpenUser} onStatusAction={onStatusAction} onVisibleOrderChange={onVisibleOrderChange} />;
}

function SystemUsersDataTableContent({ highlightedPublicId, loadState, onEditUser, onOpenUser, onStatusAction, onVisibleOrderChange, selectedUserEmail, tableRows }: SystemUsersDataTableContentProps & { readonly loadState: SystemUsersLoadState }) {
    const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<DataTableRef>(null);
    const mobileSortRef = useRef<HTMLSelectElement>(null);
    const reportedOrderRef = useRef("");
    const searchPanesConfig = useDataTableSearchPanes({ disabledColumnIndexes: SEARCH_PANE_DISABLED_COLUMNS, fields: SEARCH_PANE_FIELDS, panesPerRow: 3 });
    const userByEmail = new Map(tableRows.map((user) => [user.email, user]));
    const tableData = useMemo(() => [...tableRows], [tableRows]);
    const menuOpenEmail = actionMenu?.email ?? null;

    const activeEmailsRef = useRef({ menuOpenEmail, selectedUserEmail });

    // Sin dependencias: DataTables redibuja las filas en cada render y la marca debe reaplicarse.
    useEffect(() => {
        activeEmailsRef.current = { menuOpenEmail, selectedUserEmail };
        syncActiveRows(wrapRef.current, menuOpenEmail, selectedUserEmail);
    });

    const reportVisibleOrder = (api: DataTableApi): void => {
        if (!onVisibleOrderChange) return;
        const emails = (api.rows({ order: "applied", search: "applied" }).data().toArray() as SystemUserDataTableRow[]).map((user) => user.email);
        const signature = emails.join("|");
        if (signature === reportedOrderRef.current) return;
        reportedOrderRef.current = signature;
        onVisibleOrderChange(emails);
    };

    // El wrapper enlaza este handler una sola vez y el primer draw ocurre antes de asignar su ref: la API sale de los settings del evento.
    const syncActiveRowsOnDraw = (_event: unknown, settings: DataTableSettings): void => {
        const api = new DT.Api(settings);
        syncActiveRows(wrapRef.current, activeEmailsRef.current.menuOpenEmail, activeEmailsRef.current.selectedUserEmail);
        labelFilterToolbar(wrapRef.current);
        if (mobileSortRef.current) mobileSortRef.current.value = api.order().toString();
        reportVisibleOrder(api);
    };

    return (
        <div
            ref={wrapRef}
            className="administration-users-datatable-wrap"
            onClick={(event) => {
                handleDataTableClick(event, { onOpenUser, setActionMenu, userByEmail });
            }}
        >
            <SystemUsersOpenActionMenu
                actionMenu={actionMenu}
                userByEmail={userByEmail}
                onEditUser={onEditUser}
                onOpenUser={onOpenUser}
                onStatusAction={onStatusAction}
                onClose={() => {
                    setActionMenu(null);
                }}
            />
            <SystemUsersMobileSort selectRef={mobileSortRef} tableRef={tableRef} />
            <DataTable ref={tableRef} key={`${tableRows.map((user) => user.publicId).join("|")}:${highlightedPublicId ?? ""}`} className="administration-users-datatable" columns={DATATABLE_COLUMNS} data={tableData} options={getDatatableOptions(loadState, highlightedPublicId, searchPanesConfig)} onDraw={syncActiveRowsOnDraw}>
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Estado</th>
                        <th>Rol</th>
                        <th>Acceso</th>
                        <th>Última actividad</th>
                        <th aria-label="Acciones" />
                    </tr>
                </thead>
                <caption className="administration-users-visually-hidden">
                    {selectedUserEmail ? `Usuario seleccionado: ${selectedUserEmail}. ` : ""}
                    {highlightedPublicId ? `Usuario recién creado: ${highlightedPublicId}.` : ""}
                </caption>
            </DataTable>
        </div>
    );
}
