import { type RawBuilder, sql } from "kysely";

/** La bitácora existente acredita que la rama comenzó, incluso si el ERP desmarca posteriormente la caída.
 * No depende de columnas nuevas: los otros banners conservan compatibilidad antes de instalar 076.
 */
export function outsideFiniquito(source: "native" | "legacy" | RawBuilder<unknown>, id: RawBuilder<unknown>) {
    return sql`NOT EXISTS(SELECT 1 FROM CRM_THINK_V2.audit_record fin_record JOIN CRM_THINK_V2.audit_record_event fin_event ON fin_event.record_id_record_event=fin_record.id_record
        WHERE ${finiquitoAuditIdentity(source, id, "fin_record")}
            AND fin_event.module_record_event='formalizacion.finiquito')`;
}

/** Misma identidad lógica que auditSource: una nativa promovida conserva el registro canónico legacy. */
export function finiquitoAuditIdentity(source: "native" | "legacy" | RawBuilder<unknown>, id: RawBuilder<unknown>, recordAlias: string) {
    const native = typeof source === "string" ? (source === "native" ? sql`TRUE` : sql`FALSE`) : sql`${source}='native'`;
    const alias = sql`CASE WHEN ${native} THEN (SELECT fin_parent.id_old_produccion_sales_order FROM CRM_THINK_V2.crm_sales_order fin_parent WHERE fin_parent.id_sales_order=${id}) ELSE NULL END`;
    const legacy = sql`(NOT ${native} OR ${alias} IS NOT NULL)`;
    return sql`${sql.ref(recordAlias + ".source_schema_record")}=IF(${legacy},'crmdatabase-api','CRM_THINK_V2')
        AND ${sql.ref(recordAlias + ".source_table_record")}=IF(${legacy},'ordenventa','crm_sales_order')
        AND ${sql.ref(recordAlias + ".source_id_record")}=CAST(COALESCE(${alias},${id}) AS CHAR)`;
}
