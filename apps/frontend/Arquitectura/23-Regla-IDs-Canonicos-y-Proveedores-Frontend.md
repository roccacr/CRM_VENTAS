# 23 - Regla de IDs Canonicos y Proveedores Frontend

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
