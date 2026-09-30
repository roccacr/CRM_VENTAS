# 14 - Modularizacion Frontend por Areas y Roles

## Veredicto

El frontend debe organizarse por contextos operativos, areas de trabajo y flujos de usuario, no como una sola carpeta gigante de CRM.

Cada area debe tener su propia carpeta, pantallas, componentes de negocio, hooks, tipos y documentacion.

Solo lo que realmente usan varios modulos debe vivir en carpetas compartidas.

Regla clave:

```txt
No se duplica una aplicacion completa por cada rol. Se define un home/menu por contexto operativo y el API decide que contextos recibe cada usuario.
```

## Fuentes internas revisadas

### CRM IDEA.pdf

Plantea la vision completa:

- ventas;
- formalizaciones;
- cobros;
- asesoria de modificaciones;
- documentos;
- calendario;
- correo;
- WhatsApp;
- historico de acciones;
- reporting;
- expediente vivo de la compra.

### RESUMEN_EJECUTIVO_CRM_TINK AJUSTADO (1).pdf

Reduce el alcance inicial:

- primera entrega enfocada en Formalizaciones;
- Cobros y Modificaciones quedan para fases posteriores;
- el ERP/sistema externo mantiene cobros;
- contrato se adjunta/envia desde CRM;
- KPIs al final de Formalizaciones;
- objetivo: abrir una orden aprobada y conocer avance de contrato, firma, banco, traspaso, documentos, responsable y bloqueo.

## Estructura esperada

```txt
src/
+-- app/
+-- components/
|   +-- ui/
|   +-- layout/
|   +-- data-table/
|   +-- feedback/
+-- modules/
|   +-- sales/
|   +-- marketing/
|   +-- formalizations/
|   +-- collections/
|   +-- modifications/
|   +-- management/
|   +-- support/
|   +-- customer-journey/
|   +-- documents/
|   +-- calendar/
|   +-- communications/
|   +-- reporting/
|   +-- auth/
|   +-- permissions/
+-- services/
|   +-- api/
|   +-- auth/
+-- stores/
+-- hooks/
+-- types/
```

## Regla de separacion

Cada modulo de `src/modules/*` puede tener:

```txt
components/
pages/
hooks/
queries/
mutations/
schemas/
types/
utils/
docs/
```

Regla:

- si un componente solo sirve para Formalizaciones, vive en `modules/formalizations`;
- si un hook solo sirve para vendedores, vive en `modules/sales`;
- si una vista solo sirve para mercadeo, vive en `modules/marketing`;
- si una vista solo sirve para soporte/TI, vive en `modules/support`;
- si algo es visual y generico, vive en `components/ui`;
- si algo es una consulta de API de un dominio, vive en `modules/<dominio>/queries`;
- si algo aplica a permisos globales, vive en `modules/permissions` o `services/auth`;
- si algo aplica a todos los formularios, vive en `components/forms` o `hooks`;
- no crear `helpers` globales con reglas de negocio de un modulo.

## Home y menu por contexto operativo

Cada contexto operativo puede tener:

```txt
home/
routes/
navigation/
components/
hooks/
queries/
mutations/
schemas/
types/
docs/
```

`home` es la primera vista despues del login para ese contexto.

`navigation` define el menu visible de ese contexto, pero nunca autoriza acciones por si solo.

Regla:

- el menu se construye desde permisos efectivos y alcance recibidos del API;
- el menu puede ocultar acciones por UX;
- toda accion real vuelve al API y el API valida de nuevo;
- si cambia `permissionVersion`, la UI limpia cache y obliga login nuevo segun la regla BFF;
- si el usuario tiene varios contextos, el shell muestra selector de contexto;
- si el usuario tiene un solo contexto, entra directo a su home;
- si ningun contexto esta disponible, se muestra estado bloqueado/sin permisos.

Regla de configuracion visual:

- cada modulo/contexto define sus opciones de menu en una estructura de datos con `code`, texto visible, descripcion y permiso futuro esperado;
- agregar o quitar una opcion debe modificar esa configuracion, no duplicar componentes ni condicionales sueltos;
- la configuracion del frontend es presentacional: los contextos y permisos reales siempre vienen del API.
- el selector superior representa los perfiles/contextos asignados al usuario; cambiarlo actualiza el menu visible del shell;
- `Todos` puede existir como perfil visual de revision global durante la maqueta; al conectar API solo se muestra para TI/jefatura global si el backend lo autoriza;
- `CRM Tink` es un contexto propio y su menu visual base contiene Leads, Calendario Outlook, Expedientes, Lista de Eventos, Reporte de Comisiones, Oportunidades, Ordenes de Venta y Tickets;
- otros perfiles pueden tener menus distintos, pero solo se muestran si el API los devuelve como contextos/permisos efectivos cuando exista conexion real.

Ejemplos:

| Usuario autenticado | Contextos posibles | Comportamiento visual |
| --- | --- | --- |
| Vendedor | `sales` | Entra al home de ventas. |
| Finanzas/cobros | `collections` | Entra al home financiero cuando ese modulo se apruebe. |
| Mercadeo | `marketing` | Entra al home de mercadeo cuando ese modulo se apruebe. |
| Formalizaciones | `formalizations` | Entra al home de formalizaciones cuando ese modulo se apruebe. |
| Jefatura superior | `management` + contextos supervisados | Ve home de gestion y accesos a contextos permitidos. |
| TI/soporte | `support` + contextos autorizados | Puede cambiar de contexto solo si el API lo permite. |
| Persona con mercadeo y formalizaciones | `marketing`, `formalizations` | Ve selector y menus separados para ambos contextos. |

Anti-regla:

```txt
No crear `modules/vendedor`, `modules/jefe_mercadeo`, `modules/subjefe_formalizacion` si esos nombres solo cambian permisos sobre el mismo flujo.
```

Se crea modulo nuevo solo cuando existe dominio/home propio, lenguaje propio, menu propio o flujo operativo propio.

## Integraciones y proveedores

NetSuite, Odoo, Kapso, Microsoft 365 y CRM viejo se tratan como proveedores del backend.

En frontend:

- no existe `services/netsuite`;
- no existe `services/odoo`;
- no existe `services/kapso`;
- no existe `services/legacy-crm`;
- no existe adapter Microsoft Graph para reglas CRM.

Si se aprueba una pantalla visual de integraciones, debe vivir como modulo CRM canonico, por ejemplo `modules/management/integrations` o `modules/support/integrations`, y consumir solo `services/api`.

Esa pantalla puede mostrar estado, errores, ultima sincronizacion o acciones autorizadas, pero no contiene SDKs ni payloads crudos de proveedor.

## Modulos frontend

### sales

Usuarios principales:

- vendedores;
- supervisores de ventas;
- gerencia comercial.

Responsabilidad:

- leads;
- seguimiento;
- oportunidades;
- estimaciones;
- ordenes de venta;
- estado visible del lead;
- pipeline comercial;
- acciones comerciales antes de Formalizaciones.

No debe contener:

- pantallas internas de formalizacion bancaria;
- cobros;
- extras;
- revision fisica;
- entrega de llaves.

### marketing

Usuarios principales:

- mercadeo;
- jefatura comercial autorizada;
- gerencia con permisos de supervision.

Responsabilidad futura:

- campanas;
- origenes;
- captacion;
- calidad de fuentes;
- reportes de entrada;
- acciones de marketing aprobadas por API.

No debe contener:

- seguimiento operativo completo de vendedores;
- reglas de autorizacion final;
- llamadas directas a Kapso, Meta, Google, Microsoft o proveedores externos.

### formalizations

Usuarios principales:

- formalizadoras;
- jefatura;
- gerencia con vista de supervision.

Responsabilidad P0:

- backlog de ordenes aprobadas;
- contratos pendientes;
- contrato adjunto;
- envio de contrato;
- contrato firmado;
- modalidad de compra;
- banco;
- asesor bancario;
- gestion bancaria;
- traspaso;
- cierre de Formalizaciones;
- excepciones autorizadas.

Pantallas iniciales:

```txt
FormalizationsDashboard
FormalizationCaseDetail
ContractPanel
BankFormalizationPanel
TransferPanel
FormalizationTimeline
FormalizationReports
```

### collections

Usuarios principales:

- cobros;
- jefatura financiera;
- gerencia.

Responsabilidad futura:

- prereservas;
- proximos a vencer;
- pagos vencidos;
- fideicomisos;
- extras pendientes;
- condicion 100% cancelada;
- estado financiero visible.

P0:

- no construir flujo completo;
- solo preparar arquitectura y contratos si Formalizaciones necesita condicion minima.

### modifications

Usuarios principales:

- asesoras de modificaciones;
- operaciones/construccion cuando aplique;
- jefatura.

Responsabilidad futura:

- bienvenida;
- reunion de extras;
- boletas versionadas;
- extras aprobadas;
- visitas de obra;
- revision fisica;
- unidad aceptada;
- entrega de llaves.

### management

Usuarios principales:

- jefe;
- gerente;
- administradores autorizados.

Responsabilidad:

- aprobaciones;
- excepciones;
- supervision de todas las areas;
- reasignaciones;
- permisos delegados;
- indicadores.

Regla:

`management` no debe duplicar las pantallas operativas de cada area. Debe mostrar resumen, decisiones pendientes y enlaces al detalle del modulo propietario.

### customer-journey

Responsabilidad:

- vista integral del expediente;
- donde esta la compra;
- que area tiene la siguiente accion;
- que condicion bloquea el avance;
- timeline consolidado.

Regla:

Debe leer datos compuestos del API. No debe implementar reglas internas de Formalizaciones, Cobros o Modificaciones.

### documents

Responsabilidad:

- lista de documentos;
- adjuntar contrato;
- adjuntos OneDrive;
- respaldo de aprobaciones;
- comprobantes;
- version de boleta.

### calendar

Responsabilidad:

- calendario de ventas separado para eventos de leads;
- calendario de Formalizaciones separado para contrato, firma, banco y traspaso;
- calendarios futuros de Cobros y Modificaciones;
- vista consolidada de Jefatura/Gerencia segun permisos efectivos;
- eventos del CRM;
- firma bancaria;
- reunion de extras;
- visitas;
- entrega;
- reprogramaciones.

Regla:

El calendario de vendedores no debe mezclarse con los calendarios de otros departamentos. Si Jefatura necesita ver varias areas, debe usar una vista consolidada con filtros por area, equipo, usuario, tipo de evento y permisos.

### communications

Responsabilidad:

- plantillas;
- envio de correo;
- WhatsApp;
- historial de comunicaciones;
- estado de envio.

## Navegacion recomendada

```mermaid
flowchart TD
  Home[Dashboard principal] --> Sales[Ventas]
  Home --> Formal[Formalizaciones]
  Home --> Mgmt[Jefatura]
  Home --> Journey[Expediente integral]
  Home --> Reports[Reporteria]
  Formal --> Contracts[Contratos]
  Formal --> Bank[Banco]
  Formal --> Transfer[Traspaso]
  Journey --> Docs[Documentos]
  Journey --> Timeline[Timeline]
  Journey --> Calendar[Calendario]
```

## P0 UX de Formalizaciones

```mermaid
flowchart LR
  A[Orden aprobada] --> B[Backlog]
  B --> C[Adjuntar contrato]
  C --> D[Enviar contrato]
  D --> E[Contrato firmado]
  E --> F[Banco/modalidad]
  F --> G[Traspaso]
  G --> H[Cierre Formalizaciones]
```

## Banners P0 Formalizaciones

```txt
Contratos pendientes
Contratos enviados pendientes de firma
Formalizacion bancaria sin iniciar
Formalizacion bancaria en proceso
Pendientes de traspaso
Traspaso pendiente autorizado
Cerrados por Formalizaciones
```

Cada banner debe tener:

- contador;
- filtros;
- tabla;
- responsable;
- antiguedad;
- siguiente accion;
- indicador de bloqueo;
- acceso al expediente.

## Regla de lenguaje para usuarios normales

La UI debe explicar estados con palabras claras:

```txt
Contrato pendiente
Contrato enviado
Contrato firmado
Banco sin iniciar
Banco en proceso
Credito formalizado
Pendiente de traspaso
Traspaso realizado
Cerrado por Formalizaciones
```

Evitar:

```txt
estado_formalizacion = 3
flag_reserva = 1
id_estado = 7
```

## Hooks y componentes compartidos

Compartido permitido:

```txt
useDebouncedSearch
useTableState
useCurrentUser
useEffectivePermissions
useToast
useDialogState
PermissionGate
DataTable
DateRangeFilter
StatusBadge
Timeline
DocumentList
```

No compartir:

```txt
useFormalizationBankRules
useSalesLeadTransitionRules
useCollectionsPaymentRules
useModificationExtrasRules
```

Esos hooks pertenecen a su modulo.

## Relacion con API

El frontend no inventa reglas.

El API debe entregar:

- estados permitidos;
- acciones permitidas;
- permisos efectivos;
- motivos por vista;
- datos del expediente;
- timeline;
- bloqueos;
- siguiente accion recomendada cuando aplique.

El frontend renderiza y ejecuta mutaciones canonicas.

## Fases

### P0/P1 - Formalizaciones

Construir:

- dashboard formalizaciones;
- detalle de caso;
- contrato adjunto;
- envio de contrato;
- firma;
- banco;
- traspaso;
- timeline;
- KPIs minimos.

### P2 - Cobros

Preparar despues:

- prereservas;
- vencimientos;
- pagos;
- fideicomisos;
- extras financieros;
- condicion 100% cancelada.

### P3 - Modificaciones

Preparar despues:

- bienvenida;
- extras;
- versiones;
- visitas;
- revision fisica;
- entrega de llaves.

## Preguntas abiertas

Estas preguntas no bloquean la modularizacion:

1. Cuales columnas exactas necesita la tabla de Formalizaciones P0?
2. Que filtros debe usar Jefatura por defecto?
3. Que texto final tendran los botones de contrato?
4. Que pantallas deben ser visibles para vendedor solo en modo consulta?
5. Que datos minimos del ERP/sistema externo se muestran en Formalizaciones?
