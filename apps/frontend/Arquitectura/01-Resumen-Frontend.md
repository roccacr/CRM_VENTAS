# 01 - Resumen Frontend

## Veredicto

El frontend del CRM debe ser una aplicacion React + Vite + TypeScript enfocada en productividad comercial: rapida, clara, densa, accesible y orientada a tablas, filtros, acciones y seguimiento.

La UI del producto sera en espanol para usuarios de Costa Rica.

Estado de fase:

```txt
vision completa del frontend != alcance autorizado actual
```

Al corte 2026-10-22 existen identidad, Administracion/catalogos y Formalizacion parcial. Solo el contador de aprobaciones del Home tiene datos reales y permiso propio; no existen aun acciones persistidas de aprobacion ni seguimiento operacional. Calendario/resumen y previews conservan simulaciones. Ver [remediacion y evidencia](../../api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md).

## Stack frontend

- React.
- Vite.
- TypeScript estricto.
- Ant Design, DataTables/SearchPanes y CSS del proyecto.
- Servicios tipados con fetch y estado/hooks React existentes.
- Vitest y Testing Library para pruebas automatizadas.

TanStack Query, Zustand, React Hook Form, Tailwind y Radix/shadcn son propuestas del blueprint, no el stack instalado. No incorporarlos solo para ajustar el codigo a documentos antiguos.

## Responsabilidades frontend

- Experiencia del vendedor.
- Interfaz en espanol orientada a la operacion comercial local.
- Vistas de leads, actividades, oportunidades, calendario, dashboard y reportes cuando su fase este aprobada.
- Formularios y validacion UX.
- Manejo de estados de carga/error.
- Ciclo de solicitudes y cache mediante los servicios/hooks implementados; autorizacion final siempre en API.
- Componentes reutilizables.
- Accesibilidad WCAG AA como objetivo, no certificacion global obtenida.

Navegacion mediante History API con popstate, rutas diferidas/Suspense y limite de errores recuperable por ruta. Las esperas artificiales de sesion se retiraron; los estados de carga representan solicitudes reales. Estos mecanismos no acreditan tiempos de respuesta productivos.

## No responsabilidades

- No decide permisos finales.
- No calcula permisos finales; consume permisos efectivos desde el API.
- No contiene reglas comerciales criticas.
- No llama NetSuite/Odoo directo.
- No llama legacy CRM directo.
- No guarda secretos.
- No usa estructuras legacy como contrato visual.
