# 01 - Resumen Frontend

## Veredicto

El frontend del CRM debe ser una aplicacion React + Vite + TypeScript enfocada en productividad comercial: rapida, clara, densa, accesible y orientada a tablas, filtros, acciones y seguimiento.

La UI del producto sera en espanol para usuarios de Costa Rica.

Estado de fase:

```txt
vision completa del frontend != alcance autorizado actual
```

El alcance autorizado actual es la compuerta visual de identidad: usuarios, autenticacion, areas/equipos, roles y permisos. Las vistas comerciales de leads, calendario, dashboard y reportes son posteriores a esa compuerta.

## Stack frontend

- React.
- Vite.
- TypeScript estricto.
- TanStack Query para server state.
- Zustand para estado UI/global ligero.
- React Hook Form para formularios.
- Zod para validacion frontend cuando aplique.
- Tailwind CSS.
- Radix/shadcn para componentes accesibles cuando convenga.
- Playwright/Vitest para pruebas.

## Responsabilidades frontend

- Experiencia del vendedor.
- Interfaz en espanol orientada a la operacion comercial local.
- Vistas de leads, actividades, oportunidades, calendario, dashboard y reportes cuando su fase este aprobada.
- Formularios y validacion UX.
- Manejo de estados de carga/error.
- Cache e invalidacion de datos remotos con TanStack Query.
- Componentes reutilizables.
- Accesibilidad WCAG AA.

## No responsabilidades

- No decide permisos finales.
- No calcula permisos finales; consume permisos efectivos desde el API.
- No contiene reglas comerciales criticas.
- No llama NetSuite/Odoo directo.
- No llama legacy CRM directo.
- No guarda secretos.
- No usa estructuras legacy como contrato visual.
