import { useEffect, useRef, useState } from "react";

import { getSystemUsers } from "../../../services/auth/auth-service";
import type { ListSystemUsersOptions, SystemUsersSummary } from "../../../services/auth/identity-contracts";
import { EMPTY_SUMMARY, mapApiUserToListItem, normalizeSearchText, SYSTEM_USERS_PAGE_SIZE, type SystemUserFilter, type SystemUserListItem, type SystemUsersLoadState, type SystemUserSortDirection, type SystemUserSortKey } from "../system-users.model";

const SEARCH_DEBOUNCE_MS = 250;

interface SystemUsersDirectoryInput {
    readonly activeFilter: SystemUserFilter;
    readonly reloadToken: number;
    readonly searchQuery: string;
    readonly sortDirection: SystemUserSortDirection;
    readonly sortKey: SystemUserSortKey;
}

interface SystemUsersDirectoryState {
    readonly hasMore: boolean;
    readonly isLoadingMore: boolean;
    readonly loadMore: () => void;
    readonly loadState: SystemUsersLoadState;
    readonly pageTotal: number;
    readonly selectedUser: SystemUserListItem | null;
    readonly setSelectedUser: (user: SystemUserListItem | null) => void;
    readonly summary: SystemUsersSummary;
    readonly users: readonly SystemUserListItem[];
}

const buildListOptions = (input: SystemUsersDirectoryInput): ListSystemUsersOptions => {
    const query = normalizeSearchText(input.searchQuery);

    return {
        direction: input.sortDirection,
        limit: SYSTEM_USERS_PAGE_SIZE,
        ...(query ? { search: query } : {}),
        sort: input.sortKey,
        ...(input.activeFilter === "all" ? {} : { status: input.activeFilter }),
    };
};

/** Une páginas sin duplicar filas si el directorio cambió entre una consulta y otra. */
const appendUniqueUsers = (currentUsers: readonly SystemUserListItem[], nextUsers: readonly SystemUserListItem[]): readonly SystemUserListItem[] => {
    const knownIds = new Set(currentUsers.map((user) => user.publicId));

    return [...currentUsers, ...nextUsers.filter((user) => !knownIds.has(user.publicId))];
};

/**
 * Carga el directorio en el servidor, página a página con cursor.
 *
 * Solo la búsqueda espera 250 ms para no disparar una consulta por tecla;
 * estado y orden se aplican al instante y reinician la paginación. Si algo
 * cambia antes de la respuesta, la anterior se descarta. El usuario abierto
 * se conserva por `publicId`, no por la posición de la fila.
 */
export const useSystemUsersDirectory = (input: SystemUsersDirectoryInput): SystemUsersDirectoryState => {
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadState, setLoadState] = useState<SystemUsersLoadState>("loading");
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [pageTotal, setPageTotal] = useState(0);
    const [selectedUser, setSelectedUser] = useState<SystemUserListItem | null>(null);
    const [summary, setSummary] = useState<SystemUsersSummary>(EMPTY_SUMMARY);
    const [users, setUsers] = useState<readonly SystemUserListItem[]>([]);
    const lastSearchQueryRef = useRef(input.searchQuery);
    const queryVersionRef = useRef(0);

    useEffect(() => {
        const isTyping = lastSearchQueryRef.current !== input.searchQuery;
        lastSearchQueryRef.current = input.searchQuery;
        queryVersionRef.current += 1;
        let isCancelled = false;
        const timeoutId = window.setTimeout(
            () => {
                setLoadState("loading");
                void getSystemUsers(buildListOptions(input))
                    .then((response) => {
                        if (isCancelled) {
                            return;
                        }

                        const nextUsers = response.items.map(mapApiUserToListItem);
                        setUsers(nextUsers);
                        setNextCursor(response.page.nextCursor);
                        setSummary(response.summary);
                        setPageTotal(response.page.total);
                        setSelectedUser((currentUser) => {
                            if (!currentUser) {
                                return null;
                            }

                            return nextUsers.find((user) => user.publicId === currentUser.publicId) ?? null;
                        });
                        setLoadState("ready");
                    })
                    .catch(() => {
                        if (isCancelled) {
                            return;
                        }

                        setUsers([]);
                        setNextCursor(null);
                        setPageTotal(0);
                        setLoadState("error");
                    });
            },
            isTyping ? SEARCH_DEBOUNCE_MS : 0,
        );

        return () => {
            isCancelled = true;
            window.clearTimeout(timeoutId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `input` se lee completo, pero solo estos campos cambian la consulta.
    }, [input.activeFilter, input.reloadToken, input.searchQuery, input.sortDirection, input.sortKey]);

    /** Pide la página siguiente con los mismos filtros. Una respuesta de filtros viejos se descarta. */
    const loadMore = (): void => {
        if (!nextCursor || isLoadingMore) {
            return;
        }

        const requestVersion = queryVersionRef.current;
        setIsLoadingMore(true);
        void getSystemUsers({ ...buildListOptions(input), cursor: nextCursor })
            .then((response) => {
                if (requestVersion !== queryVersionRef.current) {
                    return;
                }

                setUsers((currentUsers) => appendUniqueUsers(currentUsers, response.items.map(mapApiUserToListItem)));
                setNextCursor(response.page.nextCursor);
                setSummary(response.summary);
                setPageTotal(response.page.total);
            })
            .catch(() => undefined)
            .finally(() => {
                setIsLoadingMore(false);
            });
    };

    return {
        hasMore: nextCursor !== null,
        isLoadingMore,
        loadMore,
        loadState,
        pageTotal,
        selectedUser,
        setSelectedUser,
        summary,
        users,
    };
};
