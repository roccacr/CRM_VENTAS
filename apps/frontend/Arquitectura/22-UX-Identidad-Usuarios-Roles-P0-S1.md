# 22 - UX Identidad, Usuarios y Roles P0-S1

## Veredicto

La primera experiencia del frontend no debe ser ventas ni leads.

La primera compuerta visual de P0-S1 es identidad:

```txt
usuarios -> autenticacion -> areas/equipos -> roles -> permisos -> luego leads
```

Motivo: la UI no puede construir pantallas comerciales serias si antes no sabe quien entra, que rol tiene y que permisos efectivos devuelve el API.

## Alcance actual

Esta fase solo prepara la experiencia minima para:

- mostrar que el proyecto esta en compuerta de identidad;
- alinear la UI con Microsoft 365 / BFF;
- definir usuarios internos;
- definir estructura minima de areas/equipos;
- definir roles iniciales;
- definir permisos visibles basicos;
- evitar pantallas de leads antes de tiempo.

No autoriza crear flujo real de login, pantallas de administracion completas ni CRUD de usuarios hasta que el API apruebe el modelo fisico.

Fuente API obligatoria:

```txt
apps/api/Arquitectura/31-Contrato-Identidad-y-Permisos-P0-S1.md
apps/api/Arquitectura/33-Contrato-API-Identidad-P0-S1.md
```

Si este documento visual contradice el contrato API de identidad, gana el contrato API.

Contrato visual obligatorio:

```txt
24-Contrato-Visual-Identidad-P0-S1.md
```

Ese documento define pantallas permitidas, estados visuales, textos y limites antes de crear componentes.

## Pantalla inicial permitida

La pantalla inicial puede mostrar:

- nombre del sistema;
- estado de fase: identidad y acceso;
- pasos esperados: usuarios, autenticacion, areas/equipos, roles, permisos;
- mensaje claro de que leads viene despues.

No debe mostrar:

- tarjetas de leads;
- boton crear lead;
- dashboard de ventas;
- timeline de lead;
- calendario;
- oportunidades;
- ordenes de venta;
- contratos.

## Reglas de UI

- Todo texto visible debe estar en espanol.
- No usar nombres de NetSuite, Odoo, Kapso ni legacy.
- No guardar tokens en frontend.
- No calcular permisos finales en frontend.
- La UI solo muestra permisos efectivos cuando el API los devuelva.
- Si el API quita o rechaza un permiso, la UI debe actualizar el estado visible y no insistir en ejecutar la accion.
- Cualquier pantalla futura de usuarios o roles debe respetar `21-Seguridad-Autenticacion-BFF-y-Sesion.md`.
- Cualquier pantalla futura de permisos debe mostrar overrides y denegaciones como informacion explicable, no como reglas calculadas en frontend.
- Delegaciones temporales quedan previstas fuera de P0-S1A y no deben aparecer como flujo obligatorio inicial.

## Roles visibles iniciales

Los roles visibles de referencia son:

```txt
owner
jefe_general
gerente
supervisor
jefe_area
subjefe_area
vendedor
soporte_sistemas
```

No hardcodear estos roles como reglas de autorizacion final. Pueden usarse como texto de referencia mientras el API no exista.

## Jerarquia visual esperada

La UI futura debe poder mostrar la estructura de la empresa como arbol.

Ejemplo:

```txt
jefe_general
├── jefe_formalizacion
│   └── empleados
├── jefe_contabilidad
│   └── empleados
└── jefe_mercadeo
    └── subjefe_mercadeo
        └── empleados
```

La pantalla no debe confundir rol con area.

Regla visual:

```txt
rol = accion permitida
area/equipo = alcance de datos y personas
```

El jefe general puede ver todas las areas solo si el API devuelve ese alcance.

Un jefe de area o subjefe solo debe ver lo que el API indique como alcance efectivo.

Un mismo usuario puede tener varias areas asignadas. La UI debe permitir mostrar esa situacion sin duplicar personas.

Ejemplo:

```txt
Maria
rol: jefe_area
areas: mercadeo, formalizacion
```

En ese caso, Maria puede aparecer como responsable en mas de una rama del arbol organizacional, pero sigue siendo una sola usuaria.

La UI debe evitar textos o pantallas que den a entender que un usuario solo puede pertenecer a una unica area.

## Criterio de salida

Se puede volver al flujo visual de leads cuando:

- el documento API `27-Identidad-Usuarios-Roles-P0-S1.md` este aprobado;
- el documento API `31-Contrato-Identidad-y-Permisos-P0-S1.md` este aprobado;
- exista contrato minimo de sesion/usuario actual;
- existan roles iniciales aprobados;
- exista estructura minima de areas/equipos aprobada;
- existan permisos minimos aprobados;
- el frontend sepa consumir permisos efectivos sin guardar tokens.
