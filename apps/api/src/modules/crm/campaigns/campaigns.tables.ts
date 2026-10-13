import type { ColumnType, Generated } from "kysely";

type DateTime = ColumnType<Date, Date | string, Date | string>;
type GeneratedNumber = Generated<number>;

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
