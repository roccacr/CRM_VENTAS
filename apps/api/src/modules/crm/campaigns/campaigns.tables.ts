/**
 * Forma física de `crm_campaign` y de su referencia externa.
 * `public_id_campaign` es la identidad del CRM. `id_old_produccion_campaign` solo vincula la fila vieja y puede ser nulo.
 * Borrar la campaña o archivar una referencia pone fecha; no hay baja física en este contrato.
 */
import type { ColumnType, Generated } from "kysely";

/** Fecha que se lee y se escribe. A diferencia de la bitácora, estas columnas sí se actualizan. */
type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

/** Fila de la campaña. El id numérico lo asigna la base. El código nativo no viene del cliente. */
export interface CrmCampaignTable {
    id_campaign: GeneratedNumber;
    public_id_campaign: string;
    native_code_campaign: string;
    id_old_produccion_campaign: number | null;
    name_campaign: string;
    detail_campaign: string | null;
    status_campaign: "active" | "inactive";
    created_at_campaign: DateTime;
    created_by_user_id_campaign: number | null;
    updated_at_campaign: DateTime;
    updated_by_user_id_campaign: number | null;
    inactivated_at_campaign: DateTime | null;
    inactivated_by_user_id_campaign: number | null;
    deleted_at_campaign: DateTime | null;
    deleted_by_user_id_campaign: number | null;
}

/** Par sistema e id externo. Archivar la deja inactiva con `deleted_at`; el mismo par no puede pasar a otra campaña. */
export interface CrmCampaignExternalReferenceTable {
    id_campaign_external_reference: GeneratedNumber;
    campaign_id_campaign_external_reference: number;
    external_system_id_campaign_external_reference: number;
    external_id_campaign_external_reference: string;
    status_campaign_external_reference: "active" | "inactive";
    metadata_campaign_external_reference: string | null;
    created_at_campaign_external_reference: DateTime;
    updated_at_campaign_external_reference: DateTime;
    deleted_at_campaign_external_reference: DateTime | null;
}
