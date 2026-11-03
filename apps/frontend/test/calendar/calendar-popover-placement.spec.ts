import { describe, expect, it } from "vitest";

import { CARD_WIDTH, placeOutlookPopover } from "../../src/modules/calendar/calendar-popover-placement";

const viewport = { width: 1900, height: 900 };
const anchor = (left: number, top: number, width = 215) => ({ left, right: left + width, top, bottom: top + 24 }) as DOMRect;

describe("Outlook event card placement", () => {
    it("opens to the right of an event in the middle of the week", () => {
        expect(placeOutlookPopover(anchor(1205, 300), 200, viewport)).toEqual({ top: 300, left: 1426 });
    });
    it("opens to the left for events in the last columns, where the right side would be clipped", () => {
        const saturday = placeOutlookPopover(anchor(1650, 300), 200, viewport);
        expect(saturday.left).toBe(1650 - 6 - CARD_WIDTH);
        const sunday = placeOutlookPopover(anchor(1700, 300, 190), 200, viewport);
        expect(sunday.left).toBe(1700 - 6 - CARD_WIDTH);
    });
    it("stays inside the viewport vertically", () => {
        expect(placeOutlookPopover(anchor(300, 850), 200, viewport).top).toBe(900 - 200 - 12);
    });
    it("falls back below or above when neither side fits", () => {
        const narrow = { width: 360, height: 900 };
        const result = placeOutlookPopover(anchor(20, 100, 320), 200, narrow);
        expect(result.left).toBe(360 - CARD_WIDTH - 12);
        expect(result.top).toBe(100 + 24 + 6);
    });
});
