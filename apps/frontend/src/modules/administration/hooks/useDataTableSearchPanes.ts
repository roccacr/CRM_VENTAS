/**
 * SearchPanes y persistencia local de DataTables.
 *
 * El estado guardado es preferencia de tabla (página, orden, paneles), no
 * sesión ni permisos. Si el navegador bloquea `localStorage`, la tabla sigue
 * funcionando sin recordar la vista.
 */
import type { DataTableProps } from "datatables.net-react";
import { useMemo } from "react";

type DataTableColumnDefinition = NonNullable<DataTableProps["options"]>["columnDefs"];
type DataTableLayout = NonNullable<DataTableProps["options"]>["layout"];

/** Estado opaco que DataTables serializa. El hook no interpreta sus claves. */
type DataTableState = Record<string, unknown>;

/** Clave versionada del directorio de usuarios. Cambiar la forma del estado exige subir la versión. */
export const SYSTEM_USERS_DATATABLE_STATE_KEY = "rocca.administration.users.datatable.v1";

/** Columna que sí muestra un panel de búsqueda. */
export interface DataTableSearchPaneField {
    readonly columnIndex: number;
}

/** Columnas filtrables, columnas ocultas del panel y cuántos paneles caben por fila. */
interface UseDataTableSearchPanesOptions {
    readonly disabledColumnIndexes: readonly number[];
    readonly fields: readonly DataTableSearchPaneField[];
    readonly panesPerRow?: 1 | 2 | 3 | 4;
}

/** Opciones de columnas y layout listas para pasar a DataTables. */
export interface DataTableSearchPanesConfig {
    readonly columnDefs: DataTableColumnDefinition;
    readonly layout: DataTableLayout;
}

/** Borra el estado guardado. Un storage bloqueado no debe romper la pantalla. */
export const removeDataTableState = (storageKey: string): void => {
    try {
        window.localStorage.removeItem(storageKey);
    } catch {
        // El navegador puede bloquear storage; la tabla sigue funcionando sin persistencia.
    }
};

/**
 * Lee el estado guardado.
 *
 * Un JSON inválido se borra: dejarlo haría fallar la tabla en cada visita.
 *
 * @param storageKey - Clave versionada de la tabla
 * @returns Estado previo, o `null` si no hay nada usable
 */
export const readDataTableState = (storageKey: string): DataTableState | null => {
    try {
        const storedValue = window.localStorage.getItem(storageKey);

        if (!storedValue) {
            return null;
        }

        const parsedValue = JSON.parse(storedValue) as unknown;
        return typeof parsedValue === "object" && parsedValue !== null ? (parsedValue as DataTableState) : null;
    } catch {
        removeDataTableState(storageKey);
        return null;
    }
};

/** Guarda el estado. Storage lleno o bloqueado se ignora a propósito. */
export const writeDataTableState = (storageKey: string, state: DataTableState): void => {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
        // Storage lleno o bloqueado: no debe romper la tabla.
    }
};

/** Olvida filtros y página del directorio de usuarios, por ejemplo al recargar el listado desde cero. */
export const clearSystemUsersDataTableState = (): void => {
    removeDataTableState(SYSTEM_USERS_DATATABLE_STATE_KEY);
};

/**
 * Configura SearchPanes para tablas con columnas filtrables declaradas.
 *
 * Los paneles quedan colapsados y en cascada para no ocupar la tabla hasta
 * que el usuario los abre. Las columnas de acciones no entran al panel.
 *
 * @param options - Índices filtrables, índices ocultos y paneles por fila
 * @returns `columnDefs` y `layout` estables mientras no cambien las columnas
 */
export function useDataTableSearchPanes({ disabledColumnIndexes, fields, panesPerRow = 3 }: UseDataTableSearchPanesOptions): DataTableSearchPanesConfig {
    const fieldIndexes = useMemo(() => fields.map((field) => field.columnIndex), [fields]);

    return useMemo(
        () => ({
            columnDefs: [
                { searchPanes: { show: false }, targets: disabledColumnIndexes },
                { searchPanes: { show: true }, targets: fieldIndexes },
            ] as unknown as DataTableColumnDefinition,
            layout: {
                bottomEnd: ["pageLength", "paging"],
                bottomStart: "info",
                top: {
                    searchPanes: {
                        cascadePanes: true,
                        columns: fieldIndexes,
                        initCollapsed: true,
                        layout: `columns-${String(panesPerRow)}`,
                        viewTotal: true,
                    },
                },
                top1Start: "search",
                topEnd: null,
                topStart: null,
            },
        }),
        [disabledColumnIndexes, fieldIndexes, panesPerRow],
    );
}
