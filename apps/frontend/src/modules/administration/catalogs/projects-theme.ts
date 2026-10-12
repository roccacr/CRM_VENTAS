import type { ThemeConfig } from "antd/es/config-provider";

import { ADMINISTRATION_THEME } from "../administration-theme";

/**
 * Escala Bunker de Proyectos (Arquitectura/26-Projects-Design-System.md).
 *
 * Ant Design calcula tokens derivados en JS y no acepta `var(--color-neutral-N)`,
 * por eso los valores se repiten aquí. Deben coincidir con `ProjectsView.css`;
 * `test/catalogs/projects-palette.spec.ts` lo verifica.
 */
export const PROJECTS_NEUTRAL = {
    50: "#f5f7fa",
    100: "#ebeef3",
    200: "#d2dae5",
    300: "#abbbce",
    400: "#7d96b3",
    500: "#5d799a",
    600: "#496180",
    700: "#3c4f68",
    800: "#354357",
    900: "#2f3a4b",
    950: "#0e1116",
} as const;

/**
 * Tema AntD solo para Proyectos y sus portales (detalle y modales).
 *
 * Las celdas de DataTables montan raíces React propias y no heredan este tema;
 * su menú de acciones se ajusta en `ProjectsView.css`.
 */
export const PROJECTS_THEME: ThemeConfig = {
    components: {
        ...ADMINISTRATION_THEME.components,
        Descriptions: { itemPaddingBottom: 12, labelColor: PROJECTS_NEUTRAL[600], titleColor: PROJECTS_NEUTRAL[900], contentColor: PROJECTS_NEUTRAL[700] },
        Form: { itemMarginBottom: 16, labelColor: PROJECTS_NEUTRAL[700], verticalLabelPadding: "0 0 4px" },
    },
    token: {
        ...ADMINISTRATION_THEME.token,
        colorBgLayout: PROJECTS_NEUTRAL[50],
        colorBgSpotlight: PROJECTS_NEUTRAL[950],
        colorBorder: PROJECTS_NEUTRAL[500],
        colorBorderSecondary: PROJECTS_NEUTRAL[200],
        colorSplit: PROJECTS_NEUTRAL[200],
        colorFillAlter: PROJECTS_NEUTRAL[50],
        colorIcon: PROJECTS_NEUTRAL[600],
        colorIconHover: PROJECTS_NEUTRAL[950],
        colorLink: PROJECTS_NEUTRAL[600],
        colorLinkHover: PROJECTS_NEUTRAL[950],
        colorLinkActive: PROJECTS_NEUTRAL[950],
        colorPrimary: PROJECTS_NEUTRAL[950],
        colorPrimaryHover: PROJECTS_NEUTRAL[900],
        colorPrimaryActive: PROJECTS_NEUTRAL[900],
        colorText: PROJECTS_NEUTRAL[700],
        colorTextHeading: PROJECTS_NEUTRAL[900],
        colorTextDescription: PROJECTS_NEUTRAL[600],
        colorTextSecondary: PROJECTS_NEUTRAL[600],
        colorTextTertiary: PROJECTS_NEUTRAL[600],
        colorTextPlaceholder: PROJECTS_NEUTRAL[600],
        controlItemBgHover: PROJECTS_NEUTRAL[100],
        controlItemBgActive: PROJECTS_NEUTRAL[100],
        controlItemBgActiveHover: PROJECTS_NEUTRAL[200],
        controlOutline: "rgba(73, 97, 128, 0.24)",
    },
};
