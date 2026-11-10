/**
 * Filtro y búsqueda del directorio reflejados en la URL.
 *
 * Usa `replaceState` para no llenar el historial con cada tecla. Escribe en
 * una microtarea para agrupar la actualizacion despues del montaje.
 */
import { useEffect, useState } from "react";

import { parseSystemUserFilter, type SystemUserFilter } from "../system-users.model";

const STATUS_PARAM = "estado";
const SEARCH_PARAM = "q";

/** Filtro y búsqueda del directorio reflejados en la URL para poder compartir o recargar la vista. */
interface SystemUsersUrlState {
    readonly activeFilter: SystemUserFilter;
    readonly searchQuery: string;
    readonly setActiveFilter: (filter: SystemUserFilter) => void;
    readonly setSearchQuery: (query: string) => void;
}

/** Parámetros actuales de la URL. */
const readSearchParams = (): URLSearchParams => new URLSearchParams(window.location.search);

/** Escribe filtro y búsqueda en la URL sin recargar la página. */
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
 * microtarea para aplicar juntos los filtros resueltos al montar la pantalla.
 * Todos quita `estado` y una búsqueda vacía quita `q`. El hash se conserva.
 * Un estado desconocido en la URL vuelve a Todos.
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
