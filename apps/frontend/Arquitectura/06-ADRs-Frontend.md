# 06 - ADRs Frontend

## ADR-FE-001 - React + Vite

Estado: aprobado.

Decision: usar React + Vite + TypeScript.

Motivo: velocidad de desarrollo, ecosistema maduro y buen encaje con CRM interno.

## ADR-FE-002 - TanStack Query

Estado: aprobado.

Decision: usar TanStack Query para estado remoto.

Motivo: cache, invalidacion, paginacion, mutaciones y sincronizacion con backend.

## ADR-FE-003 - Zustand

Estado: aprobado.

Decision: usar Zustand solo para estado UI ligero.

Motivo: mantener separado el estado remoto del estado visual/local.

## ADR-FE-004 - Tailwind + shadcn/Radix

Estado: aprobado con cautela.

Decision: usar Tailwind y componentes accesibles source-code cuando aplique.

Motivo: control visual, accesibilidad y consistencia.

Restriccion: revisar cualquier comando de la skill `shadcn` antes de ejecutarlo.

## ADR-FE-005 - Frontend no decide permisos finales

Estado: aprobado.

Decision: frontend puede ocultar acciones, pero backend siempre valida.

Motivo: evitar broken access control.
