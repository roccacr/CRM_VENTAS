import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

export interface CrmLocationTable {
    id_location: GeneratedNumber;
    public_id_location: string;
    native_code_location: string;
    id_old_produccion_location: number | null;
    name_location: string;
    detail_location: string | null;
    status_location: "active" | "inactive";
    created_at_location: DateTime;
    created_by_user_id_location: number | null;
    updated_at_location: DateTime;
    updated_by_user_id_location: number | null;
    inactivated_at_location: DateTime | null;
    inactivated_by_user_id_location: number | null;
    deleted_at_location: DateTime | null;
    deleted_by_user_id_location: number | null;
}

export interface CrmLocationExternalReferenceTable {
    id_location_external_reference: GeneratedNumber;
    location_id_location_external_reference: number;
    external_system_id_location_external_reference: number;
    external_id_location_external_reference: string;
    status_location_external_reference: "active" | "inactive";
    metadata_location_external_reference: string | null;
    created_at_location_external_reference: DateTime;
    updated_at_location_external_reference: DateTime;
    deleted_at_location_external_reference: DateTime | null;
}
