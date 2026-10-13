import type { ColumnType, Generated } from "kysely";

import type { UNIT_COLUMNS } from "./unit-files.columns.js";

type DateTime = ColumnType<Date, Date | string, Date | string>;
export type CrmUnitFileTable = Record<(typeof UNIT_COLUMNS)[keyof typeof UNIT_COLUMNS], string | null> & {
    id_unit_file: Generated<number>;
    public_id_unit_file: string;
    native_code_unit_file: string;
    project_id_unit_file: number;
    id_old_produccion_unit_file: number | null;
    source_project_reference_unit_file: number | null;
    created_at_unit_file: Generated<DateTime>;
    updated_at_unit_file: Generated<DateTime>;
};
export interface CrmUnitFileExternalReferenceTable {
    id_unit_file_external_reference: Generated<number>;
    unit_file_id_unit_file_external_reference: number;
    external_system_id_unit_file_external_reference: number;
    external_id_unit_file_external_reference: string;
    status_unit_file_external_reference: Generated<"active" | "inactive">;
    created_at_unit_file_external_reference: Generated<DateTime>;
    updated_at_unit_file_external_reference: Generated<DateTime>;
}
