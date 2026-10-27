# 08 - Revision del Blueprint y Siguiente Paso Frontend

Estado implementado 2026-10-27: [30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md). Los ejemplos de fases futuras siguientes no sustituyen los reportes conectados ni los comandos acotados ya presentes.

## Vigencia documental - 2026-10-22, corte f2dc4f1

El veredicto inicial de identidad es historico. Ya existen Usuarios, Roles y seguridad, Auditoria y catalogos BFF. Actualizacion 2026-10-23: Formalizacion tiene aprobaciones y seis banners de etapas conectados; seguimiento/movimientos siguen indisponibles y las simulaciones quedan separadas. Mercadeo / Inicio consume resumen canonico de leads/citas disponibles. Inventario y pendientes: [27](27-Entrega-Administracion-y-QA.md). CRUD visual de leads sigue futuro.

## Veredicto historico de la compuerta inicial

Este veredicto conserva el corte inicial; el estado revisado figura arriba.

El frontend ya tiene runtime React/Vite creado dentro de `apps/frontend` y la compuerta de identidad conectada al BFF. Eso no autoriza construir pantallas comerciales todavia.

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

## Inventario historico previo a Administracion

Ya existe:

- Bootstrap Vite + React + TypeScript.
- `package.json` local del frontend.
- `pnpm-lock.yaml` local del frontend.
- Regla para bloquear uso de npm.
- Login local contra BFF con CSRF.
- Login Microsoft via API/BFF.
- Logout.
- Shell `/home/global` con sesion, usuario, roles, areas, permisos y foto/avatar.

No existia en ese corte (Usuarios y Roles ya implementados; Leads sigue futuro):

- CRUD real de usuarios;
- pantallas reales de roles/permisos;
- pantallas reales de leads.

## Siguiente paso propuesto en el corte inicial

El siguiente corte frontend debe salir de identidad hacia el primer alcance comercial solo cuando producto lo apruebe. Mientras tanto, se permite endurecer la compuerta de identidad:

- mantener login/logout/refresh visual;
- mejorar estados de sesion, error y permiso;
- consumir solo contratos aprobados por el API;
- no mostrar tarjetas, listas ni formularios de lead.

## Pantallas del corte inicial, no inventario vigente

- pantalla de login/estado de identidad;
- layout base;
- lectura de usuarios/roles/permisos devueltos por API sin CRUD real;
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

Luego debe mantener/evolucionar solo la compuerta de identidad con el menor alcance posible y dejar evidencia de:

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
