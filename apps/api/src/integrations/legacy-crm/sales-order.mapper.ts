import { z } from "zod";

const legacyRecordSchema = z.record(z.string(), z.unknown());
const flag = (value: unknown): "yes" | "no" | "unknown" => {
    if (value === 1 || value === "1") return "yes";
    if (value === 0 || value === "0") return "no";
    return "unknown";
};
const approval = (value: unknown) => (({ yes: "approved", no: "not_approved", unknown: "unknown" }) as const)[flag(value)];
const money = (value: unknown): string | null => {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const text = String(value).trim();
    return /^-?\d{1,15}(\.\d{1,4})?$/.test(text) ? text : null;
};
const dateOnly = (value: unknown): string | null => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
};

const externalReferences = (row: Record<string, unknown>) => {
    const id = row.id_ov_netsuite;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return [];
    return [{ systemCode: "netsuite", externalId: String(id), transactionNumber: typeof row.id_ov_tranid === "string" ? row.id_ov_tranid : null }];
};

/** Converts a legacy observation to one neutral JSON. No provider calls or inferred past events. */
export function mapLegacySalesOrder(input: unknown, observedAt: string) {
    const row = legacyRecordSchema.parse(input);
    const legacyId = z.number().int().positive().parse(row.id_ov);
    z.iso.datetime().parse(observedAt);
    const status = ({ yes: "active", no: "inactive", unknown: "unknown" } as const)[flag(row.status_ov)];
    const cancelled = flag(row.caida_ov);
    const approvals = { sales_management: approval(row.chekJefeVenta), developer: approval(row.aprobacion__rdr_ov), formalization: approval(row.aprobacion_forma_ov) };
    const pending = status === "active" && cancelled === "no" && approvals.sales_management === "approved" && approvals.developer === "approved" && approvals.formalization === "not_approved";
    return {
        schemaVersion: 1 as const,
        identity: { legacyId, nativeCode: `LEGACY-OV-${String(legacyId)}` },
        externalReferences: externalReferences(row),
        commercial: {
            status,
            cancelled,
            transactionDate: dateOnly(row.trandate_ov),
            currencyCode: null,
            listPrice: money(row.pre_lista_ov),
            netSalePrice: money(row.prec_ventaneto_ov),
            salePrice: money(row.prec_venta_ov),
            advisorCommission: money(row.comison_asesor_ov),
            contractSigned: flag(row.contrado_frima_ov),
            commercialClosureSigned: flag(row.cierre_firmado_ov),
            advisorCommissionCalculated: flag(row.calculo_comision_asesor_ov),
            advisorCommissionPaid: flag(row.comision_cancelada_ov),
        },
        approvals,
        observedState: { code: pending ? ("pending_approval" as const) : ("unclassified" as const), effectiveAt: null, actor: null },
        provenance: { systemCode: "legacy_crm", sourceRecordId: String(legacyId), observedAt, originalRecord: row },
    };
}
