import { describe, expect, it } from "vitest";

import { installBrowserApiDoubles } from "./browser";

describe("browser API doubles", () => {
    it("reuses the computed-style adapter across repeated test preparations", () => {
        installBrowserApiDoubles();
        const adapter = Object.getOwnPropertyDescriptor(window, "getComputedStyle");
        for (let index = 0; index < 100; index += 1) installBrowserApiDoubles();

        expect(Object.getOwnPropertyDescriptor(window, "getComputedStyle")).toEqual(adapter);
        const element = document.createElement("div");
        element.style.color = "rgb(12, 34, 56)";
        expect(window.getComputedStyle(element).color).toBe("rgb(12, 34, 56)");
        expect(window.getComputedStyle(element, "::before").color).toBe("rgb(12, 34, 56)");
    });
});
