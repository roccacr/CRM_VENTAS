import Modal from "antd/es/modal";

export interface ConfirmActionOptions {
    readonly title: string;
    readonly content: string;
    readonly okText?: string;
    readonly cancelText?: string;
}

/**
 * Confirmación modal del sistema en lugar de `window.confirm`.
 *
 * El diálogo nativo rompe la identidad visual, no es accesible por tema ni se
 * puede traducir. Resuelve `true` solo si la persona acepta. Cancelar resuelve
 * `false` y la promesa no rechaza, así el llamador no necesita un catch.
 * Si no vienen textos, los botones dicen Continuar y Cancelar.
 */
export const confirmAction = ({ title, content, okText = "Continuar", cancelText = "Cancelar" }: ConfirmActionOptions): Promise<boolean> =>
    new Promise((resolve) => {
        Modal.confirm({
            title,
            content,
            okText,
            cancelText,
            centered: true,
            onOk: () => {
                resolve(true);
            },
            onCancel: () => {
                resolve(false);
            },
        });
    });
