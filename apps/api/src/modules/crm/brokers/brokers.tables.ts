/**
 * Forma física de `crm_broker` y de su referencia externa.
 * `public_id_broker` es la identidad del CRM. `id_old_produccion_broker` solo vincula la fila vieja y puede ser nulo.
 * Borrar el corredor o archivar una referencia pone fecha; no hay baja física en este contrato.
 */
import type { ColumnType, Generated } from "kysely";

/** Fecha que se lee y se escribe. A diferencia de la bitácora, estas columnas sí se actualizan. */
type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

/** Fila del corredor. El id numérico lo asigna la base. El código nativo no viene del cliente. */
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

/** Par sistema e id externo. Archivar la deja inactiva con `deleted_at`; el mismo par no puede pasar a otro corredor. */
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
