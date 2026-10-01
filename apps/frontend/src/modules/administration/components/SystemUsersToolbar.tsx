import ColumnHeightOutlined from "@ant-design/icons/ColumnHeightOutlined";
import FilterOutlined from "@ant-design/icons/FilterOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import Button from "antd/es/button";
import Input from "antd/es/input";
import Tooltip from "antd/es/tooltip";

import type { SystemUsersSummary } from "../../../services/auth/identity-contracts";
import { getActiveToolbarFilterCount, getDensityLabel, type SystemUserDensity, type SystemUserFilter } from "../system-users.model";
import { SystemUsersStatusFilter } from "./SystemUsersStatusFilter";

interface SystemUsersToolbarProps {
    readonly activeFilter: SystemUserFilter;
    readonly density: SystemUserDensity;
    readonly onClearSelection: () => void;
    readonly onFilterChange: (filter: SystemUserFilter) => void;
    readonly onSearchChange: (query: string) => void;
    readonly onToggleDensity: () => void;
    readonly searchQuery: string;
    readonly selectedCount: number;
    readonly summary: SystemUsersSummary;
}

function SystemUsersBulkBar({ count, onClear }: { readonly count: number; readonly onClear: () => void }) {
    return (
        <div className="administration-users-bulkbar" role="status">
            <strong>{count} usuarios seleccionados</strong>
            <Button size="small">Cambiar área</Button>
            <Button size="small">Desactivar</Button>
            <Button size="small">Exportar seleccionados</Button>
            <Button size="small" type="link" onClick={onClear}>
                Limpiar selección
            </Button>
        </div>
    );
}

/**
 * Encabezado de la tabla en dos niveles.
 *
 * Arriba, el estado como control segmentado. Abajo, búsqueda, filtros y
 * densidad; con filas seleccionadas esa línea pasa a acciones masivas sin
 * perder el filtro de estado.
 */
export function SystemUsersToolbar({ activeFilter, density, onClearSelection, onFilterChange, onSearchChange, onToggleDensity, searchQuery, selectedCount, summary }: SystemUsersToolbarProps) {
    const activeFilterCount = getActiveToolbarFilterCount(activeFilter, searchQuery);

    return (
        <div className="administration-users-toolbar">
            <div className="administration-users-toolbar__status">
                <SystemUsersStatusFilter activeFilter={activeFilter} summary={summary} onChange={onFilterChange} />
            </div>
            {selectedCount > 0 ? (
                <SystemUsersBulkBar count={selectedCount} onClear={onClearSelection} />
            ) : (
                <div className="administration-users-toolbar__query">
                    <Input
                        className="administration-users-search"
                        allowClear
                        type="search"
                        aria-label="Buscar usuarios"
                        prefix={<SearchOutlined aria-hidden="true" />}
                        placeholder="Buscar usuarios"
                        value={searchQuery}
                        onChange={(event) => {
                            onSearchChange(event.target.value);
                        }}
                    />
                    <Button icon={<FilterOutlined aria-hidden="true" />}>{activeFilterCount > 0 ? `Filtros · ${String(activeFilterCount)}` : "Filtros"}</Button>
                    <Tooltip title={`Densidad: ${getDensityLabel(density).toLowerCase()}`}>
                        <Button className="administration-users-toolbar__density" icon={<ColumnHeightOutlined aria-hidden="true" />} aria-pressed={density === "compact"} aria-label={`Vista de tabla: densidad ${getDensityLabel(density).toLowerCase()}`} onClick={onToggleDensity} />
                    </Tooltip>
                </div>
            )}
        </div>
    );
}
