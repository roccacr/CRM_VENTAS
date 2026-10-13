/**
 * Directorio de usuarios del sistema.
 *
 * Orquesta filtros de URL, tabla, detalle y alta. Cada mutación pide un motivo
 * y el API vuelve a autorizarla. Esta página no decide si el actor puede crear,
 * editar o cambiar el estado.
 */
import "./SystemUsersPage.css";
import "../catalogs/ProjectsView.css";
import "./UsersView.css";

import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import UserAddOutlined from "@ant-design/icons/UserAddOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Input from "antd/es/input";
import esES from "antd/es/locale/es_ES";
import message from "antd/es/message";
import Modal from "antd/es/modal";
import Tooltip from "antd/es/tooltip";
import { useEffect, useState } from "react";

import { ApiClientError } from "../../../services/api/api-client";
import { createSystemUser, updateSystemUser, updateSystemUserStatus } from "../../../services/auth/auth-service";
import type { CreateSystemUserPayload, UpdateSystemUserPayload } from "../../../services/auth/identity-contracts";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration-theme";
import { PROJECTS_THEME } from "../catalogs/projects-theme";
import { CreateSystemUserDrawer } from "../components/CreateSystemUserDrawer";
import { SystemUsersDataTable } from "../components/SystemUsersDataTable";
import { UserDetailDrawer } from "../components/UserDetailDrawer";
import { useCreateUserCatalog } from "../hooks/useCreateUserCatalog";
import { clearSystemUsersDataTableState } from "../hooks/useDataTableSearchPanes";
import { useSystemUsersDirectory } from "../hooks/useSystemUsersDirectory";
import { useSystemUsersUrlState } from "../hooks/useSystemUsersUrlState";
import { getLoadMoreLabel, getUserAtOffset, getUsersRangeLabel, mapApiUserToListItem, STATUS_LABELS, type SystemUserListItem, type SystemUserSortDirection, type SystemUserSortKey, type SystemUserStatusUpdateTarget } from "../system-users.model";

/** Tiempo que la fila recién creada queda resaltada en la tabla. */
const NEW_USER_HIGHLIGHT_MS = 6000;
const MIN_STATUS_REASON_LENGTH = 5;

/** Texto `message` del BFF. Si no es string ni lista de strings, se usa el respaldo. */
const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof ApiClientError)) {
        return fallback;
    }

    const responseBody = error.responseBody;

    if (!responseBody || typeof responseBody !== "object" || !("message" in responseBody)) {
        return fallback;
    }

    const message = (responseBody as { readonly message?: unknown }).message;

    if (Array.isArray(message)) {
        return message.filter((item): item is string => typeof item === "string").join(" ");
    }

    return typeof message === "string" && message.length > 0 ? message : fallback;
};

/** Usuario y estado destino que el diálogo todavía no ha confirmado. */
interface PendingStatusAction {
    readonly status: SystemUserStatusUpdateTarget;
    readonly user: SystemUserListItem;
}

/** El botón de confirmar sigue deshabilitado hasta que el motivo alcanza el mínimo. */
interface StatusActionDialogProps {
    readonly action: PendingStatusAction | null;
    readonly isSubmitting: boolean;
    readonly onClose: () => void;
    readonly onReasonChange: (value: string) => void;
    readonly onSubmit: () => void;
    readonly reason: string;
}

const getStatusActionTitle = ({ status, user }: PendingStatusAction): string => {
    if (status === "blocked") {
        return "Bloquear usuario";
    }

    if (status === "inactive") {
        return "Desactivar usuario";
    }

    if (user.status === "blocked") {
        return "Desbloquear usuario";
    }

    if (user.status === "pending") {
        return "Completar activación";
    }

    return "Reactivar usuario";
};

/** Confirma activar, inactivar o bloquear. El motivo viaja al API para la auditoría. */
function StatusActionDialog({ action, isSubmitting, onClose, onReasonChange, onSubmit, reason }: StatusActionDialogProps) {
    return (
        <Modal
            centered
            destroyOnHidden
            className="administration-users-status-modal catalog-items-modal--projects users-view-modal"
            footer={
                <div className="administration-users-status-dialog__footer">
                    <Button className="administration-users-status-dialog__secondary" disabled={isSubmitting} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button className="administration-users-status-dialog__primary" disabled={reason.trim().length < MIN_STATUS_REASON_LENGTH} loading={isSubmitting} onClick={onSubmit}>
                        <SaveOutlined aria-hidden="true" />
                        Confirmar acción
                    </Button>
                </div>
            }
            open={action !== null}
            rootClassName="administration-users-status-modal-root"
            title={
                <div className="administration-users-status-dialog__title">
                    <h2>{action ? getStatusActionTitle(action) : "Actualizar usuario"}</h2>
                    <p>{action ? `Se actualizará el acceso de ${action.user.name}.` : "Confirma el cambio de estado del usuario."}</p>
                </div>
            }
            zIndex={ADMINISTRATION_MODAL_Z_INDEX}
            onCancel={onClose}
            onOk={onSubmit}
        >
            {action ? (
                <div className="administration-users-status-dialog__summary">
                    <strong>Resumen efectivo</strong>
                    <ul>
                        <li>Usuario: {action.user.name}</li>
                        <li>
                            Estado: {STATUS_LABELS[action.user.status]} -&gt; {STATUS_LABELS[action.status]}
                        </li>
                        <li>Correo: {action.user.email}</li>
                    </ul>
                </div>
            ) : null}
            <label className="administration-users-status-dialog__label" htmlFor="system-user-status-reason">
                Motivo de auditoría *
            </label>
            <Input.TextArea
                id="system-user-status-reason"
                autoSize={{ maxRows: 4, minRows: 2 }}
                maxLength={255}
                showCount
                autoFocus
                value={reason}
                placeholder="Ej. Cambio autorizado por jefatura."
                onChange={(event) => {
                    onReasonChange(event.target.value);
                }}
            />
        </Modal>
    );
}

/** Aviso accesible mientras se pide otra página del directorio. */
function SystemUsersRefreshStatus() {
    return (
        <div className="administration-users-refresh-status" role="status" aria-live="polite">
            <span className="ant-spin-spinning administration-users-refresh-status__compat" aria-hidden="true" />
            <span className="administration-users-refresh-status__dot" aria-hidden="true" />
            <strong>Actualizando usuarios...</strong>
        </div>
    );
}

/** Total del API junto al título; cuenta todo el directorio, no solo el lote cargado. */
function UsersPageTitle({ isLoading, total }: { readonly isLoading: boolean; readonly total: number }) {
    return (
        <div className="projects-view-title-row">
            <h1 id="administration-users-page-title">Usuarios</h1>
            {isLoading ? null : (
                <span className="projects-view-total">
                    {total} {total === 1 ? "usuario" : "usuarios"}
                </span>
            )}
        </div>
    );
}

function UsersHeaderActions({ isLoading, onCreate, onRefresh }: { readonly isLoading: boolean; readonly onCreate: () => void; readonly onRefresh: () => void }) {
    return (
        <div className="global-home-page-header__actions">
            <Tooltip title="Actualizar usuarios">
                <Button className="projects-view-refresh" aria-label="Actualizar usuarios" icon={<ReloadOutlined spin={isLoading} />} disabled={isLoading} onClick={onRefresh} />
            </Tooltip>
            <button className="global-home-page-header__primary" type="button" aria-label="Nuevo usuario" onClick={onCreate}>
                <UserAddOutlined />
                Nuevo usuario
            </button>
        </div>
    );
}

/** El detalle recorre los usuarios en el orden y filtro que muestra la tabla. */
const getNavigationUsers = (users: readonly SystemUserListItem[], visibleOrder: readonly string[] | null, selectedEmail: string | null): readonly SystemUserListItem[] => {
    if (!visibleOrder || !selectedEmail || !visibleOrder.includes(selectedEmail)) return users;
    const byEmail = new Map(users.map((user) => [user.email, user]));
    return visibleOrder.flatMap((email) => byEmail.get(email) ?? []);
};

/**
 * Directorio de usuarios del sistema.
 *
 * El filtro, la búsqueda y el orden se resuelven en el BFF y quedan en la URL.
 * Esta pantalla orquesta la tabla, el detalle lateral y el alta; no autoriza
 * acciones: el API valida cada una.
 */
export function SystemUsersPage() {
    const { activeFilter, searchQuery, setActiveFilter, setSearchQuery } = useSystemUsersUrlState();
    const [createError, setCreateError] = useState<string | null>(null);
    const [editError, setEditError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<SystemUserListItem | null>(null);
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [isUpdatingUser, setIsUpdatingUser] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [highlightedPublicId, setHighlightedPublicId] = useState<string | null>(null);
    const [pendingStatusAction, setPendingStatusAction] = useState<PendingStatusAction | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [statusReason, setStatusReason] = useState("");
    const [sortDirection, setSortDirection] = useState<SystemUserSortDirection>("asc");
    const [sortKey, setSortKey] = useState<SystemUserSortKey>("name");
    const createUserCatalog = useCreateUserCatalog();
    const { hasMore, isLoadingMore, loadMore, loadState, pageTotal, selectedUser, setSelectedUser, users } = useSystemUsersDirectory({ activeFilter, reloadToken, searchQuery, sortDirection, sortKey });

    const [visibleOrder, setVisibleOrder] = useState<readonly string[] | null>(null);
    const isRefreshing = loadState === "loading" && users.length > 0;
    const selectedUserEmail = selectedUser?.email ?? null;
    const navigationUsers = getNavigationUsers(users, visibleOrder, selectedUserEmail);
    const selectedUserIndex = navigationUsers.findIndex((user) => user.email === selectedUserEmail);

    useEffect(() => {
        if (!highlightedPublicId) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setHighlightedPublicId(null);
        }, NEW_USER_HIGHLIGHT_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [highlightedPublicId]);

    const selectUserByOffset = (offset: -1 | 1): void => {
        const nextUser = getUserAtOffset(navigationUsers, selectedUserIndex, offset);

        if (nextUser) {
            setSelectedUser(nextUser);
        }
    };

    const clearFilters = (): void => {
        clearSystemUsersDataTableState();
        setSearchQuery("");
        setActiveFilter("all");
    };

    const openCreateUserDrawer = (): void => {
        setCreateError(null);
        setIsCreateUserOpen(true);
    };

    const closeCreateUserDrawer = (): void => {
        setIsCreateUserOpen(false);
        setCreateError(null);
    };

    const openEditUserDrawer = (user: SystemUserListItem): void => {
        setEditError(null);
        setEditingUser(user);
    };

    const closeEditUserDrawer = (): void => {
        if (isUpdatingUser) {
            return;
        }

        setEditingUser(null);
        setEditError(null);
    };

    const openStatusAction = (user: SystemUserListItem, status: SystemUserStatusUpdateTarget): void => {
        setStatusReason("");
        setPendingStatusAction({ status, user });
    };

    const closeStatusAction = (): void => {
        if (isUpdatingStatus) {
            return;
        }

        setPendingStatusAction(null);
        setStatusReason("");
    };

    const submitStatusAction = (): void => {
        if (!pendingStatusAction) {
            return;
        }

        const reason = statusReason.trim();

        if (reason.length < MIN_STATUS_REASON_LENGTH) {
            void message.warning("Agrega un motivo auditable de al menos 5 caracteres.");
            return;
        }

        setIsUpdatingStatus(true);
        void updateSystemUserStatus(pendingStatusAction.user.publicId, {
            reason,
            status: pendingStatusAction.status,
        })
            .then((updatedUser) => {
                const nextSelectedUser = mapApiUserToListItem(updatedUser);
                setSelectedUser(selectedUser?.publicId === nextSelectedUser.publicId ? nextSelectedUser : selectedUser);
                setReloadToken((currentToken) => currentToken + 1);
                setPendingStatusAction(null);
                setStatusReason("");
                void message.success(`Estado de ${updatedUser.name} actualizado a ${STATUS_LABELS[updatedUser.status]}.`);
            })
            .catch(() => {
                void message.error("No pudimos actualizar el estado del usuario. Revisa permisos y vuelve a intentar.");
            })
            .finally(() => {
                setIsUpdatingStatus(false);
            });
    };

    /** Al crear, vuelve a la vista base y resalta la fila nueva para confirmar el alta sin recargar la página. */
    const submitCreateUser = (payload: CreateSystemUserPayload): void => {
        setIsCreatingUser(true);
        setCreateError(null);
        void createSystemUser(payload)
            .then((createdUser) => {
                setSelectedUser(null);
                clearFilters();
                setSortKey("name");
                setSortDirection("asc");
                setIsCreateUserOpen(false);
                setHighlightedPublicId(createdUser.publicId);
                setReloadToken((currentToken) => currentToken + 1);
                void message.success(`Usuario creado: ${createdUser.name}. Queda Pendiente hasta su primer acceso.`);
            })
            .catch(() => {
                setCreateError("No pudimos crear el usuario. Revisa duplicados, permisos y datos obligatorios.");
            })
            .finally(() => {
                setIsCreatingUser(false);
            });
    };

    const submitEditUser = (payload: CreateSystemUserPayload | UpdateSystemUserPayload): void => {
        if (!editingUser) {
            return;
        }

        setIsUpdatingUser(true);
        setEditError(null);
        void updateSystemUser(editingUser.publicId, payload)
            .then((updatedUser) => {
                const nextSelectedUser = mapApiUserToListItem(updatedUser);
                setSelectedUser(nextSelectedUser);
                setEditingUser(null);
                setReloadToken((currentToken) => currentToken + 1);
                void message.success(`Usuario actualizado: ${updatedUser.name}.`);
            })
            .catch((error: unknown) => {
                setEditError(getApiErrorMessage(error, "No pudimos editar el usuario. Revisa permisos, duplicados y motivo de auditoría."));
            })
            .finally(() => {
                setIsUpdatingUser(false);
            });
    };

    return (
        <ConfigProvider locale={esES} theme={PROJECTS_THEME}>
            <div className="global-home-dashboard administration-users-dashboard catalog-items-page--projects users-view">
                <div className="administration-users-main">
                    <section className="global-home-page-header administration-users-page-header" aria-labelledby="administration-users-page-title">
                        <div>
                            <nav className="administration-users-breadcrumb" aria-label="Ruta">
                                <span>Administración</span>
                                <span aria-hidden="true">/</span>
                                <span>Usuarios</span>
                            </nav>
                            <UsersPageTitle isLoading={loadState === "loading"} total={pageTotal} />
                            <p>Gestión de personas, accesos y estado operativo dentro del CRM.</p>
                        </div>
                        <UsersHeaderActions
                            isLoading={loadState === "loading"}
                            onCreate={openCreateUserDrawer}
                            onRefresh={() => {
                                setReloadToken((currentToken) => currentToken + 1);
                            }}
                        />
                    </section>

                    <section className="administration-users-panel" aria-label="Listado de usuarios" aria-busy={loadState === "loading"}>
                        {isRefreshing ? <SystemUsersRefreshStatus /> : null}

                        <SystemUsersDataTable highlightedPublicId={highlightedPublicId} loadState={loadState} selectedUserEmail={selectedUserEmail} users={users} onClearFilters={clearFilters} onEditUser={openEditUserDrawer} onOpenUser={setSelectedUser} onStatusAction={openStatusAction} onVisibleOrderChange={setVisibleOrder} />

                        <footer className="administration-users-footer">
                            <span>{getUsersRangeLabel(loadState, users.length, pageTotal)}</span>
                            {hasMore ? (
                                <Button size="small" loading={isLoadingMore} onClick={loadMore}>
                                    {getLoadMoreLabel(users.length, pageTotal)}
                                </Button>
                            ) : null}
                        </footer>
                    </section>
                </div>

                <UserDetailDrawer
                    position={selectedUserIndex + 1}
                    total={navigationUsers.length}
                    user={selectedUser}
                    onClose={() => {
                        setSelectedUser(null);
                    }}
                    onSelectNext={() => {
                        selectUserByOffset(1);
                    }}
                    onSelectPrevious={() => {
                        selectUserByOffset(-1);
                    }}
                    onStatusAction={openStatusAction}
                    onEditUser={openEditUserDrawer}
                />
                <CreateSystemUserDrawer
                    error={createError}
                    isSaving={isCreatingUser}
                    moduleOptions={createUserCatalog.moduleOptions}
                    open={isCreateUserOpen}
                    roleOptions={createUserCatalog.roleOptions}
                    rolePermissions={createUserCatalog.rolePermissions}
                    onClose={closeCreateUserDrawer}
                    onSubmit={(payload) => {
                        submitCreateUser(payload as CreateSystemUserPayload);
                    }}
                />
                <CreateSystemUserDrawer error={editError} initialUser={editingUser} isSaving={isUpdatingUser} mode="edit" moduleOptions={createUserCatalog.moduleOptions} open={editingUser !== null} roleOptions={createUserCatalog.roleOptions} rolePermissions={createUserCatalog.rolePermissions} onClose={closeEditUserDrawer} onSubmit={submitEditUser} />
                <StatusActionDialog action={pendingStatusAction} isSubmitting={isUpdatingStatus} reason={statusReason} onClose={closeStatusAction} onReasonChange={setStatusReason} onSubmit={submitStatusAction} />
            </div>
        </ConfigProvider>
    );
}
