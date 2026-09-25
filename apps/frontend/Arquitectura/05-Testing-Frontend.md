# 05 - Testing Frontend

## Estrategia

Usar pruebas por riesgo:

- Unit/component tests para componentes criticos.
- Hook tests para logica reutilizable.
- Integration tests para formularios.
- Playwright para flujos principales.

## Prioridad P0

- Login.
- Lista de leads.
- Busqueda/filtros.
- Crear lead.
- Editar lead.
- Registrar actividad.
- Permisos visibles.
- Dashboard basico.

## Principio

Probar lo que el usuario ve y hace, no detalles internos.

## Accesibilidad

Los tests de componentes criticos deben validar:

- labels;
- botones accesibles;
- mensajes de error;
- foco en modales;
- estados disabled/loading.

## Mocks

Mockear API en capa de servicio, no dentro de componentes visuales base.
