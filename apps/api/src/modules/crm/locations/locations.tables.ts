/**
 * Forma física de `crm_location` y de su referencia externa.
 * `public_id_location` es la identidad del CRM. `id_old_produccion_location` solo vincula la fila vieja y puede ser nulo.
 * Borrar la ubicación o archivar una referencia pone fecha; no hay baja física en este contrato.
 */
import type { ColumnType, Generated } from "kysely";

/** Fecha que se lee y se escribe. A diferencia de la bitácora, estas columnas sí se actualizan. */
type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

/** Fila de la ubicación. El id numérico lo asigna la base. El código nativo no viene del cliente. */
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

/** Par sistema e id externo. Archivar la deja inactiva con `deleted_at`; el mismo par no puede pasar a otra ubicación. */
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
