/**
 * Logo compartido por login, sesion y el shell.
 * `BASE_URL` evita que una ruta anidada busque el archivo relativo a esa ruta.
 * El ancho y el alto son los del SVG, para reservar el cuadro antes de que cargue.
 */
export const ROCCA_LOGO = {
    src: `${import.meta.env.BASE_URL}Logo/logoRDR.svg`,
    width: 205,
    height: 62,
} as const;
