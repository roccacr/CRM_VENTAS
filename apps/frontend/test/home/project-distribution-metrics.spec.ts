import { expect, it } from "vitest";

import { distributionMetrics, distributionPercent } from "../../src/modules/home/project-distribution-metrics";

it("compares BC Lofts' unique counts with the whole project and with its commercial base separately", () => {
    const result = distributionMetrics(48, 15);
    expect(result.total).toBe(63);
    expect(result.commercialShare).toBeCloseTo(0.7619047619);
    expect(result.finiquitoShare).toBeCloseTo(0.2380952381);
    expect(result.finiquitoToCommercial).toBeCloseTo(0.3125);
    expect(distributionPercent(result.finiquitoShare)).toMatch(/^23,8\s?%$/);
    expect(distributionPercent(result.finiquitoToCommercial)).toMatch(/^31,3\s?%$/);
});
it("uses the combined portfolio for share and the commercial portfolio for comparison", () => {
    const result = distributionMetrics(255, 131);
    expect(result.total).toBe(386);
    expect(distributionPercent(result.finiquitoShare)).toMatch(/^33,9\s?%$/);
    expect(distributionPercent(result.finiquitoToCommercial)).toMatch(/^51,4\s?%$/);
});
it.each([0, 15])("does not divide by a missing commercial base: finiquito=%s", (finiquito) => {
    const result = distributionMetrics(0, finiquito);
    expect(result.finiquitoToCommercial).toBeNull();
    expect(distributionPercent(result.finiquitoToCommercial, "Sin base comercial")).toBe("Sin base comercial");
    expect(result.finiquitoShare).toBe(finiquito === 0 ? null : 1);
});
it("keeps a genuine zero and permits ratios over one hundred percent", () => {
    expect(distributionMetrics(48, 0).finiquitoShare).toBe(0);
    expect(distributionMetrics(1, 4).finiquitoToCommercial).toBe(4);
});
