import Segmented from "antd/es/segmented";

import type { SystemUsersSummary } from "../../../services/auth/identity-contracts";
import { FILTERS, getFilterCount, type SystemUserFilter } from "../system-users.model";

interface SystemUsersStatusFilterProps {
    readonly activeFilter: SystemUserFilter;
    readonly onChange: (filter: SystemUserFilter) => void;
    readonly summary: SystemUsersSummary;
}

/**
 * Filtro por estado: un solo control segmentado sobre la tabla.
 *
 * El conteo va como texto junto a la etiqueta, sin cápsulas. Un estado sin
 * usuarios sigue disponible para confirmar que está vacío.
 */
export function SystemUsersStatusFilter({ activeFilter, onChange, summary }: SystemUsersStatusFilterProps) {
    return (
        <Segmented<SystemUserFilter>
            className="administration-users-status-filter"
            aria-label="Filtrar por estado"
            value={activeFilter}
            onChange={onChange}
            options={FILTERS.map((filter) => {
                const count = getFilterCount(summary, filter.key);

                return {
                    label: (
                        <span className={count === 0 ? "administration-users-status-filter__option administration-users-status-filter__option--empty" : "administration-users-status-filter__option"}>
                            {filter.label}
                            <span className="administration-users-status-filter__count">{count}</span>
                        </span>
                    ),
                    value: filter.key,
                };
            })}
        />
    );
}
