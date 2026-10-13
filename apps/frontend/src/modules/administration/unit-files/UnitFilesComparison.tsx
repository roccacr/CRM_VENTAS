import "./UnitFilesComparison.css";

import ArrowDownOutlined from "@ant-design/icons/ArrowDownOutlined";
import ArrowUpOutlined from "@ant-design/icons/ArrowUpOutlined";
import MinusOutlined from "@ant-design/icons/MinusOutlined";
import Select from "antd/es/select";
import Switch from "antd/es/switch";
import { useState } from "react";

import type { UnitDetail } from "./unit-files.api";

const KEY_FIELDS = ["advertisedSalePrice", "totalArea", "lotArea", "approximateParkingArea"];
const COST_FIELDS = new Set(["advertisedSalePrice", "minimumSalePrice", "pricePerSquareMeter", "approximateMaintenanceFee"]);
const NUMERIC_FIELDS = new Set([...KEY_FIELDS, "minimumSalePrice", "pricePerSquareMeter", "approximateMaintenanceFee", "habitableArea", "storageArea", "mezzanineArea", "balconyArea", "groundFloorArea", "upperFloorArea", "extensionArea", "terraceArea", "thirdLevelBasementArea", "externalGardenArea", "slopedGardenArea", "openCommonArea"]);
const numberFormat = new Intl.NumberFormat("es-CR", { maximumFractionDigits: 6 });

// Source amounts use dot decimals and optional thousands commas. Do not guess other formats.
function amount(value: string | null | undefined): number | null {
    if (!value || !/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim())) return null;
    const parsed = Number(value.trim().replaceAll(",", ""));
    return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER ? parsed : null;
}

/** Visual comparison is presentation-only: source values and API contracts remain untouched. */
export function UnitFilesComparison({ items, labels, groups }: { readonly items: UnitDetail[]; readonly labels: Record<string, string>; readonly groups: readonly { title: string; fields: readonly string[] }[] }) {
    const [referenceId, setReferenceId] = useState(items[0]?.id);
    const [differencesOnly, setDifferencesOnly] = useState(false);
    const reference = items.find((item) => item.id === referenceId) ?? items[0];
    const sections = [{ title: "Indicadores principales", fields: KEY_FIELDS.filter((key) => key in labels) }, ...groups.map((group) => ({ ...group, fields: group.fields.filter((key) => !KEY_FIELDS.includes(key)) }))];
    return (
        <div className="unit-comparison">
            <div className="unit-comparison-toolbar">
                <span className="unit-comparison-count">{items.length} unidades</span>
                <label>
                    Unidad de referencia
                    <Select aria-label="Unidad de referencia" value={reference?.id} onChange={setReferenceId} options={items.map((item) => ({ value: item.id, label: item.code || item.id }))} />
                </label>
                <label className="unit-comparison-toggle">
                    <Switch aria-label="Solo diferencias" checked={differencesOnly} onChange={setDifferencesOnly} />
                    Solo diferencias
                </label>
            </div>
            <div className="unit-comparison-scroll" tabIndex={0} role="region" aria-label="Comparación de unidades">
                <table style={{ width: `max(100%, calc(var(--comparison-field-width) + ${String(items.length * 230)}px))` }}>
                    <caption className="unit-comparison-caption">Menor precio y costo; mayor área: mejor valor por campo. Verde: mejor · Amarillo: intermedio · Rojo: menos favorable. Flechas: dirección numérica. Diferencias respecto a {reference?.code || "la unidad de referencia"}.</caption>
                    <colgroup>
                        <col className="unit-comparison-field-column" />
                        {items.map((item) => (
                            <col key={item.id} style={{ width: 230 }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th scope="col">Características</th>
                            {items.map((item) => (
                                <th scope="col" key={item.id} data-reference={item.id === reference?.id}>
                                    <strong>{item.code || "Sin asignar"}</strong>
                                    <span>{item.project.name}</span>
                                    <small>{item.id === reference?.id ? "Referencia" : item.sourceStatus || "Sin asignar"}</small>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    {sections.map((section) => {
                        const visible = section.fields.filter((key) => !differencesOnly || new Set(items.map((item) => item.values[key] || null)).size > 1);
                        if (!visible.length) return null;
                        return (
                            <tbody key={section.title}>
                                <tr className="unit-comparison-section">
                                    <th colSpan={items.length + 1} scope="colgroup">
                                        {section.title}
                                    </th>
                                </tr>
                                {visible.map((key) => {
                                    const numeric = NUMERIC_FIELDS.has(key);
                                    const values = items.map((item) => (numeric ? amount(item.values[key]) : null));
                                    const valid = values.filter((value): value is number => value !== null);
                                    const minimum = Math.min(...valid);
                                    const maximum = Math.max(...valid);
                                    const ranked = valid.length > 1 && minimum !== maximum;
                                    const base = numeric ? amount(reference?.values[key]) : null;
                                    return (
                                        <tr key={key} data-key-metric={KEY_FIELDS.includes(key)}>
                                            <th scope="row">{labels[key] ?? key}</th>
                                            {/* Independent missing/rank/bar/reference display states keep the source cell intact. */}
                                            {items.map(
                                                // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
                                                (item, index) => {
                                                    const value = values[index] ?? null;
                                                    const best = COST_FIELDS.has(key) ? minimum : maximum;
                                                    const worst = COST_FIELDS.has(key) ? maximum : minimum;
                                                    const rank = ranked && value !== null ? (value === best ? "best" : value === worst ? "worst" : "middle") : undefined;
                                                    const direction = value === maximum ? "higher" : value === minimum ? "lower" : "middle";
                                                    const delta = value !== null && base !== null ? value - base : null;
                                                    return (
                                                        <td key={item.id} data-rank={rank}>
                                                            <div className="unit-comparison-value">
                                                                <span className={!item.values[key] ? "unit-comparison-missing" : undefined}>{item.values[key] || "Sin asignar"}</span>
                                                                {rank && (
                                                                    <span className="unit-comparison-rank">
                                                                        <span role="img" aria-label={direction === "higher" ? "Valor mayor" : direction === "lower" ? "Valor menor" : "Valor intermedio"}>
                                                                            {direction === "higher" ? <ArrowUpOutlined /> : direction === "lower" ? <ArrowDownOutlined /> : <MinusOutlined />}
                                                                        </span>
                                                                        {rank === "best" ? "Mejor valor" : rank === "worst" ? "Menos favorable" : "Intermedio"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {numeric && value !== null && valid.length > 1 && minimum >= 0 && maximum > 0 && (
                                                                <div className="unit-comparison-track" aria-hidden="true">
                                                                    <span style={{ width: `${String((value / maximum) * 100)}%` }} />
                                                                </div>
                                                            )}
                                                            {delta !== null && item.id !== reference?.id && <small className="unit-comparison-delta">{delta === 0 ? "Igual a referencia" : `${delta > 0 ? "+" : "−"}${Math.abs(delta) < 0.000001 ? "<0,000001" : numberFormat.format(Math.abs(delta))} vs. referencia`}</small>}
                                                        </td>
                                                    );
                                                },
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        );
                    })}
                </table>
            </div>
        </div>
    );
}
