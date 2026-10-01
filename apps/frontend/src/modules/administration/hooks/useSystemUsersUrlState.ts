import { useEffect, useState } from "react";

import { parseSystemUserFilter, type SystemUserFilter } from "../system-users.model";

const STATUS_PARAM = "estado";
const SEARCH_PARAM = "q";

interface SystemUsersUrlState {
    readonly activeFilter: SystemUserFilter;
    readonly searchQuery: string;
    readonly setActiveFilter: (filter: SystemUserFilter) => void;
    readonly setSearchQuery: (query: string) => void;
}

const readSearchParams = (): URLSearchParams => new URLSearchParams(window.location.search);

const writeSearchParams = (activeFilter: SystemUserFilter, searchQuery: string): void => {
    const params = readSearchParams();

    if (activeFilter === "all") {
        params.delete(STATUS_PARAM);
    } else {
        params.set(STATUS_PARAM, activeFilter);
    }

    if (searchQuery.trim()) {
        params.set(SEARCH_PARAM, searchQuery);
    } else {
        params.delete(SEARCH_PARAM);
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;

    if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.history.replaceState(window.history.state, "", nextUrl);
    }
};

/**
 * Estado y búsqueda del directorio reflejados en la URL.
 *
 * Usa `replaceState` para no llenar el historial con cada tecla. Escribe en una
 * microtarea porque `App` limpia la query de la ruta en su propio efecto, que
 * corre después de los efectos de esta pantalla al montarla.
 */
export const useSystemUsersUrlState = (): SystemUsersUrlState => {
    const [activeFilter, setActiveFilter] = useState<SystemUserFilter>(() => parseSystemUserFilter(readSearchParams().get(STATUS_PARAM)));
    const [searchQuery, setSearchQuery] = useState(() => readSearchParams().get(SEARCH_PARAM) ?? "");

    useEffect(() => {
        queueMicrotask(() => {
            writeSearchParams(activeFilter, searchQuery);
        });
    }, [activeFilter, searchQuery]);

    return { activeFilter, searchQuery, setActiveFilter, setSearchQuery };
};
