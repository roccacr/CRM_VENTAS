import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { smoothScrollTo } from "../../src/modules/home/smooth-scroll";

function setup(): { readonly container: HTMLElement; readonly node: HTMLElement } {
    const container = document.createElement("div");
    container.style.overflowY = "auto";
    Object.defineProperty(container, "scrollHeight", { value: 3000, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 800, configurable: true });
    container.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    const node = document.createElement("section");
    node.getBoundingClientRect = () => ({ top: 100 + 1000 - container.scrollTop }) as DOMRect;
    container.append(node);
    document.body.append(container);
    return { container, node };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
});

it("glides to the section: slow at the start, steady in the middle, settling at the end, never jumping", () => {
    const { container, node } = setup();
    smoothScrollTo(node, 56, 800);
    const seen: number[] = [];
    for (let elapsed = 0; elapsed <= 900; elapsed += 50) {
        vi.advanceTimersByTime(50);
        seen.push(container.scrollTop);
    }
    const target = 1000 - 56;
    expect(seen.at(-1)).toBe(target);
    expect(seen.some((value) => value > 0 && value < target)).toBe(true);
    expect(seen.every((value, index) => index === 0 || value >= (seen[index - 1] ?? 0))).toBe(true);
    // eased: the first quarter of the time covers far less than a quarter of the distance
    expect(seen[3]).toBeLessThan(target * 0.25);
    // and no single frame jumps more than a third of the way
    expect(Math.max(...seen.map((value, index) => value - (seen[index - 1] ?? 0)))).toBeLessThan(target / 3);
});

it("jumps straight there when the person asked for reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { container, node } = setup();
    smoothScrollTo(node, 56, 800);
    expect(container.scrollTop).toBe(944);
});
