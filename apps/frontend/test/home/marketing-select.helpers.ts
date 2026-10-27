import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

// JSDOM has no layout observer; use the same no-layout setup as the existing Select tests.
beforeEach(() => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});
/**
 *
 */
export function selectedMarketingValues(label: string): string[] {
    const control = screen.getByRole("combobox", { name: label }).closest(".ant-select") as HTMLElement;
    return Array.from(control.querySelectorAll(".ant-select-selection-item")).map((node) => node.getAttribute("title") ?? "");
}
/**
 *
 */
export async function selectMarketing(label: string, name: string, append = false): Promise<void> {
    const input = screen.getByRole("combobox", { name: label });
    const control = input.closest(".ant-select") as HTMLElement;
    if (!append) for (const remove of control.querySelectorAll(".ant-select-selection-item-remove")) fireEvent.click(remove);
    if (!name) return;
    if (input.getAttribute("aria-expanded") !== "true") fireEvent.mouseDown(input);
    fireEvent.click(await screen.findByRole("option", { name }));
    fireEvent.keyDown(input, { key: "Escape", code: "Escape", keyCode: 27, which: 27 });
}
/**
 *
 */
export function marketingOptions(label: string): (string | null)[] {
    const input = screen.getByRole("combobox", { name: label });
    if (input.getAttribute("aria-expanded") !== "true") fireEvent.mouseDown(input);
    const popup = document.getElementById(input.getAttribute("aria-controls") ?? "") as HTMLElement;
    const names = within(popup)
        .getAllByRole("option")
        .map((node) => node.textContent);
    fireEvent.keyDown(input, { key: "Escape", code: "Escape", keyCode: 27, which: 27 });
    return names;
}
