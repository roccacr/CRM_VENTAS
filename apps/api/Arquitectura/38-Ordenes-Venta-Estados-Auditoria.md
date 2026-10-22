# Ordenes de venta: esquema y trayectoria - 20/10/2026

## Regla funcional confirmada por el propietario - 2026-10-22

- Con Aprobacion Jefe de Ventas, Aprobacion Formalizacion y Aprobacion Desarrolladora aprobadas, la orden inicia el ciclo CRM en Contratos pendientes / Por enviar. Este cambio de etapa es interno del CRM: no ordena actualizar un check del ERP.
- La existencia de la identidad de orden en `CRM_THINK_V2` decide la autoridad de gestion. Si existe, gestionar exclusivamente en nativo; no modificar su contraparte en `crmdatabase-api`. Si no existe, la gestion e historial permanecen en legacy. No es escritura simultanea a ambas BD ni promocion automatica obligatoria.
- Correlacionar con la identidad legacy `id_ov` conservada en la referencia de migracion; los IDs o numeros de NetSuite/Odoo no sustituyen esa correspondencia. Una identidad nativa existente no debe volver a legacy por error de lectura, estado inactivo o error de escritura. Ante indisponibilidad no inferir ausencia ni usar fallback de escritura.
- Conservar auditoria de actor, origen, momento y transicion en la fuente autoritativa. No inventar trayectoria anterior al estado observado. La aplicacion concreta requiere controlar concurrencia entre migracion y mutaciones para no escribir en ambas fuentes.

Esta confirmacion define el ingreso y la autoridad de escritura; no acredita endpoints, cambios de checks, SQL/021 aplicado en legacy ni operaciones productivas ejecutadas. Las compuertas actuales siguen vigentes. Las reglas posteriores de firma, banco, saldo, llaves y cierre siguen pendientes de confirmacion. El contador de pendientes de aprobacion conserva su criterio anterior: Jefatura/Desarrolladora aprobadas y Formalizacion sin aprobar.

Estado documental 2026-10-22: nueve tablas de lifecycle/auditoria/referencias y persistencia interna, sin rutas HTTP de mutacion. Existe el contador real `GET /formalization/approvals/summary` descrito al final; sustituye el escenario local solo para ese indicador. Las aprobaciones son independientes de las etapas. Conteos, ejecuciones de migraciones, errores de conexion y pruebas fechadas son evidencia historica; SQL/021 no se ejecuto en esta revision. Ver [36 - Registro vigente](36-Registro-Entrega-Administracion.md) y [reauditoria](Reauditoria-54-Plan-y-Resultados.md).

## Resultado historico de la entrega 2026-10-20

- Nueva estructura aplicada en CRM_THINK_V2 mediante migraciones 202610200021 y 202610200022.
- Nueve tablas nuevas, nueve estados de referencia y tres tipos de aprobacion.
- Produccion crmdatabase-api: NO aplicada. Conexion existente crm_think_v2_legacy_reader rechaza CREATE/INSERT/UPDATE (1142/42000).
- El usuario eligio que un DBA ejecute Arquitectura/SQL/021_legacy_sales_order_state_additive.sql.
- No se modifica, renombra, elimina ni rellena ordenventa; sin triggers ni cambios al API viejo.
- Lectura antes/despues: 460 ordenes; 2 cumplen el criterio de pendientes de aprobacion.
- Ninguna orden real importada. Pruebas de persistencia usan rollback y dejan cero ordenes/eventos nuevos.
- El banner y la UI siguen con escenarios locales; no representan el conteo real.
- Este corte autoriza esquema y persistencia interna. No expone endpoints comerciales ni otorga permisos de aprobar.

## Evidencia del mapeo

Fuente leida: archivo salesorders.js entregado por el usuario (Estados_Aprobaciones).
Solo se inspecciono; no se ejecutaron llamadas a NetSuite ni escrituras del archivo.
Desarrolladora = aprobacion__rdr_ov = custbodyid_firma_rocca.
Jefatura = chekJefeVenta = custbody_aprueba_jefe_ventas.
Formalizacion = aprobacion_forma_ov = custbodyid_firma_rc.
El archivo viejo convierte todo lo distinto a T en cero. El nuevo mapper no hereda
esa perdida: valores desconocidos son unknown, nunca una aprobacion implicita.

## Estructura

crm_sales_order solo contiene identidad y hechos comerciales confirmados.
No almacena el estado actual de formalizacion como columna editable duplicada.
crm_sales_order_external_reference permite varios proveedores simultaneos y
evita duplicados por sistema/id. int_external_system identifica una cuenta de
proveedor: registrar cuentas distintas como sistemas diferentes si sus IDs colisionan.
Las relaciones internas usan PK propias. El id de produccion es un alias unico nullable.

crm_sales_order_approval proyecta el resultado actual de cada una de las tres
aprobaciones. audit_sales_order_approval_event conserva cada antes/despues y actor.
audit_sales_order_state_event es el recorrido de la orden; estado actual = ultimo
numero de secuencia de esa orden, no ultima fecha arbitraria.
audit_sales_order_change queda disponible para auditoria de campos comerciales.
int_sales_order_source_snapshot retiene los campos sin interpretar y la evidencia
original de importacion. No reemplaza columnas normalizadas ni debe exponerse
completo al frontend: contiene referencias/datos de cliente.

## Estados y limites

| Codigo | Nombre |
|---|---|
| unclassified | Sin etapa confirmada |
| pending_approval | Pendientes de aprobacion |
| contract_pending_send | Contrato por enviar |
| contract_pending_signature | Contrato pendiente de firma |
| bank_management | Gestion bancaria |
| pending_balance | Pendientes de saldo |
| pending_transfer | Traspasos pendientes |
| transfer_signed | Traspaso firmado |
| closed | Formalizacion cerrada |

El orden del catalogo es de presentacion, no una matriz autorizada de transiciones.
Gestion bancaria conserva la distincion futura sin iniciar/en proceso para definir
en el siguiente contrato operativo. No se crean fechas de hitos sin evidencia.
Firma de contrato no equivale a firma de traspaso. Cierre requiere validar las
reglas de saldo/traspaso/llaves antes de habilitar endpoints de operacion.
Si no puede demostrarse una etapa, importar unclassified; no inferir estados
avanzados desde tres checks comerciales o desde una maqueta.
El candidato pending_approval requiere active, cancelled=no, developer=approved,
sales_management=approved y formalization=not_approved.

## Trayectoria, idempotencia y tiempo

Cada visita tiene secuencia propia, anterior/nuevo, actor, nombre/roles capturados,
motivo, origen, operationId y correlationId. Un regreso a una etapa agrega evento.
La persistencia bloquea la orden con SELECT FOR UPDATE y compara expectedSequence
o expectedVersion. Un reintento con el mismo operationId y contenido no duplica;
reutilizarlo con otro contenido genera conflicto.
La aprobacion actual y su auditoria se escriben en una misma transaccion.
Los historiales no tienen metodos update/delete en el repositorio. El bloqueo
append-only a nivel de privilegios DB queda como hardening: un administrador SQL
con permisos amplios puede modificar tablas; no se afirma inmutabilidad criptografica.

effective_at = fecha real conocida; recorded_at = cuando se guardo evidencia.
Snapshot inicial sin pasado: effective_at=null, actor=null, event_kind=import_snapshot.
No calcular duracion del pasado desconocido usando recorded_at de importacion.
Nuevas acciones CRM toman la hora UTC del servidor; no del navegador.
El servidor usa America/Guatemala (UTC-6). Se verifico y corrigio a
DEFAULT (UTC_TIMESTAMP(3)) en columnas nuevas, sin alterar zona global ni tablas viejas.
La fecha comercial DATE no tiene conversion de zona.

## Contrato JSON de observacion

Ejemplo sintetico, no una orden extraida de produccion:

```json
{
  "schemaVersion": 1,
  "identity": { "legacyId": 24, "nativeCode": "LEGACY-OV-24" },
  "externalReferences": [
    { "systemCode": "provider_a", "externalId": "900", "transactionNumber": "OV-24" },
    { "systemCode": "provider_b", "externalId": "SO-44", "transactionNumber": "VENTA-44" }
  ],
  "commercial": { "status": "active", "cancelled": "no", "currencyCode": null },
  "approvals": {
    "sales_management": "approved",
    "developer": "approved",
    "formalization": "not_approved"
  },
  "observedState": { "code": "pending_approval", "effectiveAt": null, "actor": null },
  "provenance": {
    "systemCode": "legacy_crm",
    "sourceRecordId": "24",
    "observedAt": "2026-10-20T20:00:00Z",
    "originalRecord": { "id_ov": 24 }
  }
}
```

El mapper incluye ademas los importes, fecha comercial y marcas normalizadas
documentadas abajo; el ejemplo abrevia esos campos y el snapshot para lectura.

mapLegacySalesOrder produce schemaVersion, identity, externalReferences, commercial,
approvals, observedState y provenance. provenance.originalRecord conserva TODAS
las columnas originales, incluso futuras columnas extra. El mapeo es una
transformacion pura, no un importador masivo ni un endpoint.
Un sobre de escritura posterior debe agregar operationId/correlationId y resolver
actores desde sesion confiable. No aceptar actor/roles/fechas del navegador.
Cada adaptador convierte el contrato al modelo destino. En produccion solo se
prepara almacenamiento de estado; no existe dual-write automatico en este corte.
Para sincronizar dos BD se requieren outbox, reintentos y conciliacion. Una
transaccion local no hace atomica una escritura en ambas bases.

## Mapeo completo de ordenventa

| Campo legado | Destino o tratamiento | Regla |
|---|---|---|
| id_ov | id_old_produccion_sales_order | Referencia unica; PK nueva independiente |
| id_ov_netsuite | external_id_sales_order_external_reference | Texto y sistema registrado; no FK comercial |
| id_ov_tranid | transaction_number_sales_order_external_reference | Numero visible por proveedor |
| id_ov_est | snapshot original: id_ov_est | Relacion de estimacion aun no conciliada; no usar como id nuevo |
| id_ov_opt | snapshot original: id_ov_opt | Relacion de oportunidad; confirmar semantica de fk_opt antes de conciliar |
| id_ov_admin | snapshot original: id_ov_admin | No asumir que corresponde a sec_user sin mapa de identidad |
| id_ov_lead | snapshot original: id_ov_lead | Lead legado; su dominio no se crea en este corte |
| idExpediente_ov | unit_file_id_sales_order tras conciliacion | No copiar numero externo como FK propia; conservar original en snapshot |
| idsubsidiaria_ov | subsidiary_id_sales_order tras conciliacion | Conciliar con crm_subsidiary |
| namesubsi_ov | snapshot original; nombre desde catalogo propio | Evitar duplicar nombre canonico |
| chek_ov | snapshot original: chek_ov | Semantica no demostrada por salesorders.js; no reinterpretar |
| contrado_frima_ov | contract_signed_sales_order | custbody90: yes/no/unknown; firma de contrato |
| cierre_firmado_ov | commercial_closure_signed_sales_order | custbody51: no se equipara automaticamente a traspaso ni cierre formalizacion |
| aprobacion_forma_ov | aprobacion tipo formalization | custbodyid_firma_rc; approved/not_approved/unknown |
| aprobacion__rdr_ov | aprobacion tipo developer | custbodyid_firma_rocca; no existe una cuarta aprobacion RDR |
| calculo_comision_asesor_ov | advisor_commission_calculated_sales_order | custbody74: yes/no/unknown |
| comision_cancelada_ov | advisor_commission_paid_sales_order | custbody_ix_comision_pagada en archivo recibido; yes/no/unknown |
| status_ov | status_sales_order | 1 active; 0 inactive; otros o null unknown |
| creado_ov | source_created_at_sales_order + snapshot original | Fecha del registro viejo; no se convierte sin zona horaria confirmada ni se confunde con creacion en ERP |
| caida_ov | cancelled_sales_order | 1 yes; 0 no; null/otros unknown |
| reserva_ov | snapshot original: reserva_ov | Pendiente confirmar semantica y todos sus valores |
| pre_lista_ov | list_price_sales_order | custbody13; DECIMAL(19,4) o null si ambiguo |
| trandate_ov | transaction_date_sales_order | Archivo transforma fecha comercial a ISO; validar calendario; 0 no es fecha |
| prec_ventaneto_ov | net_sale_price_sales_order | custbody17; no seguir conversion booleana ajena a este dato |
| prec_venta_ov | sale_price_sales_order | custbody_ix_total_amount; moneda no se deduce |
| comison_asesor_ov | advisor_commission_sales_order | custbody21; confirmar unidad comercial antes de importacion definitiva |
| ubicacion | snapshot original: ubicacion | Conciliar con ubicacion propia; no asumir que texto es FK |
| entity_cliente_ov | snapshot original: entity_cliente_ov | Cliente externo original; no inventar crm_customer |
| envioReserva | snapshot original: envioReserva | Pendiente conocer formato y si es marca, fecha o resultado |
| envioReservaCaida | snapshot original: envioReservaCaida | Pendiente conocer formato y significado |
| fechaClienteComprobante_ov | snapshot original: fechaClienteComprobante_ov | Fecha textual sin formato ni zona confirmados |
| pagadas_ov | snapshot original: pagadas_ov | No se considera saldo monetario ni aprobacion financiera |
| chekJefeVenta | aprobacion tipo sales_management | custbody_aprueba_jefe_ventas: approved/not_approved/unknown |

Las relaciones de Lead/Oportunidad/Estimacion/Cliente aun no tienen dominios
propios activos en este corte. Sus IDs se preservan en snapshot, no como FKs
falsas ni como tablas vacias especulativas. La moneda y campos ambiguos deben
conciliarse antes de importar. Precio invalido no se reemplaza por cero.

## Ejecucion y reversibilidad

Nueva BD: pnpm migrate:identity:schema --only=202610200021_sales_orders;
luego --only=202610200022_sales_order_utc_defaults.
Las migraciones usan lock/ledger existentes y verifican CRM_THINK_V2.
DDL MySQL hace commit implicito; si falla parcialmente, inspeccionar las tablas
antes de reintentar. IF NOT EXISTS no corrige una tabla preexistente incompatible.

DBA produccion:
1. Confirmar base/host y permisos; obtener backup/DDL de ordenventa.
2. Verificar que conf_sales_order_state y audit_sales_order_state_event no existen
   con estructuras incompatibles. El script solo usa CREATE IF NOT EXISTS y seed
   idempotente del catalogo; nunca corrige una tabla incompatible silenciosamente.
3. Ejecutar el script aditivo en una ventana aprobada.
4. Comparar SHOW CREATE TABLE ordenventa y conteo de registros antes/despues;
   verificar nueve estados y cero eventos de orden tras aplicar.
5. No otorgar privilegios nuevos al usuario legacy_reader ni activar triggers.
6. El historial legado no tiene FK a ordenventa: se retiene aunque la aplicacion
   vieja borre una orden; no se altera el comportamiento de borrado legacy.

Reversion operativa segura: no usar las tablas nuevas y conservarlas, sin borrar
datos ni ejecutar DROP. Si se necesitara retirada fisica, requiere aprobacion
independiente, backup y comprobacion de referencias; no hay down destructivo.

## Verificacion y pendientes

Resultado de verificacion del avance: 4441 pruebas generales API aprobadas
(113 omitidas por sus flags). Reejecucion con 4 workers y timeout 30s tras
un timeout de infraestructura en lint/module-import-boundary y actualizacion
del inventario esperado de migraciones. La suite especifica tiene 16 pruebas,
incluidas 6 pruebas MySQL reales habilitadas explicitamente con rollback.
Typecheck y build aprobados. Lint/formato de archivos tocados aprobados.
Los checks globales no estan limpios: formato previo en
test/unit-files/unit-files-search.spec.ts y JSDoc previo en cinco clases de
catalogs/projects. No se corrigieron archivos ajenos para ocultar esos fallos.

La reconfirmacion de conectividad al finalizar devolvio ETIMEDOUT dos veces.
Las migraciones y pruebas MySQL anteriores si concluyeron; no se presenta
esta ultima consulta como verificacion exitosa de disponibilidad actual.

Pruebas MySQL con SALES_ORDER_MYSQL_TESTS=1: reingreso, reintento, conflictos,
actor, estados separados, aprobaciones antes/despues, rollback de auditoria,
snapshot sin fecha inventada, fechas UTC, orden inactiva/caida y unicidad de
referencias por proveedor. Pruebas unitarias: mapper y limites de esquema.
Todas las columnas nuevas verificadas con COMMENT. No se ejecutaron fixtures
contra produccion; sus lecturas fueron solo agregados y DDL.

Pendiente: ejecucion DBA, importar/conciliar ordenes reales, catalogos y relaciones;
montar servicio/DTO/guard/endpoints de escritura con permisos exactos, reglas de transicion y
scope de acceso; conectar tabla y demas indicadores, registrar auditoria comercial en cada
mutacion, integrar adaptadores, outbox y reportes. La persistencia interna no esta
registrada como ruta ni habilita aprobar por tener permiso de lectura del banner.

## Contador de pendientes conectado

Se habilita exclusivamente GET /formalization/approvals/summary para el banner.
Exige sesion valida y permiso efectivo formalizacion.home.approvals.read;
una denegacion explicita prevalece. No concede permisos de aprobacion.

Regla: orden activa, no caida, Jefatura y Desarrolladora aprobadas y
Formalizacion explicitamente no aprobada. Los valores desconocidos no cuentan.
La BD nueva se consulta con estados textuales; el adaptador legado exige
status_ov=1, caida_ov=0, chekJefeVenta=1, aprobacion__rdr_ov=1 y
aprobacion_forma_ov=0. No se usa la etapa del pipeline para inferir aprobaciones.

El pool legado y ENABLE_LEGACY_FALLBACK son los mismos de catalogos. El fallback local permanece deshabilitado segun el registro de remediacion; este contrato no acredita una lectura actual de produccion. La lectura del contador no requiere ni habilita ENABLE_LEGACY_WRITES.
Las identidades candidatas legadas se leen en paginas de 500, sin datos personales.
Una fila nativa con id_old_produccion_sales_order suprime la fila legada,
incluso si la nativa esta inactiva, eliminada o ya aprobada. Al migrar siempre
debe conservarse esa referencia; IDs de proveedores diferentes no se confunden.

Contrato JSON (numeros ilustrativos, no conteo de produccion):

```json
{
  "schemaVersion": 1,
  "observedAt": "2026-10-21T12:00:00.000Z",
  "total": 3,
  "sources": {
    "native": 2,
    "legacy": 1,
    "legacyEnabled": true,
    "duplicatesExcluded": 1
  }
}
```

sources.legacy es el aporte tras excluir duplicados, no el total crudo.
Si falla una fuente habilitada se devuelve 503, nunca un total parcial.
El banner inicia sin numero y muestra No disponible si falla la lectura.
Sin permiso no se monta el contador ni se solicita el endpoint.
Al apagar el fallback se lee solo la BD nueva y legacyEnabled=false.
Las lecturas no son una transaccion distribuida: observedAt marca la respuesta,
no un snapshot atomico entre las dos BD. No se escribe, importa ni sincroniza.
Solo se conecta el contador: la lista y los otros indicadores no tienen API
operativa; la remediacion retiro datos demostrativos y los ceros provisionales
no son metricas conectadas. La persistencia de lifecycle continua sin rutas de escritura.

La comprobacion historica de esta conexion devolvio ETIMEDOUT; tampoco respondio
la conexion de lectura de produccion. No hay conteo actual confirmado.
