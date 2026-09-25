# 02 - Arquitectura Frontend

## Estado de fase

Esta estructura describe el destino del frontend completo.

El alcance autorizado actual es menor:

```txt
compuerta visual de identidad -> luego pantallas comerciales
```

No crear carpetas comerciales de leads, calendario, notas, oportunidades, estimaciones u ordenes hasta que identidad quede cerrada y el alcance correspondiente este aprobado.

## Estructura esperada

```txt
src/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── data-table/
│   ├── forms/
│   └── feedback/
├── modules/
│   ├── sales/
│   │   ├── dashboard/
│   │   ├── leads/
│   │   ├── opportunities/
│   │   ├── estimates/
│   │   └── sales-orders/
│   ├── formalizations/
│   ├── collections/
│   ├── modifications/
│   ├── management/
│   ├── customer-journey/
│   ├── documents/
│   ├── calendar/
│   ├── notes/
│   ├── communications/
│   ├── reporting/
│   ├── permissions/
│   └── auth/
├── services/
│   ├── api/
│   ├── auth/
├── stores/
├── hooks/
├── routes/
├── styles/
└── types/
```

## Capas

| Capa | Responsabilidad |
|---|---|
| `components/ui` | Componentes atomicos reutilizables. |
| `components/data-table` | Tablas genericas server-side. |
| `components/forms` | Inputs y wrappers de formularios. |
| `modules/*` | Pantallas y flujos de negocio. |
| `services/api` | Cliente HTTP tipado. |
| `services/auth` | Helpers frontend de sesion visual aprobados. |
| `stores` | Estado UI ligero. |
| `hooks` | Composicion de logica UI. |

## Regla de dependencias

Componentes genericos no conocen modulos de negocio.

```txt
components/ui -> sin negocio
modules/sales/leads -> usa components y services
modules/sales/dashboard -> consume API, no calcula reglas finales
services/api -> contratos backend
modules/notes -> usa contratos canonicos, no proveedores externos
```

Regla de carpeta:

- `modules/sales/leads` contiene solo pantallas y flujos de leads de ventas;
- `modules/sales/opportunities` contiene oportunidades;
- `modules/sales/estimates` contiene estimaciones;
- `modules/sales/sales-orders` contiene ordenes de venta;
- `modules/formalizations` no se mezcla con ventas;
- `modules/calendar` muestra calendarios por dominio usando datos del API;
- `modules/notes` muestra notas persistidas en API;
- `services/api` es la unica entrada HTTP para datos CRM;
- `services/auth` solo maneja helpers frontend de sesion visual; login real, tokens, permisos y auditoria pasan por API/BFF.

Regla de proveedores:

- no existe `services/netsuite`;
- no existe `services/odoo`;
- no existe `services/kapso`;
- no existe `services/legacy-crm`;
- no existe `services/microsoft365` para reglas CRM.

Si un proveedor externo se agrega al producto, React no recibe adapter. React consume `services/api` y el backend decide que adapter usar.

## Estado

- TanStack Query: datos remotos.
- Zustand: filtros, preferencias, layout y UI.
- React local state: estado efimero de componente.

No usar Zustand como cache de API.

## Notas y anotaciones

Las notas adhesivas viven en `modules/notes`.

Reglas:

- usar Tiptap para contenido rico cuando se implemente el editor;
- usar dnd kit para mover/posicionar notas cuando la vista lo requiera;
- no llamar Kapso, Microsoft 365 ni correo desde componentes de notas;
- toda accion de comunicacion sale por `services/api`;
- leer `16-UX-Notas-Adhesivas-y-Anotaciones.md` antes de implementar pantallas de notas.
