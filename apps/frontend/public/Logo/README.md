# Logo ROCCA

## Marca aplicada en Habita

`logoRDR.svg` es el archivo oficial suministrado para el login, las pantallas
de autenticación, el encabezado de escritorio y móvil, la marca de agua y el
icono de pestaña. Las vistas de React comparten la ruta y las dimensiones en
`src/config/branding.ts`.

Los planos de la tarjeta de login y del encabezado se sirven desde
`public/illustrations`. Son elementos decorativos. La etiqueta de versión
se presenta por separado junto al logo del shell. El [corte frontend](../../Arquitectura/33-Reconciliacion-Frontend-20261110.md) registra la versión publicada y la copia de trabajo.

## Referencias históricas — 2026-11-02

En ese corte, `index.html` referenciaba los favicons PNG/SVG. LoginPage,
GlobalHomeShell y AuthStateScreens usaban `/Logo/rocca-concept.png`.
No se regeneraron imágenes ni se midieron peso, transparencia, accesibilidad
visual o nitidez en esta revisión; la procedencia inferior conserva su fecha.
Inventario y límites: [72](../../../api/Arquitectura/72-Reconciliacion-Documental-20261102.md).

## Referencias verificadas - 2026-10-22, corte f2dc4f1

`index.html` declara los favicons PNG y SVG locales. LoginPage, GlobalHomeShell y AuthStateScreens referencian `/Logo/rocca-concept.png`; el SVG oficial esta conservado como alternativa. Se verificaron archivos y referencias, no calidad visual, nitidez, transparencia real ni optimizacion de peso mediante una medicion nueva. La procedencia y fecha de generacion siguientes conservan su registro historico; no son una certificacion de marca ni una aprobacion nueva.

## Archivos históricos de marca

`rocca-favicon.png` es un monograma R original generado para la pestana del
nuevo sistema: blanco sobre fondo carbon, sin texto pequeno. Se referenciaba
desde index.html y sustituyó el JPG horizontal, que perdía legibilidad al
reducirse. No reemplaza el logo del encabezado ni del login; no es una marca
oficial aprobada. El PNG original generado se conserva en el proyecto.

La version SVG es una adaptacion vectorial simplificada del concepto generado,
sin imagenes incrustadas ni dependencias. El navegador compatible prioriza
el SVG ligero; el PNG queda como alternativa. El SVG no es una vectorizacion
automatica ni una reproduccion exacta de los pixeles generados.

`rocca-official.svg` procede de https://www.roccacr.com/images/logoRoccaB.svg
(consultado el 20/10/2026). Se conservan los trazados y el viewBox originales;
solo se adapta el relleno blanco a #111318 para superficies claras.

El SVG oficial queda conservado como alternativa.

La versión anterior `rocca-concept.png` es una propuesta original
generada el 20/10/2026 por solicitud del usuario, inspirada en la identidad de
ROCCA. No es el logo oficial aprobado. PNG transparente de alta resolucion,
usado en encabezado, navegacion movil, login y estados de autenticacion.
No depende de fuentes ni servicios externos.
