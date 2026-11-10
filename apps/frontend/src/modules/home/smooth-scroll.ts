/** Primer ancestro que de verdad hace scroll vertical. El shell de la app se desplaza dentro de sí. La página es el elemento de scroll del documento, no `body`. */
function scrollParentOf(node: HTMLElement): HTMLElement | null {
    for (let parent = node.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
        const { overflowY } = getComputedStyle(parent);
        if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight) return parent;
    }
    return null;
}

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const prefersReducedMotion = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animate(root: Element, from: number, to: number, duration: number): void {
    const start = performance.now();
    const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        root.scrollTop = from + (to - from) * easeInOut(progress);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

const rootOf = (container: HTMLElement | null): Element => container ?? document.scrollingElement ?? document.documentElement;
const topOf = (container: HTMLElement | null): number => (container ? container.getBoundingClientRect().top : 0);

/**
 * Scrolls so `node` sits `offset` px under the top of its scroll area, easing in and out over `duration` ms. The browser's own smooth
 * scroll is too quick to follow on a long page; this one starts and ends gently. With reduced motion it jumps.
 */
export function smoothScrollTo(node: HTMLElement, offset: number, duration = 750): void {
    const container = scrollParentOf(node);
    const root = rootOf(container);
    const from = root.scrollTop;
    const to = Math.max(0, from + node.getBoundingClientRect().top - topOf(container) - offset);
    if (prefersReducedMotion() || Math.abs(to - from) < 2) root.scrollTop = to;
    else animate(root, from, to, duration);
}
