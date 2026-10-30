import type { NotePlacement } from "../../services/notes/notes-service";

/** Clamp visible controls to the current screen, preserving the stored desktop layout separately. */
export function visiblePlacement(value: NotePlacement): NotePlacement {
    const width = Math.min(value.width, Math.max(160, window.innerWidth - 24));
    const height = Math.min(value.height, Math.max(80, window.innerHeight - 150));
    const minY = value.anchorMode === "viewport" ? 116 : 116 + window.scrollY;
    return { ...value, width, height, x: Math.round(Math.max(12, Math.min(value.x, window.innerWidth - width - 12))), y: Math.round(value.anchorMode === "viewport" ? Math.max(minY, Math.min(value.y, window.innerHeight - height - 12)) : Math.max(minY, value.y)) };
}
