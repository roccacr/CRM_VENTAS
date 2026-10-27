# 01 - Resumen Frontend

## Estado contrastado - 2026-10-27

[30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md) inventaría las rutas, contratos y límites actuales: Captación conectada, seguimiento y cambio protegido de etapa de Formalización. Los cortes fechados siguientes son antecedentes; sus cifras de QA no se reejecutaron en esta revisión documental.


## Veredicto

El frontend del CRM debe ser una aplicacion React + Vite + TypeScript enfocada en productividad comercial: rapida, clara, densa, accesible y orientada a tablas, filtros, acciones y seguimiento.

La UI del producto sera en espanol para usuarios de Costa Rica.

Estado de fase:

```txt
vision completa del frontend != alcance autorizado actual
```

En el antecedente documental 2026-10-23 existían identidad, Administracion/catalogos, Formalizacion parcial y Home de Mercadeo conectado. Aprobaciones exige `formalizacion.home.approvals.read`; seis banners de etapas comparten `GET /formalization/home/summary`, rol efectivo activo `formalizacion` y `formalizacion.home.stages.read` permitido sin deny. Owner puede heredar ese rol por politica backend; no necesita asignacion directa ni elude denies. Carga muestra preload; cero de error marcado Sin verificar no es ausencia confirmada de ordenes. Ese corte tenía bandejas vacías. El estado 2026-10-27 conecta seguimiento canónico y cambio de etapa con permiso independiente; envío/reversión de contratos y Calendario/Resumen/previews siguen fuera de esa conexión.

Mercadeo lee agregados canonicos de leads y evidencia de citas disponible con `mercadeo.home.read`: periodos dia/semana/mes/anio, vendedor/proyecto multiseleccion y sin muestra ficticia de respaldo. El API resuelve origen nativo/legacy, deduplicacion y alcance. Programada no equivale a realizada o asistida; no hay editor de calendario persistido ni Outlook/campana conectados. Cobertura y limites: [49 - Estado actual](../../api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md).

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
