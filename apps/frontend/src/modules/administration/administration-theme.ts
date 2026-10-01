import type { ThemeConfig } from "antd/es/config-provider";
import type { DrawerProps } from "antd/es/drawer";

/**
 * Tema AntD de Administración.
 *
 * Lo comparten la tabla, el detalle y el alta de usuarios para que paddings,
 * colores semánticos y tipografía sean los mismos en el fondo y en los paneles.
 * Los textos secundarios usan #475467 o #5b6478 sobre blanco: contraste AA (≥ 4.5:1).
 */
export const ADMINISTRATION_THEME: ThemeConfig = {
    components: {
        Descriptions: { itemPaddingBottom: 12, labelColor: "#5b6478", titleColor: "#0f172a" },
        Form: { itemMarginBottom: 16, labelColor: "#344054", verticalLabelPadding: "0 0 4px" },
        Segmented: { itemSelectedBg: "#ffffff", trackBg: "#eef1f6" },
        Select: { optionActiveBg: "#f2f4f7", optionSelectedBg: "#eef1f6", optionSelectedColor: "#0f172a", optionSelectedFontWeight: 600 },
        Table: { bodySortBg: "transparent", headerBg: "#f6f8fc", headerColor: "#475467", headerSortActiveBg: "#f6f8fc", headerSortHoverBg: "#eef1f6", rowHoverBg: "#f7f8fd", rowSelectedBg: "#f1f4ff", rowSelectedHoverBg: "#e8edff" },
        Tabs: { inkBarColor: "#4f5fb8", itemColor: "#475467", itemHoverColor: "#4f5fb8", itemSelectedColor: "#0b1020" },
    },
    token: {
        borderRadius: 8,
        colorBorder: "#c6cedd",
        colorLink: "#4f5fb8",
        colorPrimary: "#0b1020",
        colorText: "#172033",
        colorTextDescription: "#5b6478",
        colorTextSecondary: "#5b6478",
        controlHeight: 36,
        fontFamily: 'Aptos, "Segoe UI", system-ui, sans-serif',
        fontSize: 13,
    },
};

/**
 * Panel lateral común de Administración.
 *
 * Ver un usuario y crear uno abren el mismo contenedor: mismo ancho, misma
 * máscara translúcida, misma sombra y borde que lo separan del fondo, y misma
 * capa sobre el encabezado global (z-index 1100-1200).
 */
export const ADMINISTRATION_DRAWER_PROPS = {
    placement: "right",
    size: 560,
    styles: {
        mask: { backdropFilter: "blur(2px)", backgroundColor: "rgba(0, 0, 0, 0.25)" },
        wrapper: { borderLeft: "1px solid #c6cedd", boxShadow: "-16px 0 40px rgba(15, 23, 42, 0.24), -2px 0 6px rgba(15, 23, 42, 0.08)" },
    },
    zIndex: 1300,
} as const satisfies DrawerProps;

/** La X de cierre va en la esquina superior derecha, como en el resto de paneles. */
export const ADMINISTRATION_DRAWER_CLOSE_PLACEMENT = "end";
