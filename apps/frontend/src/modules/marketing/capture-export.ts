/**
 * Export of the on-screen report as an image (PNG) or a PDF.
 *
 * No library: the image is made by drawing a copy of the report into an SVG `foreignObject` and rasterising it, and the PDF is the
 * browser's own print dialog ("Save as PDF") with a print stylesheet. Both read what is already on screen, so the file always matches it.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";
/** Twice the screen resolution, so text stays sharp when the image is zoomed or printed. */
const IMAGE_SCALE = 2;

/** File name from the choices on screen: lowercase, no accents, nothing a file system would reject. */
export function exportFileName(parts: readonly string[], extension: "png" | "pdf"): string {
    const slug = parts
        .join("_")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLocaleLowerCase("es")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return `${slug || "reporte"}.${extension}`;
}

function toDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(typeof reader.result === "string" ? reader.result : "");
        };
        reader.onerror = () => {
            reject(new Error("No se pudo leer la imagen."));
        };
        reader.readAsDataURL(blob);
    });
}

/** Photos are fetched from the app and embedded as data, because an SVG drawn into a canvas cannot load outside files. */
async function embedImages(root: HTMLElement): Promise<void> {
    await Promise.all(
        [...root.querySelectorAll("img")].map(async (image) => {
            try {
                const response = await fetch(image.currentSrc || image.src);
                image.setAttribute("src", await toDataUrl(await response.blob()));
            } catch {
                image.remove();
            }
        }),
    );
}

/** Every rule of the page's stylesheets as text, so the copy is styled exactly like the original (including ::before / ::after). */
function pageCss(): string {
    return [...document.styleSheets]
        .flatMap((sheet) => {
            try {
                return [...sheet.cssRules].map((rule) => rule.cssText);
            } catch {
                return [];
            }
        })
        .join("\n");
}

/** The page root keeps the classes the report's styles are scoped to; the copy needs the same ones. */
function scopeOf(node: HTMLElement): string {
    return node.closest<HTMLElement>(".capture-preview")?.className ?? "capture-preview";
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            resolve(image);
        };
        image.onerror = () => {
            reject(new Error("No se pudo dibujar el reporte."));
        };
        image.src = url;
    });
}

/**
 * Draws `node` into a PNG. The copy is laid out off-screen at the same width, with the export class on, so parts that scroll on
 * screen (the wide chart) are fully open and the whole report fits in the picture.
 */
export async function renderNodeToPng(node: HTMLElement): Promise<Blob> {
    const width = node.offsetWidth;
    const stage = document.createElement("div");
    stage.className = scopeOf(node);
    Object.assign(stage.style, { position: "fixed", left: "-100000px", top: "0", width: `${String(width)}px`, background: "#eaedf2", padding: "24px", boxSizing: "border-box" });
    const copy = node.cloneNode(true) as HTMLElement;
    copy.classList.add("capture-exporting");
    stage.append(copy);
    document.body.append(stage);
    try {
        await embedImages(copy);
        const full = stage.offsetWidth;
        const height = stage.scrollHeight;
        const style = document.createElement("style");
        style.textContent = pageCss();
        const holder = document.createElementNS(XHTML_NS, "div");
        // The off-screen placement belongs to the staging box only: inside the picture the copy sits at the top left.
        const placed = stage.cloneNode(true) as HTMLElement;
        Object.assign(placed.style, { position: "static", left: "auto", top: "auto" });
        holder.append(style, placed);
        const svg = `<svg xmlns="${SVG_NS}" width="${String(full)}" height="${String(height)}" viewBox="0 0 ${String(full)} ${String(height)}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(holder)}</foreignObject></svg>`;
        // A data URL, not a blob URL: with a blob URL Chrome marks the canvas as tainted and refuses to export it.
        const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        {
            const image = await loadImage(url);
            const canvas = document.createElement("canvas");
            canvas.width = full * IMAGE_SCALE;
            canvas.height = height * IMAGE_SCALE;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("El navegador no permite generar la imagen.");
            context.scale(IMAGE_SCALE, IMAGE_SCALE);
            context.drawImage(image, 0, 0);
            return await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("No se pudo generar la imagen."));
                }, "image/png");
            });
        }
    } finally {
        stage.remove();
    }
}

/** Hands a file to the browser's download, without leaving the page. */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

/**
 * Opens the print dialog with only the report: the body gets a class the print styles are scoped to (so printing any other
 * page afterwards is untouched) and a one-off rule sets A4 landscape. Both are removed when printing ends.
 */
export function printReport(): void {
    const page = document.createElement("style");
    page.textContent = "@page { size: A4 landscape; margin: 10mm; }";
    document.head.append(page);
    document.body.classList.add("capture-printing");
    const finish = () => {
        document.body.classList.remove("capture-printing");
        page.remove();
        window.removeEventListener("afterprint", finish);
    };
    window.addEventListener("afterprint", finish);
    window.print();
}
