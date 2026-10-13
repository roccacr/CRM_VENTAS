import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

export interface CrmBrokerTable {
    id_broker: GeneratedNumber;
    public_id_broker: string;
    native_code_broker: string;
    id_old_produccion_broker: number | null;
    name_broker: string;
    detail_broker: string | null;
    status_broker: "active" | "inactive";
    created_at_broker: DateTime;
    created_by_user_id_broker: number | null;
    updated_at_broker: DateTime;
    updated_by_user_id_broker: number | null;
    inactivated_at_broker: DateTime | null;
    inactivated_by_user_id_broker: number | null;
    deleted_at_broker: DateTime | null;
    deleted_by_user_id_broker: number | null;
}

export interface CrmBrokerExternalReferenceTable {
    id_broker_external_reference: GeneratedNumber;
    broker_id_broker_external_reference: number;
    external_system_id_broker_external_reference: number;
    external_id_broker_external_reference: string;
    status_broker_external_reference: "active" | "inactive";
    metadata_broker_external_reference: string | null;
    created_at_broker_external_reference: DateTime;
    updated_at_broker_external_reference: DateTime;
    deleted_at_broker_external_reference: DateTime | null;
}
