import { getDatabaseOrder } from "./database-order-service";
import type { NetsuiteOrderIdentity } from "./netsuite-order-service";

export interface OrderUnitDetail {
    readonly groups: readonly { readonly title: string; readonly fields: readonly { readonly label: string; readonly value: string; readonly kind?: "expediente" }[] }[];
    readonly warnings: readonly string[];
}
type Mapping = readonly [label: string, native: string, legacy: string];
// Explicit equivalents of the authorized snapshot allowlists. IDs remain references, never names.
const groups: readonly { title: string; fields: readonly Mapping[] }[] = [
    {
        title: "Unidad",
        fields: [
            ["Código", "code_unit_file", "codigo_exp"],
            ["Proyecto", "project_name_snapshot_unit_file", "proyectoPrincipal_exp"],
            ["Tipo de vivienda", "housing_type_unit_file", "tipoDeVivienda_exp"],
            ["Estado en origen (sin equivalencia confirmada)", "source_status_unit_file", "estado_exp"],
            ["Entrega estimada", "estimated_delivery_unit_file", "entregaEstimada"],
        ],
    },
    {
        title: "Áreas",
        fields: [
            ["Área del lote (unidad no informada)", "lot_area_unit_file", "loteM2_exp"],
            ["Área habitable (unidad no informada)", "habitable_area_unit_file", "m2Habitables_exp"],
            ["Área total (unidad no informada)", "total_area_unit_file", "areaTotalM2_exp"],
            ["Área de bodega (unidad no informada)", "storage_area_unit_file", "areaDeBodegaM2_exp"],
            ["Área de mezzanine (unidad no informada)", "mezzanine_area_unit_file", "areaDeMezzanieM2_exp"],
            ["Área de balcón (unidad no informada)", "balcony_area_unit_file", "areaDeBalconM2_exp"],
            ["Área de planta baja (unidad no informada)", "ground_floor_area_unit_file", "areaDePlantaBaja_exp"],
            ["Área de planta alta (unidad no informada)", "upper_floor_area_unit_file", "areaDePlantaAlta_exp"],
            ["Área de ampliación (unidad no informada)", "extension_area_unit_file", "areaDeAmpliacion_exp"],
            ["Área de terraza (unidad no informada)", "terrace_area_unit_file", "areaDeTerraza_exp"],
            ["Área de tercer nivel / sótano (unidad no informada)", "third_level_basement_area_unit_file", "tercerNivelSotano_exp"],
            ["Área aproximada de parqueo (unidad no informada)", "approximate_parking_area_unit_file", "areaDeParqueoAprox"],
            ["Área externa de jardín (unidad no informada)", "external_garden_area_unit_file", "areaExternaJardin_exp"],
            ["Jardín con talud (unidad no informada)", "sloped_garden_area_unit_file", "jardinConTalud_exp"],
            ["Área común libre (unidad no informada)", "open_common_area_unit_file", "areacomunLibe_exp"],
        ],
    },
    {
        title: "Precios y mantenimiento",
        fields: [
            ["Precio de venta anunciado (moneda no informada)", "advertised_sale_price_unit_file", "precioVentaUncio_exp"],
            ["Precio de venta mínimo (moneda no informada)", "minimum_sale_price_unit_file", "precioDeVentaMinimo"],
            ["Cuota aproximada de mantenimiento (moneda no informada)", "approximate_maintenance_fee_unit_file", "cuotaMantenimientoAprox_exp"],
            ["Precio por metro cuadrado (moneda no informada)", "price_per_square_meter_unit_file", "precioPorM2_exp"],
        ],
    },
    { title: "Planos", fields: [["Planos de la unidad (referencia de origen)", "unit_plans_unit_file", "planosDeUnidad_exp"]] },
    {
        title: "Referencias y fechas",
        fields: [
            ["Identificador del expediente", "public_id_unit_file", "id_expediente"],
            ["Referencia interna del expediente", "id_unit_file", "ID_interno_expediente"],
            ["Código nativo", "native_code_unit_file", ""],
            ["Referencia de proyecto", "project_id_unit_file", "idProyectoPrincipal_exp"],
            ["Referencia de proyecto en origen", "source_project_reference_unit_file", ""],
            ["Referencia histórica del expediente", "id_old_produccion_unit_file", ""],
            ["Modificado en origen", "modified_at_unit_file", "fecha_mod"],
            ["Valor de sincronización en origen", "cron_value_unit_file", "cron_value"],
            ["Creado", "created_at_unit_file", ""],
            ["Actualizado", "updated_at_unit_file", ""],
        ],
    },
];
function text(value: unknown): string {
    if (typeof value === "string") return value.trim() ? value : "Sin dato";
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return "Sin dato";
}
/** Fresh authorized read only. Preserve source precision; no currency, status or area conversion is inferred. */
export async function getOrderUnitDetail(identity: NetsuiteOrderIdentity): Promise<OrderUnitDetail> {
    const data = await getDatabaseOrder(identity);
    const warnings = data.warnings.filter((warning) => warning.startsWith("unitFile:"));
    if (!data.unitFile || warnings.length) return { groups: [], warnings: warnings.length ? warnings : ["unitFile:missing"] };
    const raw: unknown = data.unitFile.sourceFields;
    const fields = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const origin = data.source === "native" ? 1 : 2;
    return {
        warnings,
        groups: groups.map((group) => ({
            title: group.title,
            fields: group.fields
                .filter((field) => field[origin] !== "")
                .map((field) => {
                    let value = text(fields[field[origin]]);
                    if (field[0] === "Código" && value === "Sin dato") value = text(data.unitFile?.code);
                    return { label: field[0], value, ...(field[1] === "unit_plans_unit_file" ? { kind: "expediente" as const } : {}) };
                }),
        })),
    };
}
