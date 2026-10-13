import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

export interface CrmClassTable {
    id_class: GeneratedNumber;
    public_id_class: string;
    native_code_class: string;
    id_old_produccion_class: number | null;
    name_class: string;
    detail_class: string | null;
    status_class: "active" | "inactive";
    created_at_class: DateTime;
    created_by_user_id_class: number | null;
    updated_at_class: DateTime;
    updated_by_user_id_class: number | null;
    inactivated_at_class: DateTime | null;
    inactivated_by_user_id_class: number | null;
    deleted_at_class: DateTime | null;
    deleted_by_user_id_class: number | null;
}

export interface CrmClassExternalReferenceTable {
    id_class_external_reference: GeneratedNumber;
    class_id_class_external_reference: number;
    external_system_id_class_external_reference: number;
    external_id_class_external_reference: string;
    status_class_external_reference: "active" | "inactive";
    metadata_class_external_reference: string | null;
    created_at_class_external_reference: DateTime;
    updated_at_class_external_reference: DateTime;
    deleted_at_class_external_reference: DateTime | null;
}
