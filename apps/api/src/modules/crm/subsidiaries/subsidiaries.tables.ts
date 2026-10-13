import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

export interface CrmSubsidiaryTable {
    id_subsidiary: GeneratedNumber;
    public_id_subsidiary: string;
    native_code_subsidiary: string;
    id_old_produccion_subsidiary: number | null;
    name_subsidiary: string;
    detail_subsidiary: string | null;
    status_subsidiary: "active" | "inactive";
    created_at_subsidiary: DateTime;
    created_by_user_id_subsidiary: number | null;
    updated_at_subsidiary: DateTime;
    updated_by_user_id_subsidiary: number | null;
    inactivated_at_subsidiary: DateTime | null;
    inactivated_by_user_id_subsidiary: number | null;
    deleted_at_subsidiary: DateTime | null;
    deleted_by_user_id_subsidiary: number | null;
}

export interface CrmSubsidiaryExternalReferenceTable {
    id_subsidiary_external_reference: GeneratedNumber;
    subsidiary_id_subsidiary_external_reference: number;
    external_system_id_subsidiary_external_reference: number;
    external_id_subsidiary_external_reference: string;
    status_subsidiary_external_reference: "active" | "inactive";
    metadata_subsidiary_external_reference: string | null;
    created_at_subsidiary_external_reference: DateTime;
    updated_at_subsidiary_external_reference: DateTime;
    deleted_at_subsidiary_external_reference: DateTime | null;
}
