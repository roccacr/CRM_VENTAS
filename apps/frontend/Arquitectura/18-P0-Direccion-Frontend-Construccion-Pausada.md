# 18 - P0 direccion frontend, construccion pausada

## Veredicto

Actualizacion de orden: este documento queda subordinado a `00-Producto-CRM-TINK-y-P0-Frontend.md` y `22-UX-Identidad-Usuarios-Roles-P0-S1.md`.

La primera pantalla ya no debe ser leads. La primera compuerta visual es identidad, usuarios, roles y permisos. El alcance de leads descrito aqui vuelve despues de cerrar esa compuerta.

El frontend P0 queda aprobado como herramienta operativa para ventas, no como landing page.

La primera pantalla comercial del corte P0-S1, despues de identidad, debe ser la lista operativa de leads. El dashboard de ventas con numeros accionables y listas filtradas entra en P0-S2. Todo texto visible para vendedores debe estar en espanol.

La fuente de verdad del primer corte ejecutable actual es `22-UX-Identidad-Usuarios-Roles-P0-S1.md`. El documento `20-Alcance-P0-Vertical-Leads-Frontend.md` aplica como corte comercial futuro despues de cerrar identidad.

Estado del runtime frontend:

- existe un esqueleto React/Vite minimo;
- se considera stub congelado;
- no prueba que el CRM este construido;
- no autoriza leads, dashboard ni administracion avanzada.

## Decisiones cerradas

| Tema | Decision P0 |
| --- | --- |
| Stack | React + Vite + TypeScript. |
| Server state | TanStack Query. |
| Estado UI local | Zustand solo para filtros, preferencias y layout. |
| Autenticacion | Microsoft Entra ID como principal; correo/clave como alternativa controlada por API. |
| Permisos visibles | Usar permisos efectivos devueltos por API. |
| Proveedores externos | No mostrar nombres ni payloads de proveedores en componentes, stores o formularios. |
| Primer modulo comercial | Ventas: listar leads, crear lead, detalle basico y timeline despues de cerrar identidad. Dashboard/pausa/perdida entran en P0-S2. |
| Idioma | Espanol Costa Rica. |
| Dashboard | Cada tarjeta debe abrir detalle filtrado o explicar el conteo. |
| Lead nuevo | Sale de nuevo cuando existe accion significativa. |
| Requiere atencion | Se muestra despues de 4 dias naturales sin accion significativa, sin evento pendiente, sin pausa y sin perdida. |
| Pausa | Requiere motivo y fecha futura. |
| Perdida | Requiere motivo y explicacion. |

## Pantallas P0 por slice

| Slice | Pantallas |
| --- | --- |
| P0-S1A | Identidad, usuarios, roles y permisos visuales minimos. |
| P0-S1B | Lista de leads, crear lead, detalle basico, timeline/bitacora basica. |
| P0-S2 | Dashboard de ventas, vista filtrada de nuevos/requieren atencion, pausa, reactivacion y perdida. |

## Fuera de P0

- Formalizaciones completas.
- Cobros.
- Modificaciones.
- Reporteria ejecutiva avanzada.
- Automatizaciones masivas.
- Integraciones directas desde componentes.
- Calendarios y notas adhesivas.

## Regla de UX

El vendedor no debe adivinar estados ni numeros. La pantalla debe mostrar:

```txt
numero -> definicion -> lista filtrada -> accion -> bitacora
```
