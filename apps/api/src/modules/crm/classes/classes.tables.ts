/**
 * Forma física de `crm_class` y de su referencia externa.
 * `public_id_class` es la identidad del CRM. `id_old_produccion_class` solo vincula la fila vieja y puede ser nulo.
 * Borrar la clase o archivar una referencia pone fecha; no hay baja física en este contrato.
 */
import type { ColumnType, Generated } from "kysely";

/** Fecha que se lee y se escribe. A diferencia de la bitácora, estas columnas sí se actualizan. */
type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

/** Fila de la clase. El id numérico lo asigna la base. El código nativo no viene del cliente. */
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

/** Par sistema e id externo. Archivar la deja inactiva con `deleted_at`; el mismo par no puede pasar a otra clase. */
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
