# 09 - Decisiones P0 UX, Permisos y Preguntas Pendientes

## Decisiones confirmadas

1. La UI sera en espanol.
2. La localidad principal es Costa Rica.
3. Los usuarios entraran con cuenta Microsoft o con correo y clave, segun la politica que se confirme en el API.
4. El frontend no decide permisos finales.
5. El frontend consume permisos efectivos desde el API.
6. El frontend no debe saber si un lead viene de la base nueva o del CRM legacy.
7. En P0 el flujo principal trabajara leads nuevos de la base nueva.
8. En P1 el API podra devolver registros normalizados desde la base nueva y desde legacy.
9. El frontend nunca debe usar nombres de NetSuite/Odoo/legacy en formularios, stores o clientes API.
10. El frontend envia JSON canonico del CRM; el API se encarga de mapearlo al proveedor externo activo.
11. El frontend usa `publicId` canonico del CRM para rutas, cache, detalle y acciones; nunca ids externos como identificadores principales.

## Permisos visibles

El API debe exponer al frontend una respuesta tipo:

```txt
MeResponse
├── usuario
├── roles
├── permisosEfectivos
├── sucursal/equipo si aplica
└── restricciones visibles
```

El frontend usa esa respuesta para:

- mostrar botones;
- ocultar acciones no disponibles;
- deshabilitar controles;
- explicar restricciones;
- ajustar menus.

El frontend no calcula permisos por su cuenta.

## Integraciones externas

La UI no sabe si el backend sincroniza con NetSuite, Odoo u otro sistema.

Reglas:

- no mostrar campos tecnicos de ERP salvo que el API los exponga como dato de negocio normalizado;
- no nombrar variables, tipos o formularios con `netsuite`, `odoo` o nombres legacy;
- no construir payloads de ERP;
- no decidir proveedor activo;
- no guardar ids externos como ids principales de UI.
- no usar ids externos para relacionar vendedor, lead, oportunidad, estimacion, orden o contrato.

## Preguntas criticas para UI P0

1. Cuales son los roles que deben aparecer en la primera version?
2. Que acciones necesita ver un vendedor en la pantalla de leads?
3. Que acciones necesita ver un supervisor?
4. Que acciones necesita ver un gerente?
5. Que texto exacto se usara para estados de leads?
6. Que campos debe ver un vendedor en la tabla principal?
7. Que campos solo deben ver supervisor/gerente?
8. El login por correo y clave sera visible junto al boton de Microsoft o solo como alternativa secundaria?
9. Que debe pasar si un usuario Microsoft existe en Entra pero no tiene permisos en el CRM?
10. Que mensaje debe ver un usuario cuando no tiene permiso para una accion?

## Preguntas importantes para UX

1. Se requiere filtro por sucursal en P0?
2. Se requiere filtro por vendedor en P0?
3. Se requiere exportar leads en P0?
4. Se requiere dashboard en P0 o basta con lista de leads?
5. Se requiere modo movil para vendedores desde el primer corte?
6. Se requiere calendario desde P0 o P1?
7. Se debe mostrar el origen del dato: nuevo CRM vs legacy, o debe quedar oculto?

## Regla para implementacion

Construir primero una experiencia operativa minima:

- login;
- layout principal;
- lista de leads;
- crear lead;
- detalle de lead;
- timeline de actividades;
- permisos visibles desde `/me`.

No construir landing page, reporteria avanzada ni calendario antes de cerrar ese flujo.
