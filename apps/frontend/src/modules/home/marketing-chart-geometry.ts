export interface ChartPoint {
    readonly x: number;
    readonly y: number;
}

/** Rounds the top of an axis up to 1, 2, 5 or 10 times a power of ten so gridlines carry readable numbers. */
export function niceMaximum(value: number): number {
    if (value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const fraction = value / magnitude;
    const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    return step * magnitude;
}

/** Maps values to a box; a single value sits in the middle so it is still visible. */
export function toPoints(values: readonly number[], maximum: number, width: number, height: number): ChartPoint[] {
    const safeMaximum = maximum > 0 ? maximum : 1;
    return values.map((value, index) => ({ x: values.length > 1 ? (index / (values.length - 1)) * width : width / 2, y: height - (Math.max(0, value) / safeMaximum) * height }));
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** One Bezier segment between two points, with control points kept inside the box. */
function segment(points: readonly ChartPoint[], index: number, height: number): string {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) return "";
    const before = points[index - 1] ?? from;
    const after = points[index + 2] ?? to;
    const clamp = (value: number): number => Math.min(height, Math.max(0, value));
    const control1 = `${String(round(from.x + (to.x - before.x) / 6))},${String(round(clamp(from.y + (to.y - before.y) / 6)))}`;
    const control2 = `${String(round(to.x - (after.x - from.x) / 6))},${String(round(clamp(to.y - (after.y - from.y) / 6)))}`;
    return ` C${control1} ${control2} ${String(round(to.x))},${String(round(to.y))}`;
}

/** Smooth curve through the points (Catmull-Rom as Bezier), kept inside the box so it never dips below zero. */
export function smoothPath(points: readonly ChartPoint[], height: number): string {
    const [first] = points;
    if (!first) return "";
    return points.slice(0, -1).reduce((path, _point, index) => path + segment(points, index, height), `M${String(round(first.x))},${String(round(first.y))}`);
}

/** Closes a line down to the baseline so it can be filled. */
export function areaPath(points: readonly ChartPoint[], height: number): string {
    const first = points[0];
    const last = points.at(-1);
    return first && last ? `${smoothPath(points, height)} L${String(round(last.x))},${String(height)} L${String(round(first.x))},${String(height)} Z` : "";
}
