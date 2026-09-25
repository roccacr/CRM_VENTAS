# 08 - Revision del Blueprint y Siguiente Paso Frontend

## Veredicto

Este documento queda actualizado al estado real del proyecto.

El frontend ya tiene esqueleto React/Vite creado dentro de `apps/frontend`. Eso no autoriza construir pantallas comerciales todavia.

La conclusion practica actual es:

```txt
no mas pantallas de leads hasta cerrar identidad, usuarios, roles y permisos
```

La primera experiencia permitida no es ventas. Es una pantalla/flujo minimo de compuerta de identidad alineada con el contrato del API.

## Lo que el analisis entendio correctamente

- El frontend debe ser una herramienta de trabajo, no una landing page.
- La pantalla inicial debe dejar claro en que fase esta el sistema.
- El estado remoto debe vivir en TanStack Query.
- Zustand debe quedar limitado a estado de UI.
- La UI no debe consumir NetSuite, Odoo ni legacy directo.
- Los permisos visibles en pantalla no reemplazan la autorizacion del backend.
- Tablas, filtros, busqueda y seguimiento seran el centro comercial despues de cerrar identidad.

## Estado actual

Ya existe:

- Bootstrap Vite + React + TypeScript.
- `package.json` local del frontend.
- `pnpm-lock.yaml` local del frontend.
- Regla para bloquear uso de npm.

No existe todavia:

- contrato API ejecutable de sesion/usuario actual;
- login real con Microsoft/BFF;
- CRUD real de usuarios;
- pantallas reales de roles/permisos;
- pantallas reales de leads.

## Siguiente paso permitido

El siguiente corte frontend debe ser una compuerta visual minima de identidad:

- mostrar estado del proyecto: identidad y acceso;
- preparar layout base sin datos comerciales;
- mostrar pasos: usuarios, autenticacion, areas/equipos, roles y permisos;
- consumir solo contratos aprobados por el API cuando existan;
- no mostrar tarjetas, listas ni formularios de lead.

## Pantallas permitidas ahora

- pantalla de estado de identidad;
- layout base;
- placeholders de usuarios/roles/permisos sin CRUD real, si el API aun no existe;
- mensajes claros de "leads viene despues".

No permitidas ahora:

- lista de leads;
- crear lead;
- detalle de lead;
- timeline de lead;
- dashboard de ventas;
- calendario;
- notas adhesivas.

## Regla para el siguiente agente

El siguiente agente no debe comenzar creando mas teoria. Debe leer:

1. `AGENTS.md`
2. `.codex/skills/`
3. `Arquitectura/01-Resumen-Frontend.md`
4. `Arquitectura/02-Arquitectura-Frontend.md`
5. `Arquitectura/03-UI-UX-CRM.md`
6. `Arquitectura/04-API-Client-y-Estado.md`
7. Este documento.

Luego debe construir solo la compuerta visual de identidad con el menor alcance posible y dejar evidencia de:

- comandos ejecutados;
- archivos creados;
- pruebas realizadas;
- decisiones que cambiaron el blueprint.

## Decision

El proyecto frontend debe avanzar de forma controlada dentro de:

```txt
apps/frontend
```

No se debe crear codigo en la raiz del proyecto. Todo lo del frontend vive dentro de `apps/frontend`.

Antes de implementar leads, leer y cerrar:

```txt
00-Producto-CRM-TINK-y-P0-Frontend.md
22-UX-Identidad-Usuarios-Roles-P0-S1.md
apps/api/Arquitectura/31-Contrato-Identidad-y-Permisos-P0-S1.md
```
