# 03 - UI UX CRM

## Principio

El CRM es una herramienta operativa, no una landing page. La pantalla principal debe ser util desde el primer segundo.

El idioma base de la interfaz es espanol para Costa Rica.

## Estilo

- Denso pero legible.
- Acciones claras.
- Tablas eficientes.
- Estados visuales sobrios.
- Componentes consistentes.
- Sin decoracion innecesaria.
- Sin layouts tipo marketing.

## Vistas principales

- Dashboard comercial.
- Lista de leads.
- Detalle de lead.
- Timeline de actividades.
- Calendario.
- Oportunidades.
- Reportes.
- Usuarios/roles.

## Dashboard ejecutivo

Cada numero mostrado al usuario debe poder explicarse.

Regla:

```txt
numero -> definicion -> filtro -> lista -> accion -> bitacora
```

Ejemplos:

- `Leads nuevos`: abrir lista de leads sin accion significativa.
- `Leads requieren atencion`: abrir lista con dias sin accion y ultima accion.
- `Eventos para hoy`: abrir calendario filtrado por usuario/dominio.
- `Leads perdidos`: abrir reporte por motivo, vendedor, proyecto y fecha.

No usar tarjetas que muestren numeros sin permitir drill-down o explicacion.

## Idioma y localidad

- Textos visibles en espanol.
- Fechas, horas y moneda alineadas a Costa Rica cuando aplique.
- Evitar terminos internos de NetSuite, Odoo o legacy en labels principales.
- Usar nombres comprensibles para vendedores, supervisores y gerentes.

## Tablas

Obligatorio:

- paginacion server-side;
- filtros server-side;
- ordenamiento server-side;
- columnas configurables;
- estados loading/empty/error;
- export controlado;
- no cargar miles de registros completos en navegador.

## Formularios

Obligatorio:

- React Hook Form;
- validacion clara;
- mensajes de error visibles;
- prevencion de doble submit;
- estados guardando/error;
- confirmacion de acciones sensibles.

## Accesibilidad

WCAG AA:

- contraste suficiente;
- focus visible;
- labels;
- navegacion por teclado;
- modales con foco controlado;
- botones con nombre accesible.
