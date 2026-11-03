export const CARD_WIDTH = 340;
const GAP = 6;
const MARGIN = 12;

/**
 * Places the event card beside the event (right first, left when the right edge would clip it) and aligned to its top, so siblings in the same day stay visible.
 * Events in the last columns (sábado, domingo) therefore open to the left. Only when neither side has room does it fall back to below or above the event.
 */
export function placeOutlookPopover(anchor: DOMRect | null, height: number, viewport: { readonly width: number; readonly height: number } = { width: window.innerWidth, height: window.innerHeight }): { top: number; left: number } {
    if (!anchor) return { top: MARGIN, left: MARGIN };
    const clampTop = (top: number) => Math.min(Math.max(MARGIN, top), Math.max(MARGIN, viewport.height - height - MARGIN));
    const right = anchor.right + GAP;
    if (right + CARD_WIDTH + MARGIN <= viewport.width) return { top: clampTop(anchor.top), left: right };
    const left = anchor.left - GAP - CARD_WIDTH;
    if (left >= MARGIN) return { top: clampTop(anchor.top), left };
    const centered = Math.min(Math.max(MARGIN, anchor.left), viewport.width - CARD_WIDTH - MARGIN);
    const below = anchor.bottom + GAP;
    return { top: below + height + MARGIN <= viewport.height ? below : clampTop(anchor.top - GAP - height), left: centered };
}
