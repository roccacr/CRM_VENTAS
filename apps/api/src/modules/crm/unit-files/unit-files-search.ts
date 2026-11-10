import { sql } from "kysely";

import type { UnitFacetKind, UnitFilter } from "./unit-files.contract.js";

/**
 * Dentro de un panel los valores son un OR. Entre paneles, un AND.
 * Al calcular un panel se omite su propia selección secundaria, para que las opciones en cascada sigan viendo el resto.
 * `LOCATE` deja `%` y `_` como texto.
 */
export function unitFileCriteria(filter: UnitFilter, fields: Record<UnitFacetKind, string>, omit?: UnitFacetKind) {
    const clauses = [];
    for (const key of ["status", "housingType", "code"] as const) {
        if (filter[key]) clauses.push(sql`AND ${sql.ref(fields[key])}=${filter[key]}`);
    }
    if (filter.codeMatch) clauses.push(sql`AND LOCATE(LOWER(${filter.codeMatch}),LOWER(${sql.ref(fields.code)}))>0`);
    const panes = { code: filter.codes, housingType: filter.housingTypes, status: filter.statuses, projectIds: filter.paneProjectIds };
    for (const key of Object.keys(panes) as UnitFacetKind[]) {
        const values = panes[key];
        if (key !== omit && values?.length) clauses.push(sql`AND COALESCE(${sql.ref(fields[key])},'') IN (${sql.join(values)})`);
    }
    return sql.join(clauses, sql` `);
}
