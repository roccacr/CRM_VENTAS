# 20 - Alcance Futuro Vertical Leads Frontend

## Veredicto

Actualizacion de orden: este documento no autoriza pantallas de leads mientras identidad/usuarios/roles/permisos no este cerrado.

Leer primero `22-UX-Identidad-Usuarios-Roles-P0-S1.md`.

El primer desarrollo real actual del frontend es identidad. Este documento conserva el alcance comercial de leads para despues.

Cuando identidad este cerrada y el API apruebe contrato de lead, este documento servira como fuente de verdad del primer corte comercial.

## Objetivo

Construir la primera experiencia comercial usable despues de identidad:

```txt
listar leads -> crear lead -> ver detalle -> ver timeline
```

## Entra en slice comercial 1

1. Lista de leads desde API canonico.
2. Paginacion server-side.
3. Estados de carga, error y vacio.
4. Formulario de crear lead con campos canonicos.
5. Validacion de formulario.
6. Detalle basico del lead.
7. Timeline basico del lead.
8. Acciones visibles segun permisos efectivos devueltos por API.
9. Textos visibles en espanol Costa Rica.

## Entra en slice comercial 2

Despues de que Slice 1 funcione:

1. Dashboard de ventas con tarjetas accionables.
2. Leads nuevos.
3. Leads requieren atencion.
4. Pausar lead.
5. Reactivar lead.
6. Marcar perdido.
7. Drill-down de dashboard.

## Fuera del primer corte

- formalizaciones;
- cobros;
- modificaciones;
- calendarios;
- notas adhesivas;
- reporteria ejecutiva avanzada;
- llamadas directas a Microsoft Graph;
- llamadas directas a NetSuite, Odoo, Kapso o legacy CRM;
- calculo final de permisos en frontend.

## Regla de datos

El frontend consume y envia solo contrato canonico.

No se permite:

- nombres de proveedores externos;
- nombres legacy;
- payloads de ERP;
- reglas de autorizacion final;
- significados hardcodeados desde enteros legacy.
- ids externos como identidad principal de rutas, cache, detalle o acciones.

## Criterio de listo

El slice comercial 1 esta listo cuando:

1. La lista carga desde el API.
2. El formulario crea un lead.
3. El detalle muestra datos canonicos.
4. El timeline muestra `lead_created`.
5. No hay nombres de proveedor externo en componentes, stores, types ni services.
6. Rutas, query keys y acciones usan `publicId` canonico del CRM, no ids externos.
7. Typecheck y build pasan con pnpm desde `apps/frontend`.
