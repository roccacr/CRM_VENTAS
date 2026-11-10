/**
 * Exporta el reporte que está en pantalla como imagen PNG o como PDF.
 *
 * No usa una librería. La imagen se hace dibujando una copia del reporte dentro de un `foreignObject` SVG y rasterizándola. El PDF es el
 * diálogo de impresión del navegador, con una hoja de estilos de impresión. Los dos leen lo que ya está en pantalla, así que el archivo coincide con eso.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";
/** El doble de la resolución de pantalla, para que el texto siga nítido al ampliar o imprimir la imagen. */
const IMAGE_SCALE = 2;

/** El nombre del archivo sale de lo elegido en pantalla: minúsculas, sin acentos y sin caracteres que un sistema de archivos rechace. */
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

/** Las fotos se piden a la aplicación y se incrustan como datos, porque un SVG dibujado en un canvas no puede cargar archivos externos. */
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

/** Cada regla de las hojas de estilo de la página, como texto, para que la copia se vea igual que el original, incluidos `::before` y `::after`. */
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

/** La raíz de la página conserva las clases a las que están acotados los estilos del reporte. La copia necesita las mismas. */
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
 * Dibuja `node` en un PNG. La copia se arma fuera de pantalla, al mismo ancho y con la clase de exportación, para que lo que en pantalla se desplaza,
 * como el gráfico ancho, quede abierto por completo y el reporte entero quepa en la imagen.
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
        // La posición fuera de pantalla pertenece solo a la caja de preparación. Dentro de la imagen, la copia queda arriba a la izquierda.
        const placed = stage.cloneNode(true) as HTMLElement;
        Object.assign(placed.style, { position: "static", left: "auto", top: "auto" });
        holder.append(style, placed);
        const svg = `<svg xmlns="${SVG_NS}" width="${String(full)}" height="${String(height)}" viewBox="0 0 ${String(full)} ${String(height)}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(holder)}</foreignObject></svg>`;
        // Es una URL de datos, no una URL de blob. Con una URL de blob, Chrome marca el canvas como contaminado y rechaza exportarlo.
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

/** Entrega un archivo a la descarga del navegador y deja a la persona en la misma página. */
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
 * Abre el diálogo de impresión solo con el reporte. El body recibe la clase a la que están acotados los estilos de impresión, así que imprimir otra
 * página después no hereda esa hoja. Una regla de una sola vez fija A4 horizontal. Las dos se quitan cuando termina la impresión.
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
