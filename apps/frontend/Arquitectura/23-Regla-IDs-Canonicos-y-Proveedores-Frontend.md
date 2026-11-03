# 23 - Regla de IDs Canonicos y Proveedores Frontend

## Actualización contrastada — 03/11/2026

El perfil y calendario contextual usan identidad compuesta source/id autorizada. `/home/formalization/perfil` valida native ULID o legacy decimal; no crea relaciones por nombre/correo. La orden contextual obtiene su cliente de lookup y conserva ambas identidades bloqueadas. El feed Outlook puede entregar IDs y versiones remotas como metadatos BFF para correlación/concurrencia; no convierten Graph en autorización CRM. La proyección NetSuite actual sí alimenta capítulos confirmados de la ficha: el párrafo DEV inferior es un antecedente. Ver [30](30-Estado-Frontend-Verificado.md).

## Identidades compuestas vigentes - 2026-11-02

Las referencias de registros relacionados en notas/calendario contienen
tipo + `native|legacy` + ID. Un publicId nativo y la PK legacy no se intercambian
por coincidir en texto ni se unen por nombre. El API confirma aliases y conserva
el contexto principal; el selector muestra nombres/folios autorizados, sin pedir
la BD al usuario. `netsuiteId` es referencia del proveedor, no ID de la nota,
cliente, evento u orden CRM. La misma orden puede aparecer en otro contexto sin
duplicar la conversación si el lector conserva ACL y permiso comercial.

`netsuite-primary.ts` transforma solo capítulos confirmados de una lectura BFF
ya autorizada; no hace al proveedor la identidad general de UI ni autoriza un
SDK, secretos, consulta directa o escritor. Detalle: [30](30-Estado-Frontend-Verificado.md).

Estado implementado 2026-10-27: [30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md). Los ejemplos de fases futuras siguientes no sustituyen los reportes conectados ni los comandos acotados ya presentes.

## Vigencia documental - 2026-10-22, corte f2dc4f1

Regla vigente de identidad canonica y privacidad de integraciones. Los nombres comerciales de ejemplo no acreditan rutas instaladas. Referencias externas autorizadas de Administracion son datos de soporte, no identidad principal ni seleccion del proveedor activo; el core backend conserva contratos neutrales.

## Veredicto

El frontend nunca usa ids de NetSuite, Odoo, legacy CRM, Kapso u otro proveedor para relacionar datos, navegar pantallas o ejecutar acciones.

La UI trabaja con identidad canonica del CRM:

```txt
publicId
leadPublicId
userPublicId
opportunityPublicId
estimatePublicId
salesOrderPublicId
contractPublicId
```

El backend resuelve los ids externos.

## Regla obligatoria

```txt
frontend = contratos canonicos CRM
backend = resolucion de proveedor externo
```

La UI no sabe si el registro esta sincronizado con NetSuite, Odoo u otro proveedor.

## Prohibido

Queda prohibido en componentes, stores, services y types:

- `netsuiteId`;
- `odooId`;
- `legacyId`;
- `idnetsuite`;
- `providerPayload`;
- usar ids externos como ruta principal;
- usar ids externos para abrir detalle de lead;
- usar ids externos para asignar vendedor;
- usar ids externos para avanzar oportunidad, estimacion u orden.

## Permitido

Aplicacion al runtime 2026-10-23: Administracion muestra referencias externas autorizadas y Pendiente de migracion cuando no existe identidad nativa. Mercadeo recibe claves opacas de agrupacion y `publicId` nullable, sin resolver proveedores en React. Una clave de resumen no habilita detalle/mutacion ni se presenta como publicId CRM; fotos locales solo cuando existe publicId. Estas fronteras no modifican la identidad canonica exigida para futuras acciones.

Esta permitido:

- mostrar estado funcional de sincronizacion si el API lo entrega en lenguaje CRM;
- mostrar mensajes como "Pendiente de sincronizacion" o "Sincronizado";
- enviar `publicId` canonico del CRM;
- recibir datos canonicos del API.

## Ejemplo correcto

```txt
/leads/{leadPublicId}
ownerUserPublicId
salesOrderPublicId
```

## Ejemplo incorrecto

```txt
/leads/netsuite/12345
ownerNetSuiteId
odooSalesOrderId
```

## Regla de UX

El usuario vendedor o jefe no debe ver nombres tecnicos del proveedor externo como parte normal del flujo.

Si soporte necesita ver una referencia externa, debe ser una vista tecnica con permiso especifico, no la pantalla principal de ventas.

## Fuente API

La regla backend que manda es:

```txt
apps/api/Arquitectura/30-Identidad-Canonica-y-Referencias-Externas.md
```

## Excepción de inspección DEV de orden - 2026-10-27

`useNetsuiteOrderConsole` utiliza source/id de una fila canónica autorizada para
solicitar al BFF la inspección de la orden. El ERP no se consulta directamente
desde React; la respuesta queda en consola DEV y no alimenta la ficha. Las claves
orderSource/orderId/netsuiteId de URL son diagnóstico acotado, no identidad global
de un nuevo CRUD ni autorización para persistir payloads. Ver [30](30-Estado-Frontend-Verificado.md).
