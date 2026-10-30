import { afterEach, expect, it } from "vitest";

import { visiblePlacement } from "../../src/modules/notes/note-placement";
import type { NotePlacement } from "../../src/services/notes/notes-service";
const base: NotePlacement = { viewportClass: "desktop", anchorMode: "viewport", x: 100000, y: 100000, width: 300, height: 230, collapsed: false, hidden: false, layoutVersion: 4 };
const initial = { width: window.innerWidth, height: window.innerHeight };
afterEach(() => {
    Object.defineProperty(window, "innerWidth", { value: initial.width, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: initial.height, configurable: true });
});
it("keeps all PIN controls reachable even with a saved out-of-screen position", () => {
    const value = visiblePlacement(base);
    expect(value.x + value.width).toBeLessThanOrEqual(window.innerWidth - 12);
    expect(value.y + value.height).toBeLessThanOrEqual(window.innerHeight - 12);
    expect(base.y).toBe(100000);
    expect(value.layoutVersion).toBe(4);
});
it("fits a desktop sheet inside a narrow viewport without rewriting stored dimensions", () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 640, configurable: true });
    const value = visiblePlacement({ ...base, width: 1000, height: 900 });
    expect(value.width).toBe(351);
    expect(value.height).toBe(490);
    expect(value.y).toBe(138);
    expect(value.x).toBe(12);
});
