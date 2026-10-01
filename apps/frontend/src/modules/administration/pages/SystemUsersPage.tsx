import "./SystemUsersPage.css";

import ExportOutlined from "@ant-design/icons/ExportOutlined";
import UserAddOutlined from "@ant-design/icons/UserAddOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import message from "antd/es/message";
import { useEffect, useState } from "react";

import { createSystemUser } from "../../../services/auth/auth-service";
import type { CreateSystemUserPayload } from "../../../services/auth/identity-contracts";
import { ADMINISTRATION_THEME } from "../administration-theme";
import { CreateSystemUserDrawer } from "../components/CreateSystemUserDrawer";
import { SystemUsersTable } from "../components/SystemUsersTable";
import { SystemUsersToolbar } from "../components/SystemUsersToolbar";
import { UserDetailDrawer } from "../components/UserDetailDrawer";
import { useCreateUserCatalog } from "../hooks/useCreateUserCatalog";
import { useSystemUsersDirectory } from "../hooks/useSystemUsersDirectory";
import { useSystemUsersUrlState } from "../hooks/useSystemUsersUrlState";
import { getExportUsersLabel, getLoadMoreLabel, getNextDensity, getUserAtOffset, getUsersRangeLabel, type SystemUserDensity, type SystemUserSortDirection, type SystemUserSortKey } from "../system-users.model";

/** Tiempo que la fila recién creada queda resaltada en la tabla. */
const NEW_USER_HIGHLIGHT_MS = 6000;

function SystemUsersRefreshStatus() {
    return (
        <div className="administration-users-refresh-status" role="status" aria-live="polite">
            <span className="administration-users-refresh-status__dot" aria-hidden="true" />
            <strong>Actualizando usuarios...</strong>
        </div>
    );
}

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
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [density, setDensity] = useState<SystemUserDensity>("comfortable");
    const [highlightedPublicId, setHighlightedPublicId] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [selectedEmails, setSelectedEmails] = useState<readonly string[]>([]);
    const [sortDirection, setSortDirection] = useState<SystemUserSortDirection>("asc");
    const [sortKey, setSortKey] = useState<SystemUserSortKey>("name");
    const createUserCatalog = useCreateUserCatalog();
    const { hasMore, isLoadingMore, loadMore, loadState, pageTotal, selectedUser, setSelectedUser, summary, users } = useSystemUsersDirectory({ activeFilter, reloadToken, searchQuery, sortDirection, sortKey });

    const isRefreshing = loadState === "loading" && users.length > 0;
    const visibleUserEmails = new Set(users.map((user) => user.email));
    const visibleSelectedEmails = selectedEmails.filter((email) => visibleUserEmails.has(email));
    const selectedUserEmail = selectedUser?.email ?? null;
    const selectedUserIndex = users.findIndex((user) => user.email === selectedUserEmail);

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

    const handleSortChange = (nextSortKey: SystemUserSortKey, nextDirection: SystemUserSortDirection): void => {
        setSortKey(nextSortKey);
        setSortDirection(nextDirection);
    };

    const selectUserByOffset = (offset: -1 | 1): void => {
        const nextUser = getUserAtOffset(users, selectedUserIndex, offset);

        if (nextUser) {
            setSelectedUser(nextUser);
        }
    };

    const clearFilters = (): void => {
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

    /** Al crear, vuelve a la vista base y resalta la fila nueva para confirmar el alta sin recargar la página. */
    const submitCreateUser = (payload: CreateSystemUserPayload): void => {
        setIsCreatingUser(true);
        setCreateError(null);
        void createSystemUser(payload)
            .then((createdUser) => {
                setSelectedUser(null);
                setSelectedEmails([]);
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

    return (
        <ConfigProvider locale={esES} theme={ADMINISTRATION_THEME}>
            <div className="global-home-dashboard administration-users-dashboard">
                <div className="administration-users-main">
                    <section className="global-home-page-header administration-users-page-header" aria-labelledby="administration-users-page-title">
                        <h1 id="administration-users-page-title">Usuarios</h1>
                        <div className="global-home-page-header__actions">
                            <button type="button" aria-label={getExportUsersLabel(users.length)}>
                                <ExportOutlined />
                                Exportar
                            </button>
                            <button className="global-home-page-header__primary" type="button" aria-label="Nuevo usuario" onClick={openCreateUserDrawer}>
                                <UserAddOutlined />
                                Nuevo usuario
                            </button>
                        </div>
                    </section>

                    <section className="administration-users-panel" aria-label="Listado de usuarios" aria-busy={loadState === "loading"}>
                        <SystemUsersToolbar
                            activeFilter={activeFilter}
                            density={density}
                            searchQuery={searchQuery}
                            selectedCount={visibleSelectedEmails.length}
                            summary={summary}
                            onClearSelection={() => {
                                setSelectedEmails([]);
                            }}
                            onFilterChange={setActiveFilter}
                            onSearchChange={setSearchQuery}
                            onToggleDensity={() => {
                                setDensity(getNextDensity);
                            }}
                        />

                        {isRefreshing ? <SystemUsersRefreshStatus /> : null}

                        <SystemUsersTable density={density} highlightedPublicId={highlightedPublicId} loadState={loadState} selectedEmails={selectedEmails} selectedUserEmail={selectedUserEmail} sortDirection={sortDirection} sortKey={sortKey} users={users} onClearFilters={clearFilters} onOpenUser={setSelectedUser} onSelectionChange={setSelectedEmails} onSortChange={handleSortChange} />

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
                    total={users.length}
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
                />
                <CreateSystemUserDrawer error={createError} isSaving={isCreatingUser} moduleOptions={createUserCatalog.moduleOptions} open={isCreateUserOpen} roleOptions={createUserCatalog.roleOptions} rolePermissions={createUserCatalog.rolePermissions} onClose={closeCreateUserDrawer} onSubmit={submitCreateUser} />
            </div>
        </ConfigProvider>
    );
}
